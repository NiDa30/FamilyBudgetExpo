/**
 * Category Sync Service
 * Handles bidirectional synchronization between SQLite and Firestore
 * Firestore is the Source of Truth
 * 
 * Features:
 * - Load from SQLite first (fast display)
 * - Sync from Firestore (pull remote changes)
 * - Sync to Firestore (push local changes)
 * - Conflict resolution using updatedAt
 * - Duplicate detection by name + type
 */

import DatabaseService from "../database/databaseService";
import FirebaseService from "../service/firebase/FirebaseService";
import { COLLECTIONS } from "../constants/collections";
import NetInfo from "@react-native-community/netinfo";

class CategorySyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
  }

  /**
   * Convert Firebase category to SQLite format
   */
  _firebaseToSQLite(firebaseCat, userId) {
    return {
      id: firebaseCat.id || firebaseCat.categoryID,
      user_id: userId,
      name: firebaseCat.name,
      type: firebaseCat.type || "EXPENSE",
      icon: firebaseCat.icon || "tag",
      color: firebaseCat.color || "#2196F3",
      budget_group: firebaseCat.budget_group || (firebaseCat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"),
      is_system_default: firebaseCat.isSystemDefault ? 1 : 0,
      display_order: firebaseCat.displayOrder || 0,
      is_hidden: firebaseCat.isHidden ? 1 : 0,
      created_at: firebaseCat.createdAt ? (typeof firebaseCat.createdAt === "number" ? firebaseCat.createdAt : new Date(firebaseCat.createdAt).getTime()) : Date.now(),
      updated_at: firebaseCat.updatedAt ? (typeof firebaseCat.updatedAt === "number" ? firebaseCat.updatedAt : new Date(firebaseCat.updatedAt).getTime()) : Date.now(),
      is_synced: 1, // Mark as synced since it came from Firebase
      deleted_at: null,
    };
  }

  /**
   * Convert SQLite category to Firebase format
   */
  _sqliteToFirebase(sqliteCat) {
    return {
      id: sqliteCat.id,
      name: sqliteCat.name,
      type: sqliteCat.type || "EXPENSE",
      icon: sqliteCat.icon || "tag",
      color: sqliteCat.color || "#2196F3",
      budget_group: sqliteCat.budget_group || (sqliteCat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"),
      isSystemDefault: sqliteCat.is_system_default === 1,
      displayOrder: sqliteCat.display_order || 0,
      isHidden: sqliteCat.is_hidden === 1,
    };
  }

  /**
   * Compare updatedAt timestamps
   * Returns: 'firebase' if Firebase is newer, 'sqlite' if SQLite is newer, 'equal' if same
   */
  _compareUpdatedAt(firebaseCat, sqliteCat) {
    const firebaseTime = firebaseCat.updatedAt 
      ? (typeof firebaseCat.updatedAt === "number" 
          ? firebaseCat.updatedAt 
          : new Date(firebaseCat.updatedAt).getTime())
      : (firebaseCat.createdAt 
          ? (typeof firebaseCat.createdAt === "number" 
              ? firebaseCat.createdAt 
              : new Date(firebaseCat.createdAt).getTime())
          : 0);
    
    const sqliteTime = sqliteCat.updated_at || sqliteCat.created_at || 0;

    if (firebaseTime > sqliteTime) return "firebase";
    if (sqliteTime > firebaseTime) return "sqlite";
    return "equal";
  }

  /**
   * SYNC FROM FIREBASE → SQLITE
   * Load categories from Firebase and sync to SQLite
   * Resolves conflicts using updatedAt (Firestore is Source of Truth)
   */
  async syncFromFirebase(userId) {
    if (this.isSyncing) {
      console.log("⏸️ Sync already in progress");
      return { synced: 0, conflicts: 0, errors: 0 };
    }

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log("📵 No internet - skipping Firebase sync");
        return { synced: 0, conflicts: 0, errors: 0, skipped: true };
      }

      this.isSyncing = true;
      console.log("📥 Syncing categories from Firebase to SQLite...");

      // 1. Get categories from Firebase
      const firebaseCategories = await FirebaseService.getCategories(userId);
      console.log(`📋 Found ${firebaseCategories.length} categories in Firebase`);

      // 2. Get categories from SQLite
      const sqliteCategories = await DatabaseService.getCategoriesByUser(userId);
      console.log(`💾 Found ${sqliteCategories.length} categories in SQLite`);

      // 3. Create maps for quick lookup
      const firebaseMap = new Map();
      firebaseCategories.forEach((cat) => {
        const id = cat.id || cat.categoryID;
        firebaseMap.set(id, cat);
      });

      const sqliteMap = new Map();
      sqliteCategories.forEach((cat) => {
        sqliteMap.set(cat.id, cat);
      });

      let syncedCount = 0;
      let conflictCount = 0;
      let errorCount = 0;

      // 4. Process each Firebase category
      for (const firebaseCat of firebaseCategories) {
        try {
          const firebaseId = firebaseCat.id || firebaseCat.categoryID;
          const sqliteCat = sqliteMap.get(firebaseId);

          if (!sqliteCat) {
            // New category from Firebase - add to SQLite
            const sqliteFormat = this._firebaseToSQLite(firebaseCat, userId);
            await DatabaseService.createCategory(sqliteFormat);
            console.log(`✅ Added new category from Firebase: ${firebaseCat.name}`);
            syncedCount++;
          } else {
            // Category exists in both - resolve conflict
            const conflictResult = this._compareUpdatedAt(firebaseCat, sqliteCat);

            if (conflictResult === "firebase" || conflictResult === "equal") {
              // Firebase is newer or equal - update SQLite
              const sqliteFormat = this._firebaseToSQLite(firebaseCat, userId);
              await DatabaseService.updateCategory(firebaseId, {
                name: sqliteFormat.name,
                type: sqliteFormat.type,
                icon: sqliteFormat.icon,
                color: sqliteFormat.color,
                budget_group: sqliteFormat.budget_group,
                is_system_default: sqliteFormat.is_system_default,
                display_order: sqliteFormat.display_order,
                is_hidden: sqliteFormat.is_hidden,
              });
              await DatabaseService.markAsSynced("categories", firebaseId);
              
              if (conflictResult === "firebase") {
                console.log(`🔄 Updated category from Firebase: ${firebaseCat.name}`);
                conflictCount++;
              }
              syncedCount++;
            } else {
              // SQLite is newer - will be handled by syncToFirebase
              console.log(`⏭️ Skipped category (SQLite is newer): ${firebaseCat.name}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error syncing category ${firebaseCat.name}:`, error);
          errorCount++;
        }
      }

      // 5. Handle deleted categories (soft delete)
      for (const sqliteCat of sqliteCategories) {
        if (!firebaseMap.has(sqliteCat.id) && sqliteCat.is_synced === 1) {
          // Category exists in SQLite but not in Firebase - mark as deleted
          await DatabaseService.deleteCategory(sqliteCat.id);
          console.log(`🗑️ Marked category as deleted: ${sqliteCat.name}`);
        }
      }

      this.lastSyncTime = Date.now();
      console.log(`✅ Firebase sync completed: ${syncedCount} synced, ${conflictCount} conflicts resolved, ${errorCount} errors`);

      return {
        synced: syncedCount,
        conflicts: conflictCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error("❌ Error syncing from Firebase:", error);
      return { synced: 0, conflicts: 0, errors: 1, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * SYNC TO FIREBASE ← SQLITE
   * Push local changes from SQLite to Firebase
   * Only syncs unsynced categories (is_synced = 0)
   */
  async syncToFirebase(userId) {
    if (this.isSyncing) {
      console.log("⏸️ Sync already in progress");
      return { pushed: 0, errors: 0 };
    }

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log("📵 No internet - skipping Firebase sync");
        return { pushed: 0, errors: 0, skipped: true };
      }

      this.isSyncing = true;
      console.log("📤 Syncing categories from SQLite to Firebase...");

      // 1. Get unsynced categories from SQLite
      const unsyncedCategories = await DatabaseService.getUnsyncedCategories(userId);
      console.log(`📋 Found ${unsyncedCategories.length} unsynced categories`);

      if (unsyncedCategories.length === 0) {
        console.log("✅ All categories are synced");
        return { pushed: 0, errors: 0 };
      }

      // 2. Get Firebase categories for duplicate check
      const firebaseCategories = await FirebaseService.getCategories(userId);
      const firebaseMap = new Map();
      firebaseCategories.forEach((cat) => {
        const id = cat.id || cat.categoryID;
        firebaseMap.set(id, cat);
      });

      let pushedCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;

      // 3. Push each unsynced category
      for (const sqliteCat of unsyncedCategories) {
        try {
          // Check for duplicates by name + type in Firebase
          const duplicate = firebaseCategories.find((fbCat) => {
            const fbName = (fbCat.name || "").toLowerCase().trim();
            const fbType = fbCat.type || "EXPENSE";
            const sqliteName = (sqliteCat.name || "").toLowerCase().trim();
            const sqliteType = sqliteCat.type || "EXPENSE";
            return fbName === sqliteName && fbType === sqliteType && (fbCat.id || fbCat.categoryID) !== sqliteCat.id;
          });

          if (duplicate) {
            console.log(`⚠️ Duplicate category found in Firebase: ${sqliteCat.name} (${sqliteCat.type})`);
            // Mark as synced to prevent repeated attempts
            await DatabaseService.markAsSynced("categories", sqliteCat.id);
            duplicateCount++;
            continue;
          }

          // Check if category exists in Firebase
          const existingFirebaseCat = firebaseMap.get(sqliteCat.id);

          if (existingFirebaseCat) {
            // Category exists - check if SQLite is newer
            const conflictResult = this._compareUpdatedAt(existingFirebaseCat, sqliteCat);

            if (conflictResult === "sqlite") {
              // SQLite is newer - update Firebase
              await FirebaseService.updateCategory(sqliteCat.id, this._sqliteToFirebase(sqliteCat));
              await DatabaseService.markAsSynced("categories", sqliteCat.id);
              console.log(`🔄 Updated category in Firebase: ${sqliteCat.name}`);
              pushedCount++;
            } else {
              // Firebase is newer or equal - mark as synced to prevent overwrite
              await DatabaseService.markAsSynced("categories", sqliteCat.id);
              console.log(`⏭️ Skipped category (Firebase is newer): ${sqliteCat.name}`);
            }
          } else {
            // New category - add to Firebase
            await FirebaseService.addCategory(userId, this._sqliteToFirebase(sqliteCat));
            await DatabaseService.markAsSynced("categories", sqliteCat.id);
            console.log(`✅ Added category to Firebase: ${sqliteCat.name}`);
            pushedCount++;
          }
        } catch (error) {
          console.error(`❌ Error pushing category ${sqliteCat.name}:`, error);
          
          // If error is due to duplicate, mark as synced
          if (error.message?.includes("duplicate") || error.message?.includes("already exists")) {
            await DatabaseService.markAsSynced("categories", sqliteCat.id);
            duplicateCount++;
          } else {
            errorCount++;
          }
        }
      }

      console.log(`✅ Firebase push completed: ${pushedCount} pushed, ${duplicateCount} duplicates, ${errorCount} errors`);

      return {
        pushed: pushedCount,
        duplicates: duplicateCount,
        errors: errorCount,
      };
    } catch (error) {
      console.error("❌ Error syncing to Firebase:", error);
      return { pushed: 0, errors: 1, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * FULL SYNC: Pull from Firebase → Push to Firebase
   * This ensures both directions are synced
   */
  async performFullSync(userId) {
    console.log("🔄 Starting full category sync...");
    
    // 1. Pull from Firebase first (Firestore is Source of Truth)
    const pullResult = await this.syncFromFirebase(userId);
    
    // 2. Push to Firebase (local changes)
    const pushResult = await this.syncToFirebase(userId);

    return {
      pull: pullResult,
      push: pushResult,
    };
  }

  /**
   * Check if category name is duplicate in Firebase
   * Returns true if duplicate exists
   */
  async checkDuplicateInFirebase(userId, categoryName, categoryType, excludeId = null) {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        return false; // Can't check if offline
      }

      const firebaseCategories = await FirebaseService.getCategories(userId);
      const normalizedName = (categoryName || "").toLowerCase().trim();
      const normalizedType = categoryType || "EXPENSE";

      const duplicate = firebaseCategories.find((cat) => {
        const catName = (cat.name || "").toLowerCase().trim();
        const catType = cat.type || "EXPENSE";
        const catId = cat.id || cat.categoryID;
        return catName === normalizedName && catType === normalizedType && catId !== excludeId;
      });

      return !!duplicate;
    } catch (error) {
      console.error("Error checking duplicate in Firebase:", error);
      return false; // Return false on error to allow operation
    }
  }
}

export default new CategorySyncService();


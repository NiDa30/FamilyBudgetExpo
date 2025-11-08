/**
 * Category Service
 * Quản lý danh mục chi tiêu (CATEGORIES_DEFAULT + CATEGORIES)
 * 
 * Features:
 * - Load default categories from CATEGORIES_DEFAULT (read-only)
 * - Load user categories from CATEGORIES (editable)
 * - Add default category to user categories
 * - Add new user category
 * - Check duplicate categories
 * - Sync between SQLite and Firebase
 */

import DatabaseService from "../database/databaseService";
import FirebaseService from "../service/firebase/FirebaseService";
import CategorySyncService from "./categorySyncService";
import NetInfo from "@react-native-community/netinfo";

export interface Category {
  id: string;
  name: string;
  type: "EXPENSE" | "INCOME";
  icon?: string;
  color?: string;
  budget_group?: string;
  isSystemDefault?: boolean;
  displayOrder?: number;
  isHidden?: boolean;
  userID?: string;
  createdAt?: number;
  updatedAt?: number;
}

class CategoryService {
  /**
   * Load default categories from Firebase CATEGORIES_DEFAULT
   * These are system-managed categories (read-only)
   */
  async loadDefaultCategoriesFromFirebase(): Promise<Category[]> {
    try {
      console.log("📋 Starting to load default categories from Firebase...");
      
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log("📵 No internet - cannot load default categories from Firebase");
        return [];
      }

      console.log("📡 Internet connected, loading default categories...");
      const defaultCategories = await FirebaseService.getDefaultCategories();
      
      console.log(`📋 Received ${defaultCategories.length} default categories from FirebaseService`);
      
      if (defaultCategories.length === 0) {
        console.warn("⚠️ No default categories found in Firebase CATEGORIES_DEFAULT collection");
        console.warn("⚠️ Please check if CATEGORIES_DEFAULT collection exists and has data");
      }
      
      const mappedCategories = defaultCategories.map((cat: any) => {
        const mapped = {
          id: cat.id || cat.categoryID,
          name: cat.name,
          type: (cat.type || "EXPENSE") as "EXPENSE" | "INCOME",
          icon: cat.icon || "tag",
          color: cat.color || "#2196F3",
          budget_group: cat.budget_group || (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"),
          isSystemDefault: true,
          displayOrder: cat.displayOrder || 0,
          isHidden: cat.isHidden || false,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
        };
        console.log(`📋 Mapped default category: ${mapped.name} (${mapped.type})`);
        return mapped;
      });
      
      console.log(`✅ Successfully loaded and mapped ${mappedCategories.length} default categories`);
      return mappedCategories;
    } catch (error: any) {
      console.error("❌ Error loading default categories from Firebase:", error);
      console.error("❌ Error message:", error?.message);
      console.error("❌ Error code:", error?.code);
      console.error("❌ Error stack:", error?.stack);
      return [];
    }
  }

  /**
   * Load user categories from SQLite
   * These are user-created or selected categories (editable)
   */
  async loadUserCategoriesFromSQLite(userId: string): Promise<Category[]> {
    try {
      const categories = await DatabaseService.getCategoriesByUser(userId);
      
      return categories
        .filter((cat: any) => !cat.deleted_at && !cat.is_hidden)
        .map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          type: (cat.type || "EXPENSE") as "EXPENSE" | "INCOME",
          icon: cat.icon || "tag",
          color: cat.color || "#2196F3",
          budget_group: cat.budget_group || (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"),
          isSystemDefault: cat.is_system_default === 1,
          displayOrder: cat.display_order || 0,
          isHidden: cat.is_hidden === 1,
          userID: cat.user_id,
          createdAt: cat.created_at,
          updatedAt: cat.updated_at,
        }));
    } catch (error) {
      console.error("❌ Error loading user categories from SQLite:", error);
      return [];
    }
  }

  /**
   * Check if category exists in user categories by name or id
   */
  async checkDuplicateCategory(
    userId: string,
    categoryName: string,
    categoryType: "EXPENSE" | "INCOME",
    excludeId?: string
  ): Promise<boolean> {
    try {
      // Check in SQLite
      const existingId = await DatabaseService.categoryExistsByName(
        userId,
        categoryName,
        categoryType
      );

      if (existingId && existingId !== excludeId) {
        return true;
      }

      // Check in Firebase (if online)
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        const isDuplicate = await CategorySyncService.checkDuplicateInFirebase(
          userId,
          categoryName,
          categoryType,
          excludeId
        );
        return isDuplicate;
      }

      return false;
    } catch (error) {
      console.error("❌ Error checking duplicate category:", error);
      return false; // Return false on error to allow operation
    }
  }

  /**
   * Add default category to user categories
   * When user selects a default category, add it to CATEGORIES
   */
  async addCategoryFromDefault(
    userId: string,
    defaultCategory: Category
  ): Promise<{ success: boolean; message: string; category?: Category }> {
    try {
      // Check if category already exists in user categories
      const isDuplicate = await this.checkDuplicateCategory(
        userId,
        defaultCategory.name,
        defaultCategory.type
      );

      if (isDuplicate) {
        return {
          success: false,
          message: "Danh mục này đã tồn tại.",
        };
      }

      // Create category in SQLite
      const categoryToAdd = {
        id: defaultCategory.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        name: defaultCategory.name,
        type: defaultCategory.type,
        icon: defaultCategory.icon || "tag",
        color: defaultCategory.color || "#2196F3",
        budget_group: defaultCategory.budget_group || (defaultCategory.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"),
        is_system_default: 1, // Mark as system default
        display_order: defaultCategory.displayOrder || 0,
        is_hidden: 0,
      };

      await DatabaseService.createCategory(categoryToAdd);
      console.log(`✅ Added default category "${defaultCategory.name}" to user categories`);

      // Sync to Firebase in background
      await this.syncSQLiteToFirebase(userId);

      return {
        success: true,
        message: "Đã thêm danh mục thành công.",
        category: {
          ...categoryToAdd,
          isSystemDefault: true,
          userID: userId,
        },
      };
    } catch (error: any) {
      console.error("❌ Error adding category from default:", error);
      
      // If duplicate error, return appropriate message
      if (error?.message?.includes("UNIQUE constraint")) {
        return {
          success: false,
          message: "Danh mục này đã tồn tại.",
        };
      }

      return {
        success: false,
        message: `Lỗi khi thêm danh mục: ${error?.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Add new user category
   * User creates a new category manually
   */
  async addNewUserCategory(
    userId: string,
    category: {
      name: string;
      type: "EXPENSE" | "INCOME";
      icon?: string;
      color?: string;
      budget_group?: string;
    }
  ): Promise<{ success: boolean; message: string; category?: Category }> {
    try {
      // Check for duplicate name
      const isDuplicate = await this.checkDuplicateCategory(
        userId,
        category.name,
        category.type
      );

      if (isDuplicate) {
        return {
          success: false,
          message: `Danh mục "${category.name}" đã tồn tại. Vui lòng chọn tên khác.`,
        };
      }

      // Create category in SQLite
      const newCategory = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        name: category.name.trim(),
        type: category.type,
        icon: category.icon || "tag",
        color: category.color || "#2196F3",
        budget_group: category.budget_group || (category.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"),
        is_system_default: 0, // User-created category
        display_order: 0,
        is_hidden: 0,
      };

      await DatabaseService.createCategory(newCategory);
      console.log(`✅ Added new user category "${category.name}"`);

      // Sync to Firebase in background
      await this.syncSQLiteToFirebase(userId);

      return {
        success: true,
        message: "Đã thêm danh mục mới thành công.",
        category: {
          ...newCategory,
          isSystemDefault: false,
          userID: userId,
        },
      };
    } catch (error: any) {
      console.error("❌ Error adding new user category:", error);
      
      // If duplicate error, return appropriate message
      if (error?.message?.includes("UNIQUE constraint")) {
        return {
          success: false,
          message: `Danh mục "${category.name}" đã tồn tại.`,
        };
      }

      return {
        success: false,
        message: `Lỗi khi thêm danh mục: ${error?.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Delete user category
   * Only user-created categories can be deleted (not system default)
   */
  async deleteCategory(
    userId: string,
    categoryId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get category to check if it's system default
      const categories = await DatabaseService.getCategoriesByUser(userId);
      const category = categories.find((cat: any) => cat.id === categoryId);

      if (!category) {
        return {
          success: false,
          message: "Danh mục không tồn tại.",
        };
      }

      // Check if it's a system default category
      if (category.is_system_default === 1) {
        return {
          success: false,
          message: "Không thể xóa danh mục mặc định của hệ thống.",
        };
      }

      // Soft delete in SQLite
      await DatabaseService.deleteCategory(categoryId);
      console.log(`✅ Deleted user category "${category.name}"`);

      // Sync to Firebase in background
      await this.syncSQLiteToFirebase(userId);

      return {
        success: true,
        message: "Đã xóa danh mục thành công.",
      };
    } catch (error: any) {
      console.error("❌ Error deleting category:", error);
      return {
        success: false,
        message: `Lỗi khi xóa danh mục: ${error?.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Update user category
   * Only user-created categories can be updated
   */
  async updateCategory(
    userId: string,
    categoryId: string,
    updates: {
      name?: string;
      icon?: string;
      color?: string;
      budget_group?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get category to check if it's system default
      const categories = await DatabaseService.getCategoriesByUser(userId);
      const category = categories.find((cat: any) => cat.id === categoryId);

      if (!category) {
        return {
          success: false,
          message: "Danh mục không tồn tại.",
        };
      }

      // Check if it's a system default category
      if (category.is_system_default === 1) {
        return {
          success: false,
          message: "Không thể chỉnh sửa danh mục mặc định của hệ thống.",
        };
      }

      // Check for duplicate name if name is being updated
      if (updates.name && updates.name !== category.name) {
        const isDuplicate = await this.checkDuplicateCategory(
          userId,
          updates.name,
          category.type,
          categoryId
        );

        if (isDuplicate) {
          return {
            success: false,
            message: `Danh mục "${updates.name}" đã tồn tại.`,
          };
        }
      }

      // Update in SQLite
      await DatabaseService.updateCategory(categoryId, updates);
      console.log(`✅ Updated user category "${category.name}"`);

      // Sync to Firebase in background
      await this.syncSQLiteToFirebase(userId);

      return {
        success: true,
        message: "Đã cập nhật danh mục thành công.",
      };
    } catch (error: any) {
      console.error("❌ Error updating category:", error);
      return {
        success: false,
        message: `Lỗi khi cập nhật danh mục: ${error?.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Sync Firebase → SQLite
   * Load data from Firebase CATEGORIES and update SQLite
   */
  async syncFirebaseToSQLite(userId: string): Promise<{
    success: boolean;
    synced: number;
    conflicts: number;
    errors: number;
  }> {
    try {
      const result = await CategorySyncService.syncFromFirebase(userId);
      return {
        success: result.errors === 0,
        synced: result.synced,
        conflicts: result.conflicts,
        errors: result.errors,
      };
    } catch (error: any) {
      console.error("❌ Error syncing Firebase to SQLite:", error);
      return {
        success: false,
        synced: 0,
        conflicts: 0,
        errors: 1,
      };
    }
  }

  /**
   * Sync SQLite → Firebase
   * Push local changes from SQLite to Firebase CATEGORIES
   */
  async syncSQLiteToFirebase(userId: string): Promise<{
    success: boolean;
    pushed: number;
    duplicates: number;
    errors: number;
  }> {
    try {
      const result = await CategorySyncService.syncToFirebase(userId);
      return {
        success: result.errors === 0,
        pushed: result.pushed || 0,
        duplicates: result.duplicates || 0,
        errors: result.errors || 0,
      };
    } catch (error: any) {
      console.error("❌ Error syncing SQLite to Firebase:", error);
      return {
        success: false,
        pushed: 0,
        duplicates: 0,
        errors: 1,
      };
    }
  }

  /**
   * Get categories by type (EXPENSE or INCOME)
   */
  async getCategoriesByType(
    userId: string,
    type: "EXPENSE" | "INCOME"
  ): Promise<Category[]> {
    const categories = await this.loadUserCategoriesFromSQLite(userId);
    return categories.filter((cat) => cat.type === type);
  }

  /**
   * Separate default and user categories
   */
  async getSeparatedCategories(userId: string): Promise<{
    defaultCategories: Category[];
    userCategories: Category[];
  }> {
    const [defaultCategories, userCategories] = await Promise.all([
      this.loadDefaultCategoriesFromFirebase(),
      this.loadUserCategoriesFromSQLite(userId),
    ]);

    return {
      defaultCategories,
      userCategories,
    };
  }

  /**
   * Get combined categories for display
   * Merges default categories and user categories
   * Default categories are marked as read-only
   */
  async getCombinedCategories(userId: string): Promise<Category[]> {
    try {
      console.log("📋 Loading combined categories...");
      
      // Load both default and user categories
      const [defaultCategories, userCategories] = await Promise.all([
        this.loadDefaultCategoriesFromFirebase(),
        this.loadUserCategoriesFromSQLite(userId),
      ]);

      console.log(`📋 Loaded ${defaultCategories.length} default categories`);
      console.log(`📋 Loaded ${userCategories.length} user categories`);

      // Create a map of user category IDs to avoid duplicates
      const userCategoryMap = new Map<string, Category>();
      userCategories.forEach((cat) => {
        userCategoryMap.set(cat.id, cat);
      });

      // Combine categories: user categories first, then default categories not in user list
      const combined: Category[] = [];

      // Add user categories first
      userCategories.forEach((cat) => {
        combined.push({
          ...cat,
          isSystemDefault: false, // User-created or selected
        });
      });

      // Add default categories that are not in user list
      defaultCategories.forEach((defaultCat) => {
        // Check if this default category is already in user categories (by name + type)
        const existsInUser = userCategories.some(
          (userCat) =>
            userCat.name.toLowerCase().trim() === defaultCat.name.toLowerCase().trim() &&
            userCat.type === defaultCat.type
        );

        if (!existsInUser) {
          combined.push({
            ...defaultCat,
            isSystemDefault: true, // Mark as system default (read-only)
          });
        }
      });

      console.log(`✅ Combined ${combined.length} categories for display`);
      return combined;
    } catch (error) {
      console.error("❌ Error getting combined categories:", error);
      // Fallback to user categories only
      return this.loadUserCategoriesFromSQLite(userId);
    }
  }

  /**
   * Save user category (when user selects a default category or creates new one)
   * Creates a record in SQLite and marks it as unsynced
   */
  async saveUserCategory(
    userId: string,
    category: {
      id?: string;
      name: string;
      type: "EXPENSE" | "INCOME";
      icon?: string;
      color?: string;
      budget_group?: string;
      isSystemDefault?: boolean;
    }
  ): Promise<{ success: boolean; message: string; category?: Category }> {
    try {
      console.log(`💾 Saving user category: ${category.name}`);

      // Check for duplicates by name + type
      const existingId = await DatabaseService.categoryExistsByName(
        userId,
        category.name,
        category.type
      );

      if (existingId) {
        console.log(`⚠️ Category "${category.name}" already exists with ID: ${existingId}`);
        
        // Update existing category instead of creating duplicate
        await DatabaseService.updateCategory(existingId, {
          icon: category.icon,
          color: category.color,
          budget_group: category.budget_group,
        });

        // Get updated category
        const categories = await DatabaseService.getCategoriesByUser(userId);
        const updatedCategory = categories.find((cat: any) => cat.id === existingId);

        return {
          success: true,
          message: "Danh mục đã được cập nhật.",
          category: updatedCategory ? {
            id: updatedCategory.id,
            name: updatedCategory.name,
            type: updatedCategory.type as "EXPENSE" | "INCOME",
            icon: updatedCategory.icon,
            color: updatedCategory.color,
            budget_group: updatedCategory.budget_group,
            isSystemDefault: updatedCategory.is_system_default === 1,
            userID: userId,
          } : undefined,
        };
      }

      // Create new category in SQLite (marked as unsynced)
      const newCategory = {
        id: category.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        name: category.name.trim(),
        type: category.type,
        icon: category.icon || "tag",
        color: category.color || "#2196F3",
        budget_group: category.budget_group || (category.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"),
        is_system_default: category.isSystemDefault ? 1 : 0,
        display_order: 0,
        is_hidden: 0,
      };

      await DatabaseService.createCategory(newCategory);
      console.log(`✅ Saved category "${category.name}" to SQLite (unsynced)`);

      return {
        success: true,
        message: "Đã lưu danh mục thành công.",
        category: {
          ...newCategory,
          isSystemDefault: category.isSystemDefault || false,
          userID: userId,
        },
      };
    } catch (error: any) {
      console.error("❌ Error saving user category:", error);
      return {
        success: false,
        message: `Lỗi khi lưu danh mục: ${error?.message || "Unknown error"}`,
      };
    }
  }

  /**
   * Sync category to Firebase
   * Handles conflict resolution using timestamps
   */
  async syncCategoryToFirebase(
    userId: string,
    categoryId: string
  ): Promise<{ success: boolean; message: string; synced: boolean }> {
    try {
      console.log(`🔄 Syncing category to Firebase: ${categoryId}`);

      // Get category from SQLite
      const categories = await DatabaseService.getCategoriesByUser(userId);
      const category = categories.find((cat: any) => cat.id === categoryId);

      if (!category) {
        return {
          success: false,
          message: "Danh mục không tồn tại trong SQLite.",
          synced: false,
        };
      }

      // Check if already synced
      if (category.is_synced === 1) {
        console.log(`⏭️ Category "${category.name}" is already synced`);
        return {
          success: true,
          message: "Danh mục đã được đồng bộ.",
          synced: true,
        };
      }

      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log("📵 No internet - cannot sync to Firebase");
        return {
          success: false,
          message: "Không có kết nối internet. Sẽ đồng bộ sau.",
          synced: false,
        };
      }

      // Get Firebase categories for duplicate check and conflict resolution
      const firebaseCategories = await FirebaseService.getCategories(userId);
      const existingFirebaseCat = firebaseCategories.find(
        (fbCat) => (fbCat.id || fbCat.categoryID) === categoryId
      );

      // Check for duplicates by name + type
      const duplicate = firebaseCategories.find((fbCat) => {
        const fbName = (fbCat.name || "").toLowerCase().trim();
        const fbType = fbCat.type || "EXPENSE";
        const sqliteName = (category.name || "").toLowerCase().trim();
        const sqliteType = category.type || "EXPENSE";
        return (
          fbName === sqliteName &&
          fbType === sqliteType &&
          (fbCat.id || fbCat.categoryID) !== categoryId
        );
      });

      if (duplicate) {
        console.log(`⚠️ Duplicate category found in Firebase: ${category.name}`);
        // Mark as synced to prevent repeated attempts
        await DatabaseService.markAsSynced("categories", categoryId);
        return {
          success: true,
          message: "Danh mục đã tồn tại trên Firebase (duplicate).",
          synced: true,
        };
      }

      // Convert to Firebase format
      const firebaseFormat = this._sqliteToFirebase(category);

      if (existingFirebaseCat) {
        // Category exists in Firebase - check timestamp for conflict resolution
        const conflictResult = this._compareUpdatedAt(existingFirebaseCat, category);

        if (conflictResult === "sqlite") {
          // SQLite is newer - update Firebase
          console.log(`🔄 Updating category in Firebase: ${category.name} (SQLite is newer)`);
          await FirebaseService.updateCategory(categoryId, firebaseFormat);
          await DatabaseService.markAsSynced("categories", categoryId);
          console.log(`✅ Updated category in Firebase: ${category.name}`);
          return {
            success: true,
            message: "Đã cập nhật danh mục trên Firebase.",
            synced: true,
          };
        } else {
          // Firebase is newer or equal - update SQLite and mark as synced
          console.log(`⏭️ Firebase is newer for category: ${category.name}`);
          const firebaseFormat = this._firebaseToSQLite(existingFirebaseCat, userId);
          await DatabaseService.updateCategory(categoryId, {
            name: firebaseFormat.name,
            type: firebaseFormat.type,
            icon: firebaseFormat.icon,
            color: firebaseFormat.color,
            budget_group: firebaseFormat.budget_group,
          });
          await DatabaseService.markAsSynced("categories", categoryId);
          return {
            success: true,
            message: "Đã cập nhật danh mục từ Firebase (Firebase is newer).",
            synced: true,
          };
        }
      } else {
        // New category - add to Firebase
        console.log(`➕ Adding new category to Firebase: ${category.name}`);
        await FirebaseService.addCategory(userId, firebaseFormat);
        await DatabaseService.markAsSynced("categories", categoryId);
        console.log(`✅ Added category to Firebase: ${category.name}`);
        return {
          success: true,
          message: "Đã thêm danh mục lên Firebase.",
          synced: true,
        };
      }
    } catch (error: any) {
      console.error(`❌ Error syncing category to Firebase: ${error.message}`);
      
      // Log error but keep SQLite data
      console.log("📝 Keeping SQLite data, will retry sync later");
      
      return {
        success: false,
        message: `Lỗi đồng bộ: ${error?.message || "Unknown error"}. Sẽ thử lại sau.`,
        synced: false,
      };
    }
  }

  /**
   * Helper: Convert SQLite category to Firebase format
   */
  _sqliteToFirebase(sqliteCat: any): any {
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
   * Helper: Convert Firebase category to SQLite format
   */
  _firebaseToSQLite(firebaseCat: any, userId: string): any {
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
      is_synced: 1,
      deleted_at: null,
    };
  }

  /**
   * Helper: Compare updatedAt timestamps
   */
  _compareUpdatedAt(firebaseCat: any, sqliteCat: any): "firebase" | "sqlite" | "equal" {
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
   * Sync all unsynced categories to Firebase
   */
  async syncAllUnsyncedCategories(userId: string): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    errors: string[];
  }> {
    try {
      console.log("🔄 Syncing all unsynced categories to Firebase...");

      const unsyncedCategories = await DatabaseService.getUnsyncedCategories(userId);
      console.log(`📋 Found ${unsyncedCategories.length} unsynced categories`);

      let syncedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const category of unsyncedCategories) {
        const result = await this.syncCategoryToFirebase(userId, category.id);
        if (result.synced) {
          syncedCount++;
        } else {
          failedCount++;
          errors.push(`Category ${category.name}: ${result.message}`);
        }
      }

      console.log(`✅ Sync completed: ${syncedCount} synced, ${failedCount} failed`);

      return {
        success: failedCount === 0,
        synced: syncedCount,
        failed: failedCount,
        errors,
      };
    } catch (error: any) {
      console.error("❌ Error syncing all unsynced categories:", error);
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [error?.message || "Unknown error"],
      };
    }
  }
}

export default new CategoryService();


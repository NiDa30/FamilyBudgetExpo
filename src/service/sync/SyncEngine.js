import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import DatabaseService, {
  addDefaultCategories,
} from "../../database/databaseService";
import FirebaseService from "../firebase/FirebaseService";

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncCallbacks = []; // Callbacks khi sync xong
    this.pendingSyncTimeout = null;
  }

  async initialize() {
    const lastSync = await AsyncStorage.getItem("lastSyncTime");
    this.lastSyncTime = lastSync ? parseInt(lastSync) : 0;

    // Lắng nghe kết nối mạng với debounce
    NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.isSyncing) {
        console.log("📡 Internet connected, will sync soon...");
      }
    });
  }

  async performFirstTimeSync(userId) {
    console.log("🔄 First time sync for new user...");

    try {
      const firebaseCategories = await FirebaseService.getCategories(userId);

      if (firebaseCategories.length === 0) {
        console.log("👤 New user - creating default categories...");
        await addDefaultCategories(userId);
        await this.pushLocalChanges(userId);
      } else {
        console.log("📥 Existing user - pulling data from Firebase...");
        await this.pullRemoteChanges(userId);
      }

      await AsyncStorage.setItem("firstTimeSyncDone", "true");
      await AsyncStorage.setItem("lastSyncTime", Date.now().toString());

      console.log("✅ First time sync completed");
    } catch (error) {
      console.error("❌ First time sync failed:", error);
      throw error;
    }
  }

  /**
   * SYNC CHÍNH - KHÔNG BLOCK UI
   * Có thể gọi nhiều lần, tự động debounce
   */
  async performSync(userId, force = false) {
    if (!userId) {
      console.log("⚠️ No userId provided");
      return;
    }

    // Debounce - nếu sync quá gần nhau, chỉ sync 1 lần
    if (!force) {
      const timeSinceLastSync = Date.now() - (this.lastSyncTime || 0);
      if (timeSinceLastSync < 5000) {
        // 5 giây
        console.log("⏭️ Skipped sync (too soon since last sync)");
        return;
      }
    }

    if (this.isSyncing) {
      console.log("⏸️ Sync already in progress");
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log("📵 No internet - data saved locally");
      return;
    }

    this.isSyncing = true;
    console.log("🔄 Starting background sync...");

    try {
      // 1. PUSH LOCAL CHANGES LÊN FIREBASE
      const pushResult = await this.pushLocalChanges(userId);

      // 2. PULL REMOTE CHANGES (CHỈ KHI CẦN)
      if (pushResult.pushedCount > 0) {
        console.log("⏭️ Skipped pull (just pushed, no conflicts expected)");
      } else {
        // Kiểm tra xem có cần pull không
        const timeSinceLastSync = Date.now() - this.lastSyncTime;
        if (timeSinceLastSync > 60000 || force) {
          // 1 phút
          await this.pullRemoteChanges(userId);
        }
      }

      // 3. Cập nhật sync time
      this.lastSyncTime = Date.now();
      await AsyncStorage.setItem("lastSyncTime", this.lastSyncTime.toString());

      console.log("✅ Sync completed");

      // Gọi callbacks
      this.triggerSyncCallbacks();
    } catch (error) {
      console.error("❌ Sync failed:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * SCHEDULE SYNC - Đặt lịch sync sau một khoảng thời gian
   * Tránh sync liên tục khi user thao tác nhanh
   */
  scheduleSync(userId, delayMs = 2000) {
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
    }

    this.pendingSyncTimeout = setTimeout(() => {
      this.performSync(userId);
    }, delayMs);

    console.log(`⏰ Sync scheduled in ${delayMs}ms`);
  }

  /**
   * REGISTER CALLBACK - Để component biết khi sync xong
   */
  onSyncComplete(callback) {
    this.syncCallbacks.push(callback);
  }

  triggerSyncCallbacks() {
    this.syncCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Callback error:", error);
      }
    });
  }

  // ==================== PUSH LOCAL → FIREBASE ====================

  async pushLocalChanges(userId) {
    console.log("📤 Pushing local changes...");

    let pushedCount = 0;

    try {
      const unsyncedCategories = await DatabaseService.getUnsyncedRecords(
        "categories"
      );

      if (unsyncedCategories.length === 0) {
        console.log("✓ No pending categories");
      } else {
        console.log(`📊 Pushing ${unsyncedCategories.length} categories`);

        for (const category of unsyncedCategories) {
          try {
            if (category.deleted_at) {
              await FirebaseService.deleteCategory(category.id);
            } else {
              await FirebaseService.addCategory(userId, {
                id: category.id,
                name: category.name,
                icon: category.icon,
                color: category.color,
                type: category.type,
                budget_group: category.budget_group,
                updatedAt: category.updated_at || Date.now(),
              });
            }

            await DatabaseService.markAsSynced("categories", category.id);
            pushedCount++;
            console.log(`✓ Pushed: ${category.name}`);
          } catch (error) {
            console.error(`❌ Failed: ${category.name}`, error);
          }
        }
      }

      const unsyncedTransactions = await DatabaseService.getUnsyncedRecords(
        "transactions"
      );

      if (unsyncedTransactions.length === 0) {
        console.log("✓ No pending transactions");
      } else {
        console.log(`📊 Pushing ${unsyncedTransactions.length} transactions`);

        for (const transaction of unsyncedTransactions) {
          try {
            if (transaction.deleted_at) {
              await FirebaseService.deleteTransaction(transaction.id);
            } else {
              await FirebaseService.addTransaction(userId, {
                ...transaction,
                updatedAt: transaction.last_modified_at || Date.now(),
              });
            }

            await DatabaseService.markAsSynced("transactions", transaction.id);
            pushedCount++;
          } catch (error) {
            console.error("❌ Failed transaction push", error);
          }
        }
      }

      console.log(`📤 Push completed: ${pushedCount} items`);
      return { pushedCount };
    } catch (error) {
      console.error("❌ Push failed:", error);
      throw error;
    }
  }

  // ==================== PULL FIREBASE → LOCAL ====================

  async pullRemoteChanges(userId) {
    console.log("📥 Checking for remote changes...");

    let pulledCount = 0;

    try {
      const remoteCategories = await FirebaseService.getCategories(userId);

      for (const remote of remoteCategories) {
        const localCategory = await DatabaseService.db.getFirstAsync(
          "SELECT * FROM categories WHERE id = ?",
          [remote.categoryID || remote.id]
        );

        if (!localCategory) {
          // Category từ thiết bị khác
          await DatabaseService.addCategory({
            id: remote.categoryID || remote.id,
            user_id: userId,
            name: remote.name,
            type: remote.type,
            budget_group: remote.budget_group || "Nhu cầu",
            icon: remote.icon,
            color: remote.color,
            is_system_default: remote.isSystemDefault ? 1 : 0,
            updated_at: remote.updatedAt || remote.createdAt || Date.now(),
          });

          await DatabaseService.markAsSynced(
            "categories",
            remote.categoryID || remote.id
          );
          pulledCount++;
          console.log(`✓ Pulled: ${remote.name}`);
        } else {
          // Kiểm tra conflict
          const remoteTime = remote.updatedAt || remote.createdAt || 0;
          const localTime = localCategory.updated_at || 0;

          if (remoteTime > localTime) {
            const hasChanges =
              localCategory.name !== remote.name ||
              localCategory.icon !== remote.icon ||
              localCategory.color !== remote.color;

            if (hasChanges) {
              await DatabaseService.updateCategory(
                remote.categoryID || remote.id,
                {
                  name: remote.name,
                  icon: remote.icon,
                  color: remote.color,
                  updated_at: remoteTime,
                }
              );
              console.log(`✓ Updated: ${remote.name}`);
            }
          }

          // Luôn mark as synced
          await DatabaseService.markAsSynced(
            "categories",
            remote.categoryID || remote.id
          );
        }
      }

      const remoteTransactions = await FirebaseService.getTransactions(userId);

      for (const remote of remoteTransactions) {
        const localTransaction = await DatabaseService.db.getFirstAsync(
          "SELECT * FROM transactions WHERE id = ?",
          [remote.transactionID || remote.id]
        );

        if (!localTransaction) {
          await DatabaseService.addTransaction({
            id: remote.transactionID || remote.id,
            user_id: userId,
            category_id: remote.categoryID,
            amount: remote.amount,
            type: remote.type,
            description: remote.description,
            date: remote.date,
            payment_method: remote.paymentMethod,
            merchant_name: remote.merchantName,
            last_modified_at:
              remote.updatedAt || remote.createdAt || Date.now(),
          });

          await DatabaseService.markAsSynced(
            "transactions",
            remote.transactionID || remote.id
          );
          pulledCount++;
        } else {
          const remoteTime = remote.updatedAt || remote.createdAt || 0;
          const localTime = localTransaction.last_modified_at || 0;

          if (remoteTime > localTime) {
            const hasChanges =
              localTransaction.amount !== remote.amount ||
              localTransaction.description !== remote.description;

            if (hasChanges) {
              await DatabaseService.updateTransaction(
                remote.transactionID || remote.id,
                {
                  category_id: remote.categoryID,
                  amount: remote.amount,
                  description: remote.description,
                  last_modified_at: remoteTime,
                }
              );
            }
          }

          await DatabaseService.markAsSynced(
            "transactions",
            remote.transactionID || remote.id
          );
        }
      }

      if (pulledCount > 0) {
        console.log(`📥 Pull completed: ${pulledCount} items`);
      } else {
        console.log("✓ No remote changes");
      }

      return { pulledCount };
    } catch (error) {
      console.error("❌ Pull failed:", error);
      throw error;
    }
  }

  // ==================== FULL SYNC ====================

  async syncAll(userId) {
    console.log("🔄 Starting full sync...");
    try {
      const pushResult = await this.pushLocalChanges(userId);
      const pullResult = await this.pullRemoteChanges(userId);

      console.log(
        `✅ Sync completed: ${pushResult.pushedCount} pushed, ${pullResult.pulledCount} pulled`
      );
      return { ...pushResult, ...pullResult };
    } catch (error) {
      console.error("❌ Sync failed:", error);
      throw error;
    }
  }
}

export default new SyncEngine();

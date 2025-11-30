// src/database/databaseService.js
import * as SQLite from "expo-sqlite";
import {
  addMissingTransactionColumns,
  addMissingCategoryColumns,
  fixCategoryIdConstraint,
  runMigrations,
} from "./migrations"; // Update import

class DatabaseService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
    this._removingDuplicates = false; // Flag to prevent concurrent duplicate removal
  }

  async initialize() {
    if (this.initPromise) {
      console.log("Database initialization already in progress...");
      return this.initPromise;
    }

    if (this.isInitialized) {
      console.log("Database already initialized");
      return;
    }

    this.initPromise = this._doInitialize();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async _doInitialize() {
    try {
      console.log("Opening SQLite database...");
      this.db = await SQLite.openDatabaseAsync("family_budget.db");

      console.log("Creating tables...");
      await this.createTables();

      console.log("Running database migrations...");
      await runMigrations(this.db);

      this.isInitialized = true;
      console.log("SQLite Database initialized successfully");
    } catch (error) {
      console.error("Failed to initialize database:", error);
      this.isInitialized = false;
      this.db = null;
      throw error;
    }
  }

  async createTables() {
    if (!this.db) throw new Error("Database instance not available");

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'EXPENSE',
        budget_group TEXT,
        icon TEXT DEFAULT 'food-apple',
        color TEXT DEFAULT '#FF6347',
        is_system_default INTEGER DEFAULT 0,
        display_order INTEGER DEFAULT 0,
        is_hidden INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_synced INTEGER DEFAULT 0,
        deleted_at INTEGER DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT,
        amount REAL NOT NULL,
        type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
        date TEXT NOT NULL,
        description TEXT,
        payment_method TEXT,
        merchant_name TEXT,
        merchant_location TEXT,
        location_lat REAL,
        location_lng REAL,
        tags TEXT,
        is_synced BOOLEAN DEFAULT FALSE,
        last_modified_at TEXT,
        location TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_at TEXT,
        created_by TEXT,
        has_attachment BOOLEAN DEFAULT FALSE,
        recur_txn_id TEXT,
        parent_transaction_id TEXT,
        created_at TEXT,
        updated_at TEXT,  -- THÊM CỘT NÀY ĐỂ TƯƠNG THÍCH DB CŨ
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (recur_txn_id) REFERENCES transactions(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_categories_sync ON categories(is_synced);
      CREATE INDEX IF NOT EXISTS idx_categories_updated ON categories(updated_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_sync ON transactions(is_synced);
      CREATE INDEX IF NOT EXISTS idx_transactions_last_modified ON transactions(last_modified_at);
    `);

    console.log("Tables created successfully");
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      console.log("Database not initialized, initializing now...");
      await this.initialize();
    }
  }

  // ==================== CATEGORIES ====================

  async getCategoriesByUser(userId) {
    await this.ensureInitialized();

    // Note: Duplicate removal is handled during sync, not here to avoid performance issues
    // If duplicates exist, they will be removed during the next sync operation

    return await this.db.getAllAsync(
      `SELECT * FROM categories 
       WHERE user_id = ? AND deleted_at IS NULL 
       ORDER BY is_system_default DESC, name ASC`,
      [userId]
    );
  }

  async getCategoriesSince(userId, lastSyncTime) {
    await this.ensureInitialized();
    return await this.db.getAllAsync(
      `SELECT * FROM categories 
       WHERE user_id = ? 
       AND updated_at > ? 
       AND deleted_at IS NULL
       ORDER BY updated_at ASC`,
      [userId, lastSyncTime]
    );
  }

  /**
   * Get unsynced categories (is_synced = 0)
   */
  async getUnsyncedCategories(userId) {
    await this.ensureInitialized();
    return await this.db.getAllAsync(
      `SELECT * FROM categories 
       WHERE user_id = ? 
       AND (is_synced = 0 OR is_synced IS NULL) 
       AND deleted_at IS NULL 
       ORDER BY updated_at ASC`,
      [userId]
    );
  }

  async createCategory(category) {
    await this.ensureInitialized();

    // Check if category with same name+type+user already exists (by name, not ID)
    const existingId = await this.categoryExistsByName(
      category.user_id,
      category.name,
      category.type || "EXPENSE"
    );

    if (existingId && existingId !== category.id) {
      // Category with same name+type already exists with different ID
      // Update the existing one instead of creating duplicate
      console.log(
        `⚠️ Category "${category.name}" (${
          category.type || "EXPENSE"
        }) already exists with ID ${existingId}, updating instead of creating duplicate`
      );
      await this.updateCategory(existingId, {
        icon: category.icon || "food-apple",
        color: category.color || "#FF6347",
        budget_group: category.budget_group || "Nhu cầu",
        is_system_default: category.is_system_default || 0,
      });
      return { ...category, id: existingId };
    }

    const now = Date.now();

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO categories (
          id, user_id, name, type, budget_group, icon, color,
          is_system_default, display_order, is_hidden, created_at, updated_at, is_synced, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM categories WHERE id = ?), ?), ?, 0, NULL)`,
        [
          category.id,
          category.user_id,
          category.name,
          category.type || "EXPENSE",
          category.budget_group || "Nhu cầu",
          category.icon || "food-apple",
          category.color || "#FF6347",
          category.is_system_default || 0,
          category.display_order ?? category.displayOrder ?? 0,
          category.is_hidden ?? category.isHidden ?? 0,
          category.id, // For COALESCE to preserve existing created_at
          now, // Fallback created_at if new
          now, // updated_at
        ]
      );

      return { ...category, created_at: now, updated_at: now };
    } catch (error) {
      // If still fails, log and rethrow
      console.error(`Error creating category ${category.name}:`, error);
      throw error;
    }
  }

  async updateCategory(categoryId, updates) {
    await this.ensureInitialized();
    const now = Date.now();
    const fields = [];
    const values = [];

    // Map camelCase to snake_case for database columns
    const columnMap = {
      displayOrder: "display_order",
      isHidden: "is_hidden",
      isSystemDefault: "is_system_default",
      budgetGroup: "budget_group",
    };

    Object.keys(updates).forEach((key) => {
      if (
        key !== "updated_at" &&
        key !== "is_synced" &&
        updates[key] !== undefined
      ) {
        const dbColumn = columnMap[key] || key;
        fields.push(`${dbColumn} = ?`);
        values.push(updates[key]);
      }
    });

    fields.push("updated_at = ?", "is_synced = ?");
    values.push(now, 0, categoryId);

    await this.db.runAsync(
      `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  }

  async deleteCategory(categoryId) {
    await this.ensureInitialized();
    const now = Date.now();
    await this.db.runAsync(
      `UPDATE categories SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
      [now, now, categoryId]
    );
  }

  /**
   * Remove duplicate categories (same name + user_id + type)
   * Keeps the first one (oldest created_at) and deletes the rest
   */
  async removeDuplicateCategories(userId) {
    await this.ensureInitialized();

    // Prevent concurrent execution
    if (this._removingDuplicates) {
      return 0;
    }

    this._removingDuplicates = true;

    try {
      // Use a single transaction to avoid database locking issues
      await this.db.execAsync("BEGIN TRANSACTION");

      try {
        // Find duplicate categories grouped by name, user_id, and type
        const duplicates = await this.db.getAllAsync(
          `SELECT name, user_id, type, COUNT(*) as count
           FROM categories
           WHERE user_id = ? AND deleted_at IS NULL
           GROUP BY name, user_id, type
           HAVING count > 1`,
          [userId]
        );

        if (duplicates.length === 0) {
          await this.db.execAsync("COMMIT");
          return 0;
        }

        let deletedCount = 0;
        const now = Date.now();

        for (const dup of duplicates) {
          // Get all categories with this name+type combination
          const categories = await this.db.getAllAsync(
            `SELECT id, created_at FROM categories
             WHERE user_id = ? AND name = ? AND type = ? AND deleted_at IS NULL
             ORDER BY created_at ASC, id ASC`,
            [userId, dup.name, dup.type]
          );

          if (categories.length > 1) {
            // Keep the first one (oldest), delete the rest
            const deleteIds = categories.slice(1).map((c) => c.id);

            // Delete all duplicates in one query
            const placeholders = deleteIds.map(() => "?").join(",");
            await this.db.runAsync(
              `UPDATE categories SET deleted_at = ?, updated_at = ?, is_synced = 0 
               WHERE id IN (${placeholders})`,
              [now, now, ...deleteIds]
            );

            deletedCount += deleteIds.length;

            if (deleteIds.length > 0) {
              console.log(
                `🗑️ Removed ${deleteIds.length} duplicate categories: ${dup.name} (${dup.type})`
              );
            }
          }
        }

        await this.db.execAsync("COMMIT");

        if (deletedCount > 0) {
          console.log(
            `✅ Removed ${deletedCount} duplicate categories for user ${userId}`
          );
        }

        return deletedCount;
      } catch (error) {
        await this.db.execAsync("ROLLBACK");
        throw error;
      }
    } catch (error) {
      // Don't throw error, just log it to avoid breaking the app
      console.warn("Error removing duplicate categories:", error);
      return 0;
    } finally {
      this._removingDuplicates = false;
    }
  }

  /**
   * Check if category exists by name, user_id, and type
   */
  async categoryExistsByName(userId, name, type) {
    await this.ensureInitialized();
    const result = await this.db.getFirstAsync(
      `SELECT id FROM categories
       WHERE user_id = ? AND name = ? AND type = ? AND deleted_at IS NULL
       LIMIT 1`,
      [userId, name, type]
    );
    return result ? result.id : null;
  }

  // ==================== TRANSACTIONS ====================

  async createTransaction(transaction) {
    await this.ensureInitialized();

    const now = new Date().toISOString();
    const createdAt = transaction.created_at || now;
    const updatedAt = transaction.updated_at || now; // TỰ ĐỘNG ĐIỀN NẾU THIẾU
    const lastModifiedAt = transaction.last_modified_at || now;

    await this.db.runAsync(
      `INSERT INTO transactions (
        id, user_id, category_id, amount, type, description,
        date, payment_method, merchant_name, location_lat, location_lng,
        created_at, updated_at, last_modified_at, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        transaction.id,
        transaction.user_id,
        transaction.category_id,
        transaction.amount,
        transaction.type,
        transaction.description || "",
        transaction.date || now,
        transaction.payment_method || "CASH",
        transaction.merchant_name || "",
        transaction.location_lat ?? null,
        transaction.location_lng ?? null,
        createdAt,
        updatedAt, // ĐẢM BẢO CÓ updated_at
        lastModifiedAt, // Đồng bộ với last_modified_at
      ]
    );

    console.log("Transaction saved to SQLite:", transaction.id);
    return {
      ...transaction,
      created_at: createdAt,
      updated_at: updatedAt,
      lastModifiedAt,
    };
  }

  async getTransactionsByUser(userId, options = {}) {
    await this.ensureInitialized();

    try {
      // Check if is_deleted column exists
      const tableInfo = await this.db.getAllAsync(
        "PRAGMA table_info(transactions)"
      );
      const hasIsDeleted = tableInfo.some((col) => col.name === "is_deleted");

      let deletedFilter = "t.deleted_at IS NULL";
      if (hasIsDeleted) {
        deletedFilter =
          "(t.is_deleted IS NULL OR t.is_deleted = 0) AND t.deleted_at IS NULL";
      }

      let query = `
        SELECT t.*, 
               t.category_id as transaction_category_id,
               c.id as category_id_from_join,
               c.name as category_name, 
               c.icon as category_icon, 
               c.color as category_color,
               c.type as category_type
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ? AND ${deletedFilter}
      `;
      const params = [userId];

      if (options.startDate) {
        query += " AND t.date >= ?";
        params.push(options.startDate);
      }
      if (options.endDate) {
        query += " AND t.date <= ?";
        params.push(options.endDate);
      }
      if (options.type) {
        query += " AND t.type = ?";
        params.push(options.type);
      }
      // Add category filtering support
      if (options.categoryId) {
        query += " AND t.category_id = ?";
        params.push(options.categoryId);
      }

      query += " GROUP BY t.id ORDER BY t.date DESC";

      return await this.db.getAllAsync(query, params);
    } catch (error) {
      // Fallback if is_deleted column doesn't exist
      if (
        error?.message?.includes("is_deleted") ||
        error?.message?.includes("no such column")
      ) {
        let query = `
          SELECT t.*, 
                 t.category_id as transaction_category_id,
                 c.id as category_id_from_join,
                 c.name as category_name, 
                 c.icon as category_icon, 
                 c.color as category_color,
                 c.type as category_type
          FROM transactions t
          LEFT JOIN categories c ON t.category_id = c.id
          WHERE t.user_id = ? AND t.deleted_at IS NULL
        `;
        const params = [userId];

        if (options.startDate) {
          query += " AND t.date >= ?";
          params.push(options.startDate);
        }
        if (options.endDate) {
          query += " AND t.date <= ?";
          params.push(options.endDate);
        }
        if (options.type) {
          query += " AND t.type = ?";
          params.push(options.type);
        }
        if (options.categoryId) {
          query += " AND t.category_id = ?";
          params.push(options.categoryId);
        }

        query += " GROUP BY t.id ORDER BY t.date DESC";

        return await this.db.getAllAsync(query, params);
      }
      throw error;
    }
  }

  async getTransactionById(transactionId) {
    await this.ensureInitialized();
    return await this.db.getFirstAsync(
      "SELECT * FROM transactions WHERE id = ?",
      [transactionId]
    );
  }

  async updateTransaction(transactionId, updates) {
    await this.ensureInitialized();

    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      if (
        key !== "last_modified_at" &&
        key !== "updated_at" &&
        key !== "is_synced"
      ) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    fields.push("updated_at = ?", "last_modified_at = ?", "is_synced = ?");
    values.push(now, now, 0, transactionId);

    await this.db.runAsync(
      `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  }

  async deleteTransaction(transactionId) {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE transactions SET deleted_at = ?, updated_at = ?, last_modified_at = ?, is_synced = 0 WHERE id = ?`,
      [now, now, now, transactionId]
    );
  }

  async getTransactionsSince(userId, lastSyncTime) {
    await this.ensureInitialized();
    return await this.db.getAllAsync(
      `SELECT * FROM transactions 
       WHERE user_id = ? 
       AND last_modified_at > ? 
       AND deleted_at IS NULL
       ORDER BY last_modified_at ASC`,
      [userId, lastSyncTime]
    );
  }

  // ✅ ADD MISSING METHOD: getUnsyncedRecords
  async getUnsyncedRecords(tableName) {
    await this.ensureInitialized();
    if (tableName === "categories") {
      return await this.db.getAllAsync(
        `SELECT * FROM categories 
         WHERE (is_synced = 0 OR is_synced IS NULL) 
         AND deleted_at IS NULL
         ORDER BY updated_at ASC`
      );
    } else if (tableName === "transactions") {
      return await this.db.getAllAsync(
        `SELECT * FROM transactions 
         WHERE (is_synced = 0 OR is_synced IS NULL) 
         AND deleted_at IS NULL
         ORDER BY updated_at ASC`
      );
    }
    return [];
  }

  // ✅ ADD MISSING METHOD: markAsSynced
  async markAsSynced(tableName, recordId) {
    await this.ensureInitialized();
    const now = Date.now();
    if (tableName === "categories") {
      await this.db.runAsync(
        `UPDATE categories SET is_synced = 1, updated_at = ? WHERE id = ?`,
        [now, recordId]
      );
    } else if (tableName === "transactions") {
      await this.db.runAsync(
        `UPDATE transactions SET is_synced = 1, updated_at = ?, last_modified_at = ? WHERE id = ?`,
        [now, new Date().toISOString(), recordId]
      );
    }
  }
}

const databaseService = new DatabaseService();

// Add default categories function with Firebase sync
export async function addDefaultCategories(userId) {
  await databaseService.ensureInitialized();

  // Check if categories already exist
  const existingCategories = await databaseService.getCategoriesByUser(userId);
  if (existingCategories && existingCategories.length > 0) {
    console.log(
      `User ${userId} already has ${existingCategories.length} categories, skipping default creation`
    );
    return;
  }

  const defaultCategories = [
    // Expense categories
    {
      id: `cat_food_${userId}`,
      name: "Ăn uống",
      type: "EXPENSE",
      icon: "food-fork-drink",
      color: "#FF6B6B",
      budget_group: "Nhu cầu",
    },
    {
      id: `cat_transport_${userId}`,
      name: "Di chuyển",
      type: "EXPENSE",
      icon: "car",
      color: "#4ECDC4",
      budget_group: "Nhu cầu",
    },
    {
      id: `cat_house_${userId}`,
      name: "Nhà cửa",
      type: "EXPENSE",
      icon: "home",
      color: "#45B7D1",
      budget_group: "Nhu cầu",
    },
    {
      id: `cat_utility_${userId}`,
      name: "Tiện ích",
      type: "EXPENSE",
      icon: "lightning-bolt",
      color: "#96CEB4",
      budget_group: "Nhu cầu",
    },
    {
      id: `cat_health_${userId}`,
      name: "Sức khỏe",
      type: "EXPENSE",
      icon: "heart-plus",
      color: "#FFEAA7",
      budget_group: "Nhu cầu",
    },
    {
      id: `cat_education_${userId}`,
      name: "Giáo dục",
      type: "EXPENSE",
      icon: "school",
      color: "#DDA0DD",
      budget_group: "Nhu cầu",
    },
    {
      id: `cat_clothing_${userId}`,
      name: "Ăn mặc",
      type: "EXPENSE",
      icon: "tshirt-crew",
      color: "#98D8C8",
      budget_group: "Nhu cầu",
    },
    {
      id: `cat_entertainment_${userId}`,
      name: "Giải trí",
      type: "EXPENSE",
      icon: "movie",
      color: "#F7DC6F",
      budget_group: "Tiết kiệm",
    },
    {
      id: `cat_travel_${userId}`,
      name: "Du lịch",
      type: "EXPENSE",
      icon: "airplane",
      color: "#BB8FCE",
      budget_group: "Tiết kiệm",
    },
    {
      id: `cat_shopping_${userId}`,
      name: "Mua sắm",
      type: "EXPENSE",
      icon: "cart",
      color: "#F8C471",
      budget_group: "Tiết kiệm",
    },
    {
      id: `cat_gift_${userId}`,
      name: "Biếu tặng",
      type: "EXPENSE",
      icon: "gift",
      color: "#85C1E9",
      budget_group: "Đầu tư",
    },
    {
      id: `cat_other_expense_${userId}`,
      name: "Chi tiêu khác",
      type: "EXPENSE",
      icon: "dots-horizontal",
      color: "#D5D8DC",
      budget_group: "Khác",
    },

    // Income categories
    {
      id: `cat_salary_${userId}`,
      name: "Lương",
      type: "INCOME",
      icon: "cash",
      color: "#27AE60",
      budget_group: "Thu nhập",
    },
    {
      id: `cat_bonus_${userId}`,
      name: "Thưởng",
      type: "INCOME",
      icon: "gift",
      color: "#2ECC71",
      budget_group: "Thu nhập",
    },
    {
      id: `cat_investment_${userId}`,
      name: "Đầu tư",
      type: "INCOME",
      icon: "chart-line",
      color: "#3498DB",
      budget_group: "Thu nhập",
    },
    {
      id: `cat_business_${userId}`,
      name: "Kinh doanh",
      type: "INCOME",
      icon: "briefcase",
      color: "#9B59B6",
      budget_group: "Thu nhập",
    },
    {
      id: `cat_other_income_${userId}`,
      name: "Thu nhập khác",
      type: "INCOME",
      icon: "dots-horizontal",
      color: "#D5D8DC",
      budget_group: "Thu nhập",
    },
  ];

  // Create each category
  for (const category of defaultCategories) {
    try {
      await databaseService.createCategory({
        id: category.id,
        user_id: userId,
        name: category.name,
        type: category.type,
        budget_group: category.budget_group,
        icon: category.icon,
        color: category.color,
        is_system_default: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      // Sync to Firebase if available
      try {
        const FirebaseService = (
          await import("../service/firebase/FirebaseService")
        ).default;
        await FirebaseService.addCategory(userId, {
          id: category.id,
          name: category.name,
          type: category.type,
          icon: category.icon,
          color: category.color,
          isSystemDefault: true,
          displayOrder: 0,
          isHidden: false,
        });
        await databaseService.markAsSynced("categories", category.id);
      } catch (firebaseError) {
        console.warn(
          `Failed to sync category "${category.name}" to Firebase:`,
          firebaseError
        );
      }
    } catch (error) {
      console.warn(
        `Failed to create default category ${category.name}:`,
        error
      );
    }
  }

  // Log only once after all categories are created
  if (defaultCategories.length > 0) {
    console.log(
      `✅ Created ${defaultCategories.length} default categories for user ${userId}`
    );
  }
}

// ✅ NEW FUNCTION: Initialize categories if not exists and sync to Firebase
// NOTE: Default categories should be loaded from CATEGORIES_DEFAULT collection,
// not created here. This function only syncs user categories.
export async function ensureCategoriesInitialized(userId) {
  try {
    await databaseService.ensureInitialized();

    // Check if user has any categories
    const existingCategories = await databaseService.getCategoriesByUser(
      userId
    );

    if (existingCategories && existingCategories.length > 0) {
      console.log(
        `✅ User ${userId} already has ${existingCategories.length} categories`
      );

      // Check if any categories need Firebase sync (only user categories, not default ones)
      const unsyncedCategories = existingCategories.filter(
        (cat) =>
          (!cat.is_synced || cat.is_synced === 0) && cat.is_system_default !== 1
      );

      if (unsyncedCategories.length > 0 && userId) {
        console.log(
          `🔄 Syncing ${unsyncedCategories.length} unsynced user categories to Firebase...`
        );

        try {
          const FirebaseService = (
            await import("../service/firebase/FirebaseService")
          ).default;

          let syncedCount = 0;
          let failedCount = 0;

          for (const category of unsyncedCategories) {
            try {
              await FirebaseService.addCategory(userId, {
                id: category.id,
                name: category.name,
                type: category.type || "EXPENSE",
                icon: category.icon,
                color: category.color,
                isSystemDefault: category.is_system_default === 1,
                displayOrder: category.display_order || 0,
                isHidden: category.is_hidden === 1,
                budget_group: category.budget_group,
              });

              await databaseService.markAsSynced("categories", category.id);
              syncedCount++;
            } catch (syncError) {
              failedCount++;
              // Only log individual errors in development
              if (__DEV__) {
                console.warn(
                  `Failed to sync category "${category.name}" to Firebase:`,
                  syncError
                );
              }
            }
          }

          // Log batch results
          if (syncedCount > 0) {
            console.log(
              `✅ Synced ${syncedCount} user categories to Firebase${
                failedCount > 0 ? ` (${failedCount} failed)` : ""
              }`
            );
          }
        } catch (firebaseError) {
          console.warn("FirebaseService not available:", firebaseError);
        }
      }

      return;
    }

    // No categories found - Default categories should be loaded from CATEGORIES_DEFAULT
    // Don't create default categories here, let the calling code load from Firebase
    console.log(
      `📝 No categories found for user ${userId}. Default categories should be loaded from CATEGORIES_DEFAULT collection.`
    );
  } catch (error) {
    console.error("Error ensuring categories initialized:", error);
    throw error;
  }
}

export default databaseService;
export { DatabaseService };
// ensureCategoriesInitialized is already exported as a named export on line 593
export const CategoryService = databaseService;
export const TransactionService = databaseService;
export const getDatabaseInstance = () => databaseService.db;

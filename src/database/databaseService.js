// src/database/databaseService.js
import * as SQLite from "expo-sqlite";

class DatabaseService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initPromise) {
      console.log("⏳ Database initialization already in progress...");
      return this.initPromise;
    }

    if (this.isInitialized) {
      console.log("✅ Database already initialized");
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
      console.log("🔧 Opening SQLite database...");
      this.db = await SQLite.openDatabaseAsync("family_budget.db");

      console.log("🔧 Creating tables...");
      await this.createTables();

      this.isInitialized = true;
      console.log("✅ SQLite Database initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize database:", error);
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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_synced INTEGER DEFAULT 0,
        deleted_at INTEGER DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        date INTEGER NOT NULL,
        payment_method TEXT,
        merchant_name TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_synced INTEGER DEFAULT 0,
        deleted_at INTEGER DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_categories_sync ON categories(is_synced);
      CREATE INDEX IF NOT EXISTS idx_categories_updated ON categories(updated_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_sync ON transactions(is_synced);
    `);

    console.log("✅ Tables created successfully");
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      console.log("⚠️ Database not initialized, initializing now...");
      await this.initialize();
    }
  }

  // ==================== CATEGORIES ====================

  async getCategoriesByUser(userId) {
    await this.ensureInitialized();

    return await this.db.getAllAsync(
      `SELECT * FROM categories 
       WHERE user_id = ? AND deleted_at IS NULL 
       ORDER BY is_system_default DESC, name ASC`,
      [userId]
    );
  }

  // ✅ DELTA SYNC: Chỉ lấy categories thay đổi sau lastSyncTime
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

  async createCategory(category) {
    await this.ensureInitialized();

    const now = Date.now();

    await this.db.runAsync(
      `INSERT INTO categories (
        id, user_id, name, type, budget_group, icon, color,
        is_system_default, created_at, updated_at, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        category.id,
        category.user_id,
        category.name,
        category.type || "EXPENSE",
        category.budget_group || "Nhu cầu",
        category.icon || "food-apple",
        category.color || "#FF6347",
        category.is_system_default || 0,
        now,
        now,
      ]
    );

    console.log("✅ Category saved to SQLite:", category.name);
    return { ...category, created_at: now, updated_at: now };
  }

  async updateCategory(categoryId, updates) {
    await this.ensureInitialized();

    const now = Date.now();
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      if (key !== "updated_at" && key !== "is_synced") {
        fields.push(`${key} = ?`);
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

  async addDefaultCategories(userId) {
    await this.ensureInitialized();

    console.log("📝 Adding default categories for user:", userId);

    const defaultCategories = [
      {
        name: "Ăn uống",
        icon: "food-apple",
        color: "#FF6347",
        budget_group: "Nhu cầu",
      },
      {
        name: "Mua sắm",
        icon: "shopping",
        color: "#FF69B4",
        budget_group: "Muốn",
      },
      {
        name: "Giao thông",
        icon: "car",
        color: "#4169E1",
        budget_group: "Nhu cầu",
      },
      {
        name: "Y tế",
        icon: "hospital-box",
        color: "#32CD32",
        budget_group: "Nhu cầu",
      },
      {
        name: "Giải trí",
        icon: "gamepad-variant",
        color: "#FFD700",
        budget_group: "Muốn",
      },
      {
        name: "Giáo dục",
        icon: "school",
        color: "#9370DB",
        budget_group: "Nhu cầu",
      },
      {
        name: "Tiết kiệm",
        icon: "piggy-bank",
        color: "#2E8B57",
        budget_group: "Tiết kiệm",
      },
      {
        name: "Thu nhập",
        icon: "cash-multiple",
        color: "#00CED1",
        budget_group: "Thu nhập",
        type: "INCOME",
      },
    ];

    let addedCount = 0;

    for (const cat of defaultCategories) {
      try {
        const now = Date.now();
        const id = `default_${cat.name}_${now}_${Math.random()
          .toString(36)
          .substr(2, 5)}`;

        await this.db.runAsync(
          `INSERT INTO categories (
            id, user_id, name, type, budget_group, icon, color,
            is_system_default, created_at, updated_at, is_synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)`,
          [
            id,
            userId,
            cat.name,
            cat.type || "EXPENSE",
            cat.budget_group,
            cat.icon,
            cat.color,
            now,
            now,
          ]
        );

        addedCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch (error) {
        console.error(`✗ Failed to add ${cat.name}:`, error);
      }
    }

    console.log(
      `✅ Added ${addedCount}/${defaultCategories.length} default categories`
    );
  }

  // ==================== TRANSACTIONS ====================

  async addTransaction(transaction) {
    await this.ensureInitialized();

    const now = Date.now();

    await this.db.runAsync(
      `INSERT INTO transactions (
        id, user_id, category_id, amount, type, description,
        date, payment_method, merchant_name, created_at, updated_at, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        transaction.id,
        transaction.user_id,
        transaction.category_id,
        transaction.amount,
        transaction.type,
        transaction.description || "",
        transaction.date || Date.now(),
        transaction.payment_method || "",
        transaction.merchant_name || "",
        now,
        now,
      ]
    );

    return { ...transaction, created_at: now, updated_at: now };
  }

  async getTransactionsSince(userId, lastSyncTime) {
    await this.ensureInitialized();

    return await this.db.getAllAsync(
      `SELECT * FROM transactions 
       WHERE user_id = ? 
       AND updated_at > ? 
       AND deleted_at IS NULL
       ORDER BY updated_at ASC`,
      [userId, lastSyncTime]
    );
  }

  // ==================== SYNC HELPERS ====================

  async getUnsyncedRecords(tableName) {
    await this.ensureInitialized();

    return await this.db.getAllAsync(
      `SELECT * FROM ${tableName} WHERE is_synced = 0 AND deleted_at IS NULL`
    );
  }

  async markAsSynced(tableName, recordId) {
    await this.ensureInitialized();

    await this.db.runAsync(
      `UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`,
      [recordId]
    );
  }

  async clearUserData(userId) {
    await this.ensureInitialized();

    await this.db.execAsync(`
      DELETE FROM categories WHERE user_id = '${userId}' AND is_system_default = 0;
      DELETE FROM transactions WHERE user_id = '${userId}';
    `);
  }
  // ==================== TRANSACTIONS ====================

  async createTransaction(transaction) {
    await this.ensureInitialized();

    const now = Date.now();

    await this.db.runAsync(
      `INSERT INTO transactions (
        id, user_id, category_id, amount, type, description,
        date, payment_method, merchant_name, created_at, updated_at, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        transaction.id,
        transaction.user_id,
        transaction.category_id,
        transaction.amount,
        transaction.type,
        transaction.description || "",
        typeof transaction.date === "string"
          ? new Date(transaction.date).getTime()
          : transaction.date,
        transaction.payment_method || "CASH",
        transaction.merchant_name || "",
        now,
        now,
      ]
    );

    console.log("✅ Transaction saved to SQLite:", transaction.id);
    return { ...transaction, created_at: now, updated_at: now };
  }

  async getTransactionsByUser(userId, options = {}) {
    await this.ensureInitialized();

    let query = `
      SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.deleted_at IS NULL
    `;
    const params = [userId];

    // Filter by date range
    if (options.startDate) {
      query += " AND t.date >= ?";
      params.push(options.startDate);
    }
    if (options.endDate) {
      query += " AND t.date <= ?";
      params.push(options.endDate);
    }

    // Filter by type
    if (options.type) {
      query += " AND t.type = ?";
      params.push(options.type);
    }

    query += " ORDER BY t.date DESC";

    return await this.db.getAllAsync(query, params);
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

    const now = Date.now();
    const fields = [];
    const values = [];

    Object.keys(updates).forEach((key) => {
      if (key !== "updated_at" && key !== "is_synced") {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    fields.push("updated_at = ?", "is_synced = ?");
    values.push(now, 0, transactionId);

    await this.db.runAsync(
      `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  }

  async deleteTransaction(transactionId) {
    await this.ensureInitialized();

    const now = Date.now();
    await this.db.runAsync(
      `UPDATE transactions SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
      [now, now, transactionId]
    );
  }

  // Delta Sync: Get transactions changed after lastSyncTime
  async getTransactionsSince(userId, lastSyncTime) {
    await this.ensureInitialized();

    return await this.db.getAllAsync(
      `SELECT * FROM transactions 
       WHERE user_id = ? 
       AND updated_at > ? 
       AND deleted_at IS NULL
       ORDER BY updated_at ASC`,
      [userId, lastSyncTime]
    );
  }

  // Get transactions by category for statistics
  async getTransactionsByCategory(userId, categoryId, startDate, endDate) {
    await this.ensureInitialized();

    return await this.db.getAllAsync(
      `SELECT * FROM transactions 
       WHERE user_id = ? 
       AND category_id = ? 
       AND date >= ? 
       AND date <= ? 
       AND deleted_at IS NULL
       ORDER BY date DESC`,
      [userId, categoryId, startDate, endDate]
    );
  }

  // Get transaction summary
  async getTransactionSummary(userId, startDate, endDate) {
    await this.ensureInitialized();

    const result = await this.db.getFirstAsync(
      `SELECT 
        SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as total_income,
        COUNT(*) as transaction_count
       FROM transactions 
       WHERE user_id = ? 
       AND date >= ? 
       AND date <= ? 
       AND deleted_at IS NULL`,
      [userId, startDate, endDate]
    );

    return (
      result || { total_expense: 0, total_income: 0, transaction_count: 0 }
    );
  }
}

const databaseService = new DatabaseService();

export default databaseService;
export { DatabaseService };
export const CategoryService = databaseService;

export const TransactionService = databaseService;

import * as SQLite from "expo-sqlite";
import {
  Transaction,
  Category,
  UUID,
  DateRange,
  Pagination,
} from "../domain/types";
import {
  mapRowToTransaction,
  mapRowToCategory,
  mapTransactionToDb,
} from "../domain/mappers";

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const errorLogCache = new Set<string>();
let hasIsDeletedColumn: boolean | null = null;

// エラーログを1回だけ表示するヘルパー関数
function logErrorOnce(key: string, message: string, ...args: any[]) {
  if (!errorLogCache.has(key)) {
    errorLogCache.add(key);
    console.error(message, ...args);
  }
}

// Check if is_deleted column exists in transactions table
async function checkIsDeletedColumn(): Promise<boolean> {
  if (hasIsDeletedColumn !== null) {
    return hasIsDeletedColumn;
  }

  try {
    const database = await getDb();
    const tableInfo = await database.getAllAsync("PRAGMA table_info(transactions)");
    hasIsDeletedColumn = tableInfo.some((col: any) => col.name === "is_deleted");
    return hasIsDeletedColumn;
  } catch (error) {
    console.warn("Error checking is_deleted column:", error);
    hasIsDeletedColumn = false;
    return false;
  }
}

// Get the appropriate WHERE clause for filtering deleted transactions
async function getDeletedFilterClause(): Promise<string> {
  const hasColumn = await checkIsDeletedColumn();
  if (hasColumn) {
    return "(is_deleted IS NULL OR is_deleted = 0)";
  } else {
    // Fallback to deleted_at if is_deleted doesn't exist
    return "(deleted_at IS NULL)";
  }
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  // 既に初期化中の場合は、そのPromiseを待つ
  if (dbInitPromise) {
    return dbInitPromise;
  }

  if (!db) {
    dbInitPromise = (async () => {
      try {
        // ✅ ENSURE DATABASE IS INITIALIZED FIRST
        const databaseServiceModule = await import("./databaseService");
        const databaseService =
          databaseServiceModule.default ||
          databaseServiceModule.DatabaseService;
        
        // databaseServiceがクラスインスタンスの場合
        if (databaseService && typeof databaseService.ensureInitialized === "function") {
          await databaseService.ensureInitialized();
        } else if (databaseService && databaseService.db) {
          // 既に初期化されている場合は、そのインスタンスを使用
          db = databaseService.db;
          if (db) {
            dbInitPromise = null;
            return db;
          }
        }
        
        // Open database with consistent name
        db = await SQLite.openDatabaseAsync("family_budget.db");
        if (!db) {
          throw new Error("Failed to open database");
        }
        
        dbInitPromise = null;
        return db;
      } catch (error) {
        dbInitPromise = null;
        logErrorOnce("db_init_error", "Error opening database:", error);
        // エラーが発生しても、空のデータベースインスタンスを返すのではなく、エラーを再スロー
        // ただし、NullPointerExceptionの場合は空の配列を返すようにする
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("NullPointerException")) {
          // NullPointerExceptionの場合は、空のデータベースインスタンスを作成しようとする
          try {
            db = await SQLite.openDatabaseAsync("family_budget.db");
            if (db) {
              dbInitPromise = null;
              return db;
            }
          } catch (retryError) {
            // リトライも失敗した場合は、エラーをログに記録
            logErrorOnce("db_init_retry_error", "Failed to retry database initialization:", retryError);
          }
        }
        throw error;
      }
    })();
    
    return dbInitPromise;
  }
  return db;
}

async function runAsync<T = unknown>(
  sql: string,
  params: any[] = []
): Promise<{ rows: any[]; rowsAffected: number } & T> {
  try {
    const database = await getDb();
    if (!database) {
      logErrorOnce("db_null_error", "Database is null after getDb()");
      return { rows: [], rowsAffected: 0 } as any;
    }
    
    if (sql.trim().toUpperCase().startsWith("SELECT")) {
      try {
        const rows = await database.getAllAsync(sql, params);
        // Ensure rows is always an array
        if (!rows) {
          return { rows: [], rowsAffected: 0 } as any;
        }
        if (!Array.isArray(rows)) {
          return { rows: [], rowsAffected: 0 } as any;
        }
        return { rows: rows, rowsAffected: 0 } as any;
      } catch (queryError: any) {
        // NullPointerExceptionエラーの場合のみログを抑制
        const errorKey = `query_error_${sql.substring(0, 50)}_${queryError?.message || 'unknown'}`;
        const errorMessage = queryError?.message || String(queryError);
        
        if (errorMessage.includes("NullPointerException")) {
          // NullPointerExceptionの場合は、エラーの種類と回数のみを記録
          logErrorOnce(
            "db_nullpointer_error",
            `Database query error (NullPointerException): ${sql.substring(0, 50)}... (This error occurred multiple times)`
          );
        } else {
          logErrorOnce(errorKey, "Query execution error:", queryError);
        }
        return { rows: [], rowsAffected: 0 } as any;
      }
    } else {
      try {
        const result = await database.runAsync(sql, params);
        return { rows: [], rowsAffected: result?.changes || 0 } as any;
      } catch (queryError: any) {
        const errorKey = `run_error_${sql.substring(0, 50)}_${queryError?.message || 'unknown'}`;
        const errorMessage = queryError?.message || String(queryError);
        
        if (errorMessage.includes("NullPointerException")) {
          logErrorOnce(
            "db_nullpointer_run_error",
            `Database run error (NullPointerException): ${sql.substring(0, 50)}... (This error occurred multiple times)`
          );
        } else {
          logErrorOnce(errorKey, "Query execution error:", queryError);
        }
        return { rows: [], rowsAffected: 0 } as any;
      }
    }
  } catch (error: any) {
    const errorKey = `runasync_error_${error?.message || 'unknown'}`;
    const errorMessage = error?.message || String(error);
    
    if (errorMessage.includes("NullPointerException")) {
      logErrorOnce(
        "db_nullpointer_runasync_error",
        `Database operation error (NullPointerException): ${errorMessage} (This error occurred multiple times)`
      );
    } else {
      logErrorOnce(errorKey, "runAsync error:", error);
    }
    return { rows: [], rowsAffected: 0 } as any;
  }
}

export const TransactionRepository = {
  async getById(id: UUID): Promise<Transaction | null> {
    const { rows } = await runAsync(
      "SELECT * FROM transactions WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return mapRowToTransaction(rows[0]);
  },

  async listByUser(
    userId: UUID,
    range?: DateRange,
    paging?: Pagination
  ): Promise<Transaction[]> {
    try {
      const deletedFilter = await getDeletedFilterClause();
      let sql = `SELECT * FROM transactions WHERE user_id = ? AND ${deletedFilter}`;
      const params: any[] = [userId];
      if (range) {
        sql += " AND date BETWEEN ? AND ?";
        params.push(range.start, range.end);
      }
      sql += " ORDER BY date DESC";
      if (paging?.limit) sql += ` LIMIT ${paging.limit}`;
      if (paging?.offset) sql += ` OFFSET ${paging.offset}`;
      const { rows } = await runAsync(sql, params);
      return rows.map(mapRowToTransaction);
    } catch (error: any) {
      // Fallback if is_deleted column doesn't exist
      if (error?.message?.includes("is_deleted") || error?.message?.includes("no such column")) {
        hasIsDeletedColumn = false;
        const deletedFilter = await getDeletedFilterClause();
        let sql = `SELECT * FROM transactions WHERE user_id = ? AND ${deletedFilter}`;
        const params: any[] = [userId];
        if (range) {
          sql += " AND date BETWEEN ? AND ?";
          params.push(range.start, range.end);
        }
        sql += " ORDER BY date DESC";
        if (paging?.limit) sql += ` LIMIT ${paging.limit}`;
        if (paging?.offset) sql += ` OFFSET ${paging.offset}`;
        const { rows } = await runAsync(sql, params);
        return rows.map(mapRowToTransaction);
      }
      throw error;
    }
  },

  async create(txn: Transaction): Promise<void> {
    const data = mapTransactionToDb(txn);
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(",");
    const sql = `INSERT OR REPLACE INTO transactions (${Object.keys(data).join(
      ","
    )}) VALUES (${placeholders})`;
    await runAsync(sql, Object.values(data));
  },

  async update(id: UUID, partial: Partial<Transaction>): Promise<void> {
    const current = await this.getById(id);
    if (!current) throw new Error("Transaction not found");
    const updated: Transaction = {
      ...current,
      ...partial,
      lastModifiedAt: new Date().toISOString(),
      isSynced: false,
    };
    await this.create(updated);
  },

  async softDelete(id: UUID): Promise<void> {
    try {
      const hasColumn = await checkIsDeletedColumn();
      if (hasColumn) {
        await runAsync(
          "UPDATE transactions SET is_deleted = 1, deleted_at = ?, last_modified_at = ?, is_synced = 0 WHERE id = ?",
          [new Date().toISOString(), new Date().toISOString(), id]
        );
      } else {
        // Fallback: only use deleted_at
        await runAsync(
          "UPDATE transactions SET deleted_at = ?, last_modified_at = ?, is_synced = 0 WHERE id = ?",
          [new Date().toISOString(), new Date().toISOString(), id]
        );
      }
    } catch (error: any) {
      if (error?.message?.includes("is_deleted") || error?.message?.includes("no such column")) {
        hasIsDeletedColumn = false;
        // Retry with deleted_at only
        await runAsync(
          "UPDATE transactions SET deleted_at = ?, last_modified_at = ?, is_synced = 0 WHERE id = ?",
          [new Date().toISOString(), new Date().toISOString(), id]
        );
      } else {
        throw error;
      }
    }
  },

  async restore(id: UUID): Promise<void> {
    try {
      const hasColumn = await checkIsDeletedColumn();
      if (hasColumn) {
        await runAsync(
          "UPDATE transactions SET is_deleted = 0, deleted_at = NULL, last_modified_at = ?, is_synced = 0 WHERE id = ?",
          [new Date().toISOString(), id]
        );
      } else {
        // Fallback: only use deleted_at
        await runAsync(
          "UPDATE transactions SET deleted_at = NULL, last_modified_at = ?, is_synced = 0 WHERE id = ?",
          [new Date().toISOString(), id]
        );
      }
    } catch (error: any) {
      if (error?.message?.includes("is_deleted") || error?.message?.includes("no such column")) {
        hasIsDeletedColumn = false;
        // Retry with deleted_at only
        await runAsync(
          "UPDATE transactions SET deleted_at = NULL, last_modified_at = ?, is_synced = 0 WHERE id = ?",
          [new Date().toISOString(), id]
        );
      } else {
        throw error;
      }
    }
  },

  async hardDelete(id: UUID): Promise<void> {
    await runAsync("DELETE FROM transactions WHERE id = ?", [id]);
  },

  async query(
    userId: UUID,
    filters: {
      range?: DateRange;
      type?: "INCOME" | "EXPENSE";
      categoryId?: UUID | null;
      minAmount?: number;
      maxAmount?: number;
      search?: string; // in description or merchant_name
      sortBy?: "date" | "amount" | "created_at";
      sortDir?: "ASC" | "DESC";
      paging?: Pagination;
    }
  ): Promise<Transaction[]> {
    try {
      const deletedFilter = await getDeletedFilterClause();
      const clauses: string[] = [
        "user_id = ?",
        deletedFilter,
      ];
      const params: any[] = [userId];

      if (filters.range) {
        clauses.push("date BETWEEN ? AND ?");
        params.push(filters.range.start, filters.range.end);
      }
      if (filters.type) {
        clauses.push("type = ?");
        params.push(filters.type);
      }
      if (typeof filters.categoryId !== "undefined") {
        if (filters.categoryId === null) {
          clauses.push("category_id IS NULL");
        } else {
          clauses.push("category_id = ?");
          params.push(filters.categoryId);
        }
      }
      if (typeof filters.minAmount === "number") {
        clauses.push("amount >= ?");
        params.push(filters.minAmount);
      }
      if (typeof filters.maxAmount === "number") {
        clauses.push("amount <= ?");
        params.push(filters.maxAmount);
      }
      if (filters.search && filters.search.trim()) {
        clauses.push("(description LIKE ? OR merchant_name LIKE ?)");
        const pattern = `%${filters.search.trim()}%`;
        params.push(pattern, pattern);
      }

      let sql = `SELECT * FROM transactions WHERE ${clauses.join(" AND ")}`;
      const sortBy = filters.sortBy || "date";
      const sortDir = filters.sortDir || "DESC";
      sql += ` ORDER BY ${sortBy} ${sortDir}`;
      if (filters.paging?.limit) sql += ` LIMIT ${filters.paging.limit}`;
      if (filters.paging?.offset) sql += ` OFFSET ${filters.paging.offset}`;

      const { rows } = await runAsync(sql, params);
      return rows.map(mapRowToTransaction);
    } catch (error: any) {
      // Fallback if is_deleted column doesn't exist
      if (error?.message?.includes("is_deleted") || error?.message?.includes("no such column")) {
        hasIsDeletedColumn = false;
        const deletedFilter = await getDeletedFilterClause();
        const clauses: string[] = [
          "user_id = ?",
          deletedFilter,
        ];
        const params: any[] = [userId];

        if (filters.range) {
          clauses.push("date BETWEEN ? AND ?");
          params.push(filters.range.start, filters.range.end);
        }
        if (filters.type) {
          clauses.push("type = ?");
          params.push(filters.type);
        }
        if (typeof filters.categoryId !== "undefined") {
          if (filters.categoryId === null) {
            clauses.push("category_id IS NULL");
          } else {
            clauses.push("category_id = ?");
            params.push(filters.categoryId);
          }
        }
        if (typeof filters.minAmount === "number") {
          clauses.push("amount >= ?");
          params.push(filters.minAmount);
        }
        if (typeof filters.maxAmount === "number") {
          clauses.push("amount <= ?");
          params.push(filters.maxAmount);
        }
        if (filters.search && filters.search.trim()) {
          clauses.push("(description LIKE ? OR merchant_name LIKE ?)");
          const pattern = `%${filters.search.trim()}%`;
          params.push(pattern, pattern);
        }

        let sql = `SELECT * FROM transactions WHERE ${clauses.join(" AND ")}`;
        const sortBy = filters.sortBy || "date";
        const sortDir = filters.sortDir || "DESC";
        sql += ` ORDER BY ${sortBy} ${sortDir}`;
        if (filters.paging?.limit) sql += ` LIMIT ${filters.paging.limit}`;
        if (filters.paging?.offset) sql += ` OFFSET ${filters.paging.offset}`;

        const { rows } = await runAsync(sql, params);
        return rows.map(mapRowToTransaction);
      }
      throw error;
    }
  },

  async markSynced(ids: UUID[], syncedAt: string): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map(() => "?").join(",");
    await runAsync(
      `UPDATE transactions SET is_synced = 1, last_modified_at = ? WHERE id IN (${placeholders})`,
      [syncedAt, ...ids]
    );
  },

  async getUnsynced(userId: UUID): Promise<Transaction[]> {
    try {
      const deletedFilter = await getDeletedFilterClause();
      const { rows } = await runAsync(
        `SELECT * FROM transactions WHERE user_id = ? AND (is_synced = 0 OR is_synced IS NULL) AND ${deletedFilter}`,
        [userId]
      );
      return rows.map(mapRowToTransaction);
    } catch (error: any) {
      // Fallback if is_deleted column doesn't exist
      if (error?.message?.includes("is_deleted") || error?.message?.includes("no such column")) {
        hasIsDeletedColumn = false;
        const deletedFilter = await getDeletedFilterClause();
        const { rows } = await runAsync(
          `SELECT * FROM transactions WHERE user_id = ? AND (is_synced = 0 OR is_synced IS NULL) AND ${deletedFilter}`,
          [userId]
        );
        return rows.map(mapRowToTransaction);
      }
      throw error;
    }
  },
};

export const CategoryRepository = {
  async listByUser(userId: UUID): Promise<Category[]> {
    try {
      if (!userId) {
        logErrorOnce("category_userid_null", "CategoryRepository.listByUser: userId is null or undefined");
        return [];
      }
      
      // Use COALESCE for display_order in case column doesn't exist in older database
      const result = await runAsync(
        "SELECT * FROM categories WHERE (user_id IS NULL OR user_id = ?) AND (deleted_at IS NULL) ORDER BY COALESCE(display_order, 0) ASC, name ASC",
        [userId]
      );
      
      if (!result || !result.rows || !Array.isArray(result.rows)) {
        return [];
      }
      
      return result.rows.map(mapRowToCategory);
    } catch (error: any) {
      // If display_order column doesn't exist, try without it
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("display_order") || errorMessage.includes("no such column")) {
        try {
          const result = await runAsync(
            "SELECT * FROM categories WHERE (user_id IS NULL OR user_id = ?) AND (deleted_at IS NULL) ORDER BY name ASC",
            [userId]
          );
          
          if (!result || !result.rows || !Array.isArray(result.rows)) {
            return [];
          }
          
          return result.rows.map(mapRowToCategory);
        } catch (fallbackError) {
          logErrorOnce("category_list_fallback_error", "CategoryRepository.listByUser fallback error:", fallbackError);
          return [];
        }
      }
      logErrorOnce("category_list_error", "CategoryRepository.listByUser error:", error);
      return [];
    }
  },
};

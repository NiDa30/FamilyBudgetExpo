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

const db = SQLite.openDatabaseSync("familybudget.db");

async function runAsync<T = unknown>(
  sql: string,
  params: any[] = []
): Promise<{ rows: any[]; rowsAffected: number } & T> {
  const result = await db.execAsync(sql, params);
  return result as any;
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
    let sql =
      "SELECT * FROM transactions WHERE user_id = ? AND (is_deleted IS NULL OR is_deleted = 0)";
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
    await runAsync(
      "UPDATE transactions SET is_deleted = 1, deleted_at = ?, last_modified_at = ?, is_synced = 0 WHERE id = ?",
      [new Date().toISOString(), new Date().toISOString(), id]
    );
  },

  async restore(id: UUID): Promise<void> {
    await runAsync(
      "UPDATE transactions SET is_deleted = 0, deleted_at = NULL, last_modified_at = ?, is_synced = 0 WHERE id = ?",
      [new Date().toISOString(), id]
    );
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
    const clauses: string[] = [
      "user_id = ?",
      "(is_deleted IS NULL OR is_deleted = 0)",
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
    const { rows } = await runAsync(
      "SELECT * FROM transactions WHERE user_id = ? AND (is_synced = 0 OR is_synced IS NULL) AND (is_deleted IS NULL OR is_deleted = 0)",
      [userId]
    );
    return rows.map(mapRowToTransaction);
  },
};

export const CategoryRepository = {
  async listByUser(userId: UUID): Promise<Category[]> {
    const { rows } = await runAsync(
      "SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY display_order ASC, name ASC",
      [userId]
    );
    return rows.map(mapRowToCategory);
  },
};

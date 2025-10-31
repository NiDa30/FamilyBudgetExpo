import { TransactionRepository } from "../../database/repositories";
import { Transaction, UUID, DateRange, Pagination } from "../../domain/types";
import { syncService } from "../sync/SyncService";

export const TransactionService = {
  async list(userId: UUID, range?: DateRange, paging?: Pagination) {
    return TransactionRepository.listByUser(userId, range, paging);
  },

  async create(txn: Transaction) {
    await TransactionRepository.create({ ...txn, isSynced: false, lastModifiedAt: new Date().toISOString() });
    // Background sync (best-effort)
    await syncService.sync(txn.userId, false);
  },

  async bulkCreate(userId: UUID, txns: Transaction[]) {
    for (const t of txns) {
      await TransactionRepository.create({ ...t, isSynced: false, lastModifiedAt: new Date().toISOString() });
    }
    await syncService.sync(userId, false);
  },

  async getById(id: UUID) {
    return TransactionRepository.getById(id);
  },

  async update(id: UUID, partial: Partial<Transaction>, userId: UUID) {
    await TransactionRepository.update(id, partial);
    await syncService.sync(userId, false);
  },

  async softDelete(id: UUID, userId: UUID) {
    await TransactionRepository.softDelete(id);
    await syncService.sync(userId, false);
  },

  async restore(id: UUID, userId: UUID) {
    await TransactionRepository.restore(id);
    await syncService.sync(userId, false);
  },

  async hardDelete(id: UUID, userId: UUID) {
    await TransactionRepository.hardDelete(id);
    await syncService.sync(userId, false);
  },

  async query(userId: UUID, filters: {
    range?: DateRange;
    type?: "INCOME" | "EXPENSE";
    categoryId?: UUID | null;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
    sortBy?: "date" | "amount" | "created_at";
    sortDir?: "ASC" | "DESC";
    paging?: Pagination;
  }) {
    return TransactionRepository.query(userId, filters);
  },
};



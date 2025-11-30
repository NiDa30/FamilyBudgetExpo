import { Transaction, Category, User } from "./types";

export function mapRowToTransaction(row: any): Transaction {
  // ✅ 改善: 複数のフィールド名からcategoryIdを取得（JOIN結果も考慮）
  // 優先順位: transaction_category_id > category_id_from_join > category_id > categoryID > categoryId
  const categoryId = row.transaction_category_id || 
                     row.category_id_from_join || 
                     row.category_id || 
                     row.categoryID || 
                     row.categoryId || 
                     null;
  
  // ✅ デバッグ: 最初の数件でマッピングを確認
  if (row.id && typeof row.id === 'string' && row.id.includes('_')) {
    const isFirstFew = parseInt(row.id.split('_').pop() || '0', 16) % 100 < 3;
    if (isFirstFew) {
      console.log(`🔍 mapRowToTransaction debug:`, {
        id: row.id,
        transaction_category_id: row.transaction_category_id,
        category_id_from_join: row.category_id_from_join,
        category_id: row.category_id,
        category_name: row.category_name,
        mapped_categoryId: categoryId,
      });
    }
  }
  
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: categoryId,
    amount: row.amount,
    type: row.type,
    date: row.date,
    description: row.description ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    merchantName: row.merchant_name ?? undefined,
    merchantLocation: row.merchant_location ?? undefined,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    tags: row.tags
      ? String(row.tags)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : undefined,
    isSynced: !!row.is_synced,
    lastModifiedAt: row.last_modified_at ?? undefined,
    isDeleted: !!row.is_deleted,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at ?? undefined,
  };
}

export function mapRowToCategory(row: any): Category {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    name: row.name,
    type: row.type,
    isSystemDefault: !!row.is_system_default,
    icon: row.icon ?? undefined,
    color: row.color ?? undefined,
    parentCategoryId: row.parent_category_id ?? null,
    displayOrder: row.display_order ?? undefined,
    isHidden: !!row.is_hidden,
    createdAt: row.created_at ?? undefined,
  };
}

export function mapRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash ?? undefined,
    name: row.name ?? undefined,
    role: row.role ?? undefined,
    monthlyIncome: row.monthly_income ?? undefined,
    currentBalance: row.current_balance ?? undefined,
    currency: row.currency ?? undefined,
    language: row.language ?? undefined,
    timezone: row.timezone ?? undefined,
    emailVerified: !!row.email_verified,
    avatarUrl: row.avatar_url ?? undefined,
    budgetRule: row.budget_rule ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function mapTransactionToDb(txn: Transaction) {
  const now = new Date().toISOString();
  return {
    id: txn.id,
    user_id: txn.userId,
    category_id: txn.categoryId ?? null,
    amount: txn.amount,
    type: txn.type,
    date: txn.date,
    description: txn.description ?? null,
    payment_method: txn.paymentMethod ?? null,
    merchant_name: txn.merchantName ?? null,
    merchant_location: txn.merchantLocation ?? null,
    latitude: txn.latitude ?? null,
    longitude: txn.longitude ?? null,
    tags: txn.tags ? txn.tags.join(",") : null,
    is_synced: txn.isSynced ? 1 : 0,
    last_modified_at: txn.lastModifiedAt ?? null,
    updated_at: txn.lastModifiedAt || txn.createdAt || now, // ✅ Đảm bảo có updated_at
    is_deleted: txn.isDeleted ? 1 : 0,
    deleted_at: txn.deletedAt ?? null,
    created_at: txn.createdAt ?? null,
  };
}

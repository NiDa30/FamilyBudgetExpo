export type UUID = string;

export type Money = number; // store in smallest currency unit if needed

export type TimestampISO = string; // ISO 8601

export type TransactionType = "INCOME" | "EXPENSE";

export interface User {
  id: UUID;
  email: string;
  passwordHash?: string;
  name?: string;
  role?: "ADMIN" | "USER";
  monthlyIncome?: Money;
  currentBalance?: Money;
  currency?: string;
  language?: string;
  timezone?: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  budgetRule?: string; // e.g. 50-30-20
  createdAt?: TimestampISO;
  updatedAt?: TimestampISO;
}

export interface Category {
  id: UUID;
  userId?: UUID;
  name: string;
  type: TransactionType;
  isSystemDefault?: boolean;
  icon?: string;
  color?: string;
  parentCategoryId?: UUID | null;
  displayOrder?: number;
  isHidden?: boolean;
  createdAt?: TimestampISO;
}

export interface Transaction {
  id: UUID;
  userId: UUID;
  categoryId?: UUID | null;
  amount: Money;
  type: TransactionType;
  date: TimestampISO; // ISO date string
  description?: string;
  paymentMethod?: string;
  merchantName?: string;
  merchantLocation?: string;
  latitude?: number | null;
  longitude?: number | null;
  tags?: string[];
  isSynced?: boolean;
  lastModifiedAt?: TimestampISO;
  isDeleted?: boolean;
  deletedAt?: TimestampISO | null;
  createdAt?: TimestampISO;
}

export interface Budget {
  id: UUID;
  userId: UUID;
  categoryId: UUID;
  monthYear: string; // YYYY-MM
  budgetAmount: Money;
  spentAmount?: Money;
  warningThreshold?: number; // percent
  createdAt?: TimestampISO;
  updatedAt?: TimestampISO;
}

export interface Goal {
  id: UUID;
  userId: UUID;
  name: string;
  targetAmount: Money;
  savedAmount?: Money;
  startDate: TimestampISO;
  endDate: TimestampISO;
  monthlyContribution?: Money;
  status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt?: TimestampISO;
  updatedAt?: TimestampISO;
}

export interface Reminder {
  id: UUID;
  userId: UUID;
  title: string;
  message?: string;
  type?: string;
  isRead?: boolean;
  scheduledTime?: TimestampISO;
  createdAt?: TimestampISO;
}

export interface SyncLog {
  id: UUID;
  userId: UUID;
  deviceId?: string;
  syncTime: TimestampISO;
  status: "SUCCESS" | "CONFLICT" | "FAILED";
  conflictDetails?: string;
  tableName?: string;
  recordId?: string;
  action?: string;
  createdAt?: TimestampISO;
}

export interface Pagination {
  limit?: number;
  offset?: number;
}

export interface DateRange {
  start: TimestampISO;
  end: TimestampISO;
}

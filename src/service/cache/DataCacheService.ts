// src/service/cache/DataCacheService.ts
// Service để cache dữ liệu và tối ưu đọc/ghi từ Firebase
import { auth } from "../../firebaseConfig";
import databaseService from "../../database/databaseService";
import { Category, Transaction } from "../../domain/types";
import { CategoryRepository, TransactionRepository } from "../../database/repositories";
import { mapRowToTransaction } from "../../domain/mappers";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheConfig {
  categories: { ttl: number }; // Time to live in milliseconds
  transactions: { ttl: number };
  budgets: { ttl: number };
  goals: { ttl: number };
  user: { ttl: number };
}

class DataCacheService {
  private static instance: DataCacheService;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  // Cache configuration - TTL (Time To Live) in milliseconds
  private config: CacheConfig = {
    categories: { ttl: 5 * 60 * 1000 }, // 5 minutes
    transactions: { ttl: 2 * 60 * 1000 }, // 2 minutes
    budgets: { ttl: 5 * 60 * 1000 }, // 5 minutes
    goals: { ttl: 5 * 60 * 1000 }, // 5 minutes
    user: { ttl: 10 * 60 * 1000 }, // 10 minutes
  };

  private constructor() {}

  static getInstance(): DataCacheService {
    if (!DataCacheService.instance) {
      DataCacheService.instance = new DataCacheService();
    }
    return DataCacheService.instance;
  }

  /**
   * Lấy dữ liệu từ cache hoặc load từ SQLite/Firebase
   */
  async get<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Kiểm tra cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`✅ Cache hit: ${key}`);
      return cached.data as T;
    }

    // Kiểm tra xem đang load chưa (tránh duplicate requests)
    const existingPromise = this.loadingPromises.get(key);
    if (existingPromise) {
      console.log(`⏳ Waiting for existing load: ${key}`);
      return existingPromise as Promise<T>;
    }

    // Load dữ liệu
    console.log(`📥 Cache miss, loading: ${key}`);
    const loadPromise = loader()
      .then((data) => {
        // Lưu vào cache
        const configKey = this.getConfigKey(key);
        const cacheTTL = ttl || this.config[configKey]?.ttl || 5 * 60 * 1000;
        this.set(key, data, cacheTTL);
        this.loadingPromises.delete(key);
        return data;
      })
      .catch((error) => {
        this.loadingPromises.delete(key);
        throw error;
      });

    this.loadingPromises.set(key, loadPromise);
    return loadPromise;
  }

  /**
   * Lưu dữ liệu vào cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const configKey = this.getConfigKey(key);
    const cacheTTL = ttl || this.config[configKey]?.ttl || 5 * 60 * 1000;
    const expiresAt = Date.now() + cacheTTL;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt,
    });

    // Notify listeners
    this.notifyListeners(key, data);
  }

  /**
   * Xóa cache
   */
  invalidate(key: string): void {
    console.log(`🗑️ Invalidating cache: ${key}`);
    this.cache.delete(key);
    this.notifyListeners(key, null);
  }

  /**
   * Xóa tất cả cache
   */
  clear(): void {
    console.log("🗑️ Clearing all cache");
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Xóa cache theo pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.invalidate(key));
  }

  /**
   * Đăng ký listener để nhận thông báo khi cache thay đổi
   */
  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Thông báo cho listeners
   */
  private notifyListeners(key: string, data: any): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error("Error in cache listener:", error);
        }
      });
    }
  }

  /**
   * Lấy config key từ cache key
   */
  private getConfigKey(key: string): keyof CacheConfig {
    if (key.startsWith("categories")) return "categories";
    if (key.startsWith("transactions")) return "transactions";
    if (key.startsWith("budgets")) return "budgets";
    if (key.startsWith("goals")) return "goals";
    if (key.startsWith("user")) return "user";
    return "categories"; // default
  }

  // ==================== SPECIFIC CACHE METHODS ====================

  /**
   * Lấy categories từ cache hoặc SQLite
   */
  async getCategories(userId: string, forceRefresh = false): Promise<Category[]> {
    const key = `categories:${userId}`;

    if (forceRefresh) {
      this.invalidate(key);
    }

    return this.get(
      key,
      async () => {
        // Load từ SQLite (nhanh hơn Firebase)
        try {
          await databaseService.ensureInitialized();
          const categories = await CategoryRepository.listByUser(userId);
          console.log(`📋 Loaded ${categories.length} categories from SQLite`);
          return categories;
        } catch (error) {
          console.error("Error loading categories from SQLite:", error);
          throw error;
        }
      },
      this.config.categories.ttl
    );
  }

  /**
   * Lấy transactions từ cache hoặc SQLite
   */
  async getTransactions(
    userId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      type?: "INCOME" | "EXPENSE";
    },
    forceRefresh = false
  ): Promise<Transaction[]> {
    const optionsKey = options
      ? JSON.stringify({
          startDate: options.startDate,
          endDate: options.endDate,
          categoryId: options.categoryId,
          type: options.type,
        })
      : "all";
    const key = `transactions:${userId}:${optionsKey}`;

    if (forceRefresh) {
      this.invalidate(key);
      // Invalidate all transaction caches for this user
      this.invalidatePattern(`transactions:${userId}:.*`);
    }

    return this.get(
      key,
      async () => {
        // Load từ SQLite
        try {
          await databaseService.ensureInitialized();
          const rows = await databaseService.getTransactionsByUser(userId, options || {});
          const transactions = Array.isArray(rows)
            ? rows.map((row: any) => mapRowToTransaction(row))
            : [];
          console.log(`📊 Loaded ${transactions.length} transactions from SQLite`);
          return transactions;
        } catch (error) {
          console.error("Error loading transactions from SQLite:", error);
          throw error;
        }
      },
      this.config.transactions.ttl
    );
  }

  /**
   * Lấy budgets từ cache
   */
  async getBudgets(userId: string, forceRefresh = false): Promise<any[]> {
    const key = `budgets:${userId}`;

    if (forceRefresh) {
      this.invalidate(key);
    }

    return this.get(
      key,
      async () => {
        // Load từ Firebase (budgets thường ít thay đổi)
        try {
          const FirebaseService = (await import("../firebase/FirebaseService")).default;
          const budgets = await FirebaseService.getBudgets(userId);
          console.log(`💰 Loaded ${budgets.length} budgets from Firebase`);
          return budgets;
        } catch (error) {
          console.error("Error loading budgets:", error);
          throw error;
        }
      },
      this.config.budgets.ttl
    );
  }

  /**
   * Lấy goals từ cache
   */
  async getGoals(userId: string, forceRefresh = false): Promise<any[]> {
    const key = `goals:${userId}`;

    if (forceRefresh) {
      this.invalidate(key);
    }

    return this.get(
      key,
      async () => {
        // Load từ Firebase
        try {
          const FirebaseService = (await import("../firebase/FirebaseService")).default;
          const goals = await FirebaseService.getGoals(userId);
          console.log(`🎯 Loaded ${goals.length} goals from Firebase`);
          return goals;
        } catch (error) {
          console.error("Error loading goals:", error);
          throw error;
        }
      },
      this.config.goals.ttl
    );
  }

  /**
   * Lấy user data từ cache
   */
  async getUser(userId: string, forceRefresh = false): Promise<any> {
    const key = `user:${userId}`;

    if (forceRefresh) {
      this.invalidate(key);
    }

    return this.get(
      key,
      async () => {
        // Load từ Firebase
        try {
          const FirebaseService = (await import("../firebase/FirebaseService")).default;
          const user = await FirebaseService.getUser(userId);
          console.log(`👤 Loaded user data from Firebase`);
          return user;
        } catch (error) {
          console.error("Error loading user:", error);
          throw error;
        }
      },
      this.config.user.ttl
    );
  }

  /**
   * Invalidate categories cache
   */
  invalidateCategories(userId: string): void {
    this.invalidate(`categories:${userId}`);
  }

  /**
   * Invalidate transactions cache
   */
  invalidateTransactions(userId: string, options?: any): void {
    if (options) {
      const optionsKey = JSON.stringify(options);
      this.invalidate(`transactions:${userId}:${optionsKey}`);
    } else {
      // Invalidate all transactions for this user
      this.invalidatePattern(`transactions:${userId}:.*`);
    }
  }

  /**
   * Invalidate all caches for a user
   */
  invalidateUser(userId: string): void {
    this.invalidatePattern(`.*:${userId}.*`);
  }

  /**
   * Preload dữ liệu thường dùng
   */
  async preloadCommonData(userId: string): Promise<void> {
    console.log("🚀 Preloading common data...");
    try {
      await Promise.all([
        this.getCategories(userId),
        this.getTransactions(userId, { startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() }),
        this.getBudgets(userId),
        this.getGoals(userId),
      ]);
      console.log("✅ Common data preloaded");
    } catch (error) {
      console.error("Error preloading data:", error);
    }
  }

  /**
   * Get cache stats
   */
  getStats(): {
    size: number;
    keys: string[];
    entries: Array<{ key: string; age: number; expiresIn: number }>;
  } {
    const entries: Array<{ key: string; age: number; expiresIn: number }> = [];
    const now = Date.now();

    this.cache.forEach((entry, key) => {
      entries.push({
        key,
        age: now - entry.timestamp,
        expiresIn: entry.expiresAt - now,
      });
    });

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      entries,
    };
  }
}

export default DataCacheService.getInstance();


// src/context/SharedDataContext.tsx
// Context để chia sẻ dữ liệu giữa các component, tránh load nhiều lần
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { auth } from "../firebaseConfig";
import DataCacheService from "../service/cache/DataCacheService";
import { Category, Transaction } from "../domain/types";

interface SharedDataContextType {
  // Data
  categories: Category[];
  transactions: Transaction[];
  budgets: any[];
  goals: any[];
  user: any;

  // Loading states
  loadingCategories: boolean;
  loadingTransactions: boolean;
  loadingBudgets: boolean;
  loadingGoals: boolean;
  loadingUser: boolean;

  // Refresh functions
  refreshCategories: (force?: boolean) => Promise<void>;
  refreshTransactions: (options?: any, force?: boolean) => Promise<void>;
  refreshBudgets: (force?: boolean) => Promise<void>;
  refreshGoals: (force?: boolean) => Promise<void>;
  refreshUser: (force?: boolean) => Promise<void>;
  refreshAll: (force?: boolean) => Promise<void>;

  // Invalidate functions
  invalidateCategories: () => void;
  invalidateTransactions: () => void;
  invalidateAll: () => void;
}

const SharedDataContext = createContext<SharedDataContextType | undefined>(undefined);

export const useSharedData = () => {
  const context = useContext(SharedDataContext);
  if (!context) {
    throw new Error("useSharedData must be used within SharedDataProvider");
  }
  return context;
};

interface SharedDataProviderProps {
  children: ReactNode;
}

export const SharedDataProvider: React.FC<SharedDataProviderProps> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingBudgets, setLoadingBudgets] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);

  // Load categories
  const refreshCategories = useCallback(async (force = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    setLoadingCategories(true);
    try {
      const data = await DataCacheService.getCategories(currentUser.uid, force);
      setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Load transactions
  const refreshTransactions = useCallback(async (options?: any, force = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    setLoadingTransactions(true);
    try {
      const data = await DataCacheService.getTransactions(currentUser.uid, options, force);
      setTransactions(data);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  // Load budgets
  const refreshBudgets = useCallback(async (force = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    setLoadingBudgets(true);
    try {
      const data = await DataCacheService.getBudgets(currentUser.uid, force);
      setBudgets(data);
    } catch (error) {
      console.error("Error loading budgets:", error);
    } finally {
      setLoadingBudgets(false);
    }
  }, []);

  // Load goals
  const refreshGoals = useCallback(async (force = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    setLoadingGoals(true);
    try {
      const data = await DataCacheService.getGoals(currentUser.uid, force);
      setGoals(data);
    } catch (error) {
      console.error("Error loading goals:", error);
    } finally {
      setLoadingGoals(false);
    }
  }, []);

  // Load user
  const refreshUser = useCallback(async (force = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    setLoadingUser(true);
    try {
      const data = await DataCacheService.getUser(currentUser.uid, force);
      setUser(data);
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  // Refresh all
  const refreshAll = useCallback(async (force = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    console.log("🔄 Refreshing all shared data...");
    await Promise.all([
      refreshCategories(force),
      refreshTransactions(undefined, force),
      refreshBudgets(force),
      refreshGoals(force),
      refreshUser(force),
    ]);
  }, [refreshCategories, refreshTransactions, refreshBudgets, refreshGoals, refreshUser]);

  // Invalidate functions
  const invalidateCategories = useCallback(() => {
    const currentUser = auth.currentUser;
    if (currentUser?.uid) {
      DataCacheService.invalidateCategories(currentUser.uid);
      refreshCategories(true);
    }
  }, [refreshCategories]);

  const invalidateTransactions = useCallback(() => {
    const currentUser = auth.currentUser;
    if (currentUser?.uid) {
      DataCacheService.invalidateTransactions(currentUser.uid);
      refreshTransactions(undefined, true);
    }
  }, [refreshTransactions]);

  const invalidateAll = useCallback(() => {
    const currentUser = auth.currentUser;
    if (currentUser?.uid) {
      DataCacheService.invalidateUser(currentUser.uid);
      refreshAll(true);
    }
  }, [refreshAll]);

  // Subscribe to cache changes
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return;

    // Subscribe to categories cache changes
    const unsubscribeCategories = DataCacheService.subscribe(
      `categories:${currentUser.uid}`,
      (data) => {
        if (data) setCategories(data);
      }
    );

    // Subscribe to transactions cache changes
    const unsubscribeTransactions = DataCacheService.subscribe(
      `transactions:${currentUser.uid}:all`,
      (data) => {
        if (data) setTransactions(data);
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribeTransactions();
    };
  }, []);

  // Initial load
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser?.uid) {
      // Preload common data
      DataCacheService.preloadCommonData(currentUser.uid).then(() => {
        refreshAll(false);
      });
    }
  }, []);

  // Note: useFocusEffect không nên dùng trong Provider
  // Các screen components sẽ tự refresh khi cần thông qua useSharedData()

  const value: SharedDataContextType = {
    categories,
    transactions,
    budgets,
    goals,
    user,
    loadingCategories,
    loadingTransactions,
    loadingBudgets,
    loadingGoals,
    loadingUser,
    refreshCategories,
    refreshTransactions,
    refreshBudgets,
    refreshGoals,
    refreshUser,
    refreshAll,
    invalidateCategories,
    invalidateTransactions,
    invalidateAll,
  };

  return (
    <SharedDataContext.Provider value={value}>
      {children}
    </SharedDataContext.Provider>
  );
};


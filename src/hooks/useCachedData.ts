// src/hooks/useCachedData.ts
// Helper hooks để sử dụng cache dữ liệu dễ dàng hơn

import { useEffect, useState, useCallback } from 'react';
import { auth } from '../firebaseConfig';
import DataCacheService from '../service/cache/DataCacheService';
import { Category, Transaction } from '../domain/types';

/**
 * Hook để load categories từ cache
 */
export const useCachedCategories = (forceRefresh = false) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (force = false) => {
    const user = auth.currentUser;
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await DataCacheService.getCategories(user.uid, force);
      setCategories(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(forceRefresh);
  }, [load, forceRefresh]);

  const refresh = useCallback(() => {
    return load(true);
  }, [load]);

  const invalidate = useCallback(() => {
    const user = auth.currentUser;
    if (user?.uid) {
      DataCacheService.invalidateCategories(user.uid);
      load(true);
    }
  }, [load]);

  return { categories, loading, error, refresh, invalidate };
};

/**
 * Hook để load transactions từ cache
 */
export const useCachedTransactions = (
  options?: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    type?: 'INCOME' | 'EXPENSE';
  },
  forceRefresh = false
) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (force = false) => {
    const user = auth.currentUser;
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await DataCacheService.getTransactions(user.uid, options, force);
      setTransactions(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    load(forceRefresh);
  }, [load, forceRefresh, JSON.stringify(options)]);

  const refresh = useCallback(() => {
    return load(true);
  }, [load]);

  const invalidate = useCallback(() => {
    const user = auth.currentUser;
    if (user?.uid) {
      DataCacheService.invalidateTransactions(user.uid, options);
      load(true);
    }
  }, [load, options]);

  return { transactions, loading, error, refresh, invalidate };
};

/**
 * Hook để load budgets từ cache
 */
export const useCachedBudgets = (forceRefresh = false) => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (force = false) => {
    const user = auth.currentUser;
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await DataCacheService.getBudgets(user.uid, force);
      setBudgets(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error loading budgets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(forceRefresh);
  }, [load, forceRefresh]);

  const refresh = useCallback(() => {
    return load(true);
  }, [load]);

  return { budgets, loading, error, refresh };
};

/**
 * Hook để load goals từ cache
 */
export const useCachedGoals = (forceRefresh = false) => {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (force = false) => {
    const user = auth.currentUser;
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await DataCacheService.getGoals(user.uid, force);
      setGoals(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error loading goals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(forceRefresh);
  }, [load, forceRefresh]);

  const refresh = useCallback(() => {
    return load(true);
  }, [load]);

  return { goals, loading, error, refresh };
};


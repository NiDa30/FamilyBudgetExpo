/**
 * Firestore Collection Names
 * Matches web-admin structure for consistency
 */

export const COLLECTIONS = {
  // Core entities
  USER: "USER",
  CATEGORIES: "CATEGORIES",
  CATEGORIES_DEFAULT: "CATEGORIES_DEFAULT", // ✅ Default categories collection
  TRANSACTIONS: "TRANSACTIONS",
  BUDGET: "BUDGET",
  GOAL: "GOAL",

  // Recurring & History
  RECURRING_TXN: "RECURRING_TXN",
  BUDGET_HISTORY: "BUDGET_HISTORY",
  GOAL_CONTRIBUTION: "GOAL_CONTRIBUTION",

  // System
  SYNC_LOG: "SYNC_LOG",
  ACTIVITY_LOG: "ACTIVITY_LOG", // Activity log collection
  NOTIFICATION: "NOTIFICATION",
  DEVICE: "DEVICE",

  // Media & Attachments
  ATTACHMENT: "ATTACHMENT",

  // Payment & Merchants (Note: Firestore has typos)
  PAYMENT_METHHOD: "PAYMENT_METHHOD", // Typo in Firestore - PAYMENT_METHHOD
  MERCHART: "MERCHART", // Typo in Firestore - MERCHART

  // Tags & Organization
  TAG: "TAG",
  TRANSACTION_TAG: "TRANSACTION_TAG",
  SPLIT_TRANSACTION: "SPLIT_TRANSACTION",

  // Reports & Settings
  REPORT: "REPORT",
  APP_SETTINGS: "APP_SETTINGS",
  CATEGORY_BUDGET_TEMPLATE: "CATEGORY_BUDGET_TEMPLATE",

  // Additional
  expenses: "expenses", // Lowercase collection name
};

// Freeze object to prevent modification
Object.freeze(COLLECTIONS);

// Export default
export default COLLECTIONS;

// Helper: Get all collection names as array
export const getAllCollections = () => Object.values(COLLECTIONS);

// Helper: Check if collection exists
export const isValidCollection = (name) => getAllCollections().includes(name);

// Helper: Get collection count
export const getCollectionCount = () => Object.keys(COLLECTIONS).length;


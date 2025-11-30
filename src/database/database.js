import * as SQLite from "expo-sqlite";

// Open or create database
const db = SQLite.openDatabaseSync("family_budget.db");

// Create all tables based on Firestore structure (Source of Truth)
// Naming Convention: UPPERCASE table names, camelCase column names
db.execSync(`
  PRAGMA foreign_keys = ON;

  -- ============================================
  -- CORE ENTITIES
  -- ============================================

  -- USER table (Firestore: USER)
  CREATE TABLE IF NOT EXISTS USER (
    userID TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'USER',
    accountStatus TEXT DEFAULT 'ACTIVE',
    monthlyIncome REAL DEFAULT 0,
    currentBalance REAL DEFAULT 0,
    failedLoginAttempts INTEGER DEFAULT 0,
    lastLoginTime TEXT,
    currency TEXT DEFAULT 'VND',
    language TEXT DEFAULT 'vi',
    timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    emailVerified BOOLEAN DEFAULT FALSE,
    phoneNumber TEXT,
    avatarURL TEXT,
    budgetRule TEXT DEFAULT '50-30-20',
    createdAt TEXT,
    updatedAt TEXT
  );

  -- CATEGORY table (Firestore: CATEGORIES - User categories)
  CREATE TABLE IF NOT EXISTS CATEGORY (
    categoryID TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
    isSystemDefault BOOLEAN DEFAULT FALSE,
    keywords TEXT,
    icon TEXT,
    color TEXT,
    parentCategoryID TEXT,
    displayOrder INTEGER DEFAULT 0,
    isHidden BOOLEAN DEFAULT FALSE,
    createdAt TEXT,
    FOREIGN KEY (parentCategoryID) REFERENCES CATEGORY(categoryID) ON DELETE SET NULL
  );

  -- CATEGORY_DEFAULT table (Firestore: CATEGORIES_DEFAULT - System default categories)
  CREATE TABLE IF NOT EXISTS CATEGORY_DEFAULT (
    categoryID TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
    isSystemDefault BOOLEAN DEFAULT TRUE,
    keywords TEXT,
    icon TEXT,
    color TEXT,
    parentCategoryID TEXT,
    displayOrder INTEGER DEFAULT 0,
    isHidden BOOLEAN DEFAULT FALSE,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (parentCategoryID) REFERENCES CATEGORY_DEFAULT(categoryID) ON DELETE SET NULL
  );

  -- TRANSACTION table (Firestore: TRANSACTION)
  CREATE TABLE IF NOT EXISTS TRANSACTION (
    transactionID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    categoryID TEXT,
    amount REAL NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
    date TEXT NOT NULL,
    description TEXT,
    paymentMethod TEXT,
    merchantName TEXT,
    merchantLocation TEXT,
    latitude REAL,
    longitude REAL,
    tags TEXT,
    isSynced BOOLEAN DEFAULT FALSE,
    lastModifiedAt TEXT,
    location TEXT,
    isDeleted BOOLEAN DEFAULT FALSE,
    deletedAt TEXT,
    createdBy TEXT,
    hasAttachment BOOLEAN DEFAULT FALSE,
    recurTxnID TEXT,
    parentTransactionID TEXT,
    createdAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (categoryID) REFERENCES CATEGORY(categoryID) ON DELETE SET NULL,
    FOREIGN KEY (parentTransactionID) REFERENCES TRANSACTION(transactionID) ON DELETE SET NULL
  );

  -- BUDGET table (Firestore: BUDGET)
  CREATE TABLE IF NOT EXISTS BUDGET (
    budgetID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    categoryID TEXT NOT NULL,
    monthYear TEXT,
    budgetAmount REAL NOT NULL,
    spentAmount REAL DEFAULT 0,
    warningThreshold INTEGER DEFAULT 80,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (categoryID) REFERENCES CATEGORY(categoryID) ON DELETE CASCADE
  );

  -- GOAL table (Firestore: GOAL)
  CREATE TABLE IF NOT EXISTS GOAL (
    goalID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    name TEXT NOT NULL,
    targetAmount REAL NOT NULL,
    savedAmount REAL DEFAULT 0,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    monthlyContribution REAL DEFAULT 0,
    status TEXT CHECK(status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')) DEFAULT 'ACTIVE',
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- ============================================
  -- RECURRING & HISTORY
  -- ============================================

  -- RECURRING_TXN table (Firestore: RECURRING_TXN)
  CREATE TABLE IF NOT EXISTS RECURRING_TXN (
    recurTxnID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    categoryID TEXT,
    amount REAL NOT NULL,
    frequency TEXT,
    startDate TEXT,
    nextDueDate TEXT,
    description TEXT,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (categoryID) REFERENCES CATEGORY(categoryID) ON DELETE SET NULL
  );

  -- BUDGET_HISTORY table (Firestore: BUDGET_HISTORY)
  CREATE TABLE IF NOT EXISTS BUDGET_HISTORY (
    historyID TEXT PRIMARY KEY,
    budgetID TEXT NOT NULL,
    userID TEXT NOT NULL,
    changeType TEXT,
    oldAmount REAL,
    newAmount REAL,
    oldWarningThreshold INTEGER,
    newWarningThreshold INTEGER,
    reason TEXT,
    notes TEXT,
    changedAt TEXT,
    changedBy TEXT,
    FOREIGN KEY (budgetID) REFERENCES BUDGET(budgetID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- GOAL_CONTRIBUTION table (Firestore: GOAL_CONTRIBUTION)
  CREATE TABLE IF NOT EXISTS GOAL_CONTRIBUTION (
    contributionID TEXT PRIMARY KEY,
    goalID TEXT NOT NULL,
    userID TEXT NOT NULL,
    amount REAL NOT NULL,
    contributionType TEXT,
    sourceTransactionID TEXT,
    note TEXT,
    contributedAt TEXT,
    createdBy TEXT,
    FOREIGN KEY (goalID) REFERENCES GOAL(goalID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (sourceTransactionID) REFERENCES TRANSACTION(transactionID) ON DELETE SET NULL
  );

  -- ============================================
  -- SYSTEM
  -- ============================================

  -- SYNC_LOG table (Firestore: SYNC_LOG)
  CREATE TABLE IF NOT EXISTS SYNC_LOG (
    logID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    deviceID TEXT,
    syncTime TEXT,
    status TEXT CHECK(status IN ('SUCCESS', 'CONFLICT', 'FAILED')),
    conflictDetails TEXT,
    tableName TEXT,
    recordID TEXT,
    action TEXT,
    createdAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- ACTIVITY_LOG table (Firestore: ACTIVITY_LOG)
  CREATE TABLE IF NOT EXISTS ACTIVITY_LOG (
    logID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    targetUserID TEXT,
    timestamp TEXT,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (targetUserID) REFERENCES USER(userID) ON DELETE SET NULL
  );

  -- NOTIFICATION table (Firestore: NOTIFICATION)
  CREATE TABLE IF NOT EXISTS NOTIFICATION (
    notificationID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    type TEXT,
    title TEXT NOT NULL,
    message TEXT,
    isRead BOOLEAN DEFAULT FALSE,
    priority TEXT,
    relatedEntityType TEXT,
    relatedEntityID TEXT,
    actionURL TEXT,
    createdAt TEXT,
    readAt TEXT,
    expiresAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- DEVICE table (Firestore: DEVICE)
  CREATE TABLE IF NOT EXISTS DEVICE (
    deviceID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    deviceUUID TEXT,
    deviceName TEXT,
    deviceType TEXT,
    osVersion TEXT,
    appVersion TEXT,
    fcmToken TEXT,
    isActive BOOLEAN DEFAULT TRUE,
    lastSyncAt TEXT,
    lastActiveAt TEXT,
    createdAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- ============================================
  -- MEDIA & ATTACHMENTS
  -- ============================================

  -- ATTACHMENT table (Firestore: ATTACHMENT)
  CREATE TABLE IF NOT EXISTS ATTACHMENT (
    attachmentID TEXT PRIMARY KEY,
    transactionID TEXT NOT NULL,
    fileURL TEXT,
    fileName TEXT,
    fileType TEXT,
    fileSize INTEGER,
    mimeType TEXT,
    thumbnailURL TEXT,
    ocrRawText TEXT,
    ocrConfidence REAL,
    wasEdited BOOLEAN DEFAULT FALSE,
    uploadedAt TEXT,
    uploadedBy TEXT,
    createdAt TEXT,
    FOREIGN KEY (transactionID) REFERENCES TRANSACTION(transactionID) ON DELETE CASCADE
  );

  -- ============================================
  -- PAYMENT & MERCHANTS
  -- ============================================

  -- PAYMENT_METHOD table (Firestore: PAYMENT_METHHOD - Note: using correct spelling)
  CREATE TABLE IF NOT EXISTS PAYMENT_METHOD (
    methodID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    methodType TEXT,
    name TEXT NOT NULL,
    lastFourDigits TEXT,
    icon TEXT,
    color TEXT,
    isDefault BOOLEAN DEFAULT FALSE,
    isActive BOOLEAN DEFAULT TRUE,
    displayOrder INTEGER DEFAULT 0,
    balance REAL,
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- MERCHANT table (Firestore: MERCHART - Note: using correct spelling)
  CREATE TABLE IF NOT EXISTS MERCHANT (
    merchantID TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    defaultCategoryID TEXT,
    logo TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    phone TEXT,
    website TEXT,
    keywords TEXT,
    usageCount INTEGER DEFAULT 0,
    isVerified BOOLEAN DEFAULT FALSE,
    createdAt TEXT,
    FOREIGN KEY (defaultCategoryID) REFERENCES CATEGORY(categoryID) ON DELETE SET NULL
  );

  -- ============================================
  -- TAGS & ORGANIZATION
  -- ============================================

  -- TAG table (Firestore: TAG)
  CREATE TABLE IF NOT EXISTS TAG (
    tagID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    description TEXT,
    usageCount INTEGER DEFAULT 0,
    createdAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- TRANSACTION_TAG table (Firestore: TRANSACTION_TAG)
  CREATE TABLE IF NOT EXISTS TRANSACTION_TAG (
    id TEXT PRIMARY KEY,
    transactionID TEXT NOT NULL,
    tagID TEXT NOT NULL,
    taggedAt TEXT,
    FOREIGN KEY (transactionID) REFERENCES TRANSACTION(transactionID) ON DELETE CASCADE,
    FOREIGN KEY (tagID) REFERENCES TAG(tagID) ON DELETE CASCADE
  );

  -- SPLIT_TRANSACTION table (Firestore: SPLIT_TRANSACTION)
  CREATE TABLE IF NOT EXISTS SPLIT_TRANSACTION (
    splitID TEXT PRIMARY KEY,
    parentTransactionID TEXT NOT NULL,
    childTransactionID TEXT,
    splitAmount REAL NOT NULL,
    splitPercentage REAL,
    participantName TEXT,
    notes TEXT,
    createdAt TEXT,
    FOREIGN KEY (parentTransactionID) REFERENCES TRANSACTION(transactionID) ON DELETE CASCADE
  );

  -- ============================================
  -- REPORTS & SETTINGS
  -- ============================================

  -- REPORT table (Firestore: REPORT)
  CREATE TABLE IF NOT EXISTS REPORT (
    reportID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    reportType TEXT,
    period TEXT,
    totalIncome REAL,
    totalExpense REAL,
    balance REAL,
    savingsRate REAL,
    transactionCount INTEGER,
    categoryBreakdown TEXT,
    topCategories TEXT,
    comparisonPrevious TEXT,
    insights TEXT,
    generatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- APP_SETTINGS table (Firestore: APP_SETTINGS)
  CREATE TABLE IF NOT EXISTS APP_SETTINGS (
    settingID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    currency TEXT,
    language TEXT,
    timezone TEXT,
    dateFormat TEXT,
    theme TEXT,
    budgetRule TEXT,
    notificationEnabled BOOLEAN DEFAULT TRUE,
    notificationTime TEXT,
    reminderFrequency TEXT,
    biometricEnabled BOOLEAN DEFAULT FALSE,
    autoBackup BOOLEAN DEFAULT FALSE,
    backupFrequency TEXT,
    privacyMode BOOLEAN DEFAULT FALSE,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- CATEGORY_BUDGET_TEMPLATE table (Firestore: CATEGORY_BUDGET_TEMPLATE)
  CREATE TABLE IF NOT EXISTS CATEGORY_BUDGET_TEMPLATE (
    templateID TEXT PRIMARY KEY,
    templateName TEXT NOT NULL,
    description TEXT,
    isSystemDefault BOOLEAN DEFAULT FALSE,
    userID TEXT,
    allocations TEXT,
    createdAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE SET NULL
  );

  -- ============================================
  -- LOCAL ONLY TABLES (Not in Firestore, but useful for offline)
  -- ============================================

  -- Family info table (Local only - for offline data analysis)
  CREATE TABLE IF NOT EXISTS FAMILY_INFO (
    id TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    familyName TEXT,
    memberCount INTEGER,
    primaryIncome REAL,
    secondaryIncome REAL,
    housingType TEXT,
    housingCost REAL,
    location TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- House utilities table (Local only - for offline data analysis)
  CREATE TABLE IF NOT EXISTS HOUSE_UTILITIES (
    id TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    utilityType TEXT,
    monthlyCost REAL,
    provider TEXT,
    billingCycle TEXT,
    isAutopay BOOLEAN DEFAULT FALSE,
    lastPaymentDate TEXT,
    nextPaymentDate TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- Household expenses table (Local only - for offline data analysis)
  CREATE TABLE IF NOT EXISTS HOUSEHOLD_EXPENSES (
    id TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    expenseType TEXT,
    monthlyAmount REAL,
    annualAmount REAL,
    frequency TEXT,
    description TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE
  );

  -- EXPENSES table (Firestore: expenses - lowercase collection name)
  CREATE TABLE IF NOT EXISTS EXPENSES (
    expenseID TEXT PRIMARY KEY,
    userID TEXT NOT NULL,
    categoryID TEXT,
    amount REAL NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
    date TEXT NOT NULL,
    description TEXT,
    paymentMethod TEXT,
    merchantName TEXT,
    merchantLocation TEXT,
    latitude REAL,
    longitude REAL,
    tags TEXT,
    isSynced BOOLEAN DEFAULT FALSE,
    lastModifiedAt TEXT,
    location TEXT,
    isDeleted BOOLEAN DEFAULT FALSE,
    deletedAt TEXT,
    createdBy TEXT,
    hasAttachment BOOLEAN DEFAULT FALSE,
    recurTxnID TEXT,
    parentTransactionID TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (userID) REFERENCES USER(userID) ON DELETE CASCADE,
    FOREIGN KEY (categoryID) REFERENCES CATEGORY(categoryID) ON DELETE SET NULL,
    FOREIGN KEY (parentTransactionID) REFERENCES EXPENSES(expenseID) ON DELETE SET NULL
  );

  -- ============================================
  -- INDEXES FOR PERFORMANCE
  -- ============================================

  CREATE INDEX IF NOT EXISTS idx_transaction_userID ON TRANSACTION(userID);
  CREATE INDEX IF NOT EXISTS idx_transaction_date ON TRANSACTION(date);
  CREATE INDEX IF NOT EXISTS idx_transaction_categoryID ON TRANSACTION(categoryID);
  CREATE INDEX IF NOT EXISTS idx_transaction_isSynced ON TRANSACTION(isSynced);
  CREATE INDEX IF NOT EXISTS idx_budget_userID ON BUDGET(userID);
  CREATE INDEX IF NOT EXISTS idx_budget_monthYear ON BUDGET(monthYear);
  CREATE INDEX IF NOT EXISTS idx_goal_userID ON GOAL(userID);
  CREATE INDEX IF NOT EXISTS idx_goal_status ON GOAL(status);
  CREATE INDEX IF NOT EXISTS idx_attachment_transactionID ON ATTACHMENT(transactionID);
  CREATE INDEX IF NOT EXISTS idx_sync_log_userID ON SYNC_LOG(userID);
  CREATE INDEX IF NOT EXISTS idx_sync_log_status ON SYNC_LOG(status);
  CREATE INDEX IF NOT EXISTS idx_activity_log_userID ON ACTIVITY_LOG(userID);
  CREATE INDEX IF NOT EXISTS idx_activity_log_action ON ACTIVITY_LOG(action);
  CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON ACTIVITY_LOG(timestamp);
  CREATE INDEX IF NOT EXISTS idx_category_default_type ON CATEGORY_DEFAULT(type);
  CREATE INDEX IF NOT EXISTS idx_category_default_isHidden ON CATEGORY_DEFAULT(isHidden);
  CREATE INDEX IF NOT EXISTS idx_recurring_txn_userID ON RECURRING_TXN(userID);
  CREATE INDEX IF NOT EXISTS idx_recurring_txn_nextDueDate ON RECURRING_TXN(nextDueDate);
  CREATE INDEX IF NOT EXISTS idx_notification_userID ON NOTIFICATION(userID);
  CREATE INDEX IF NOT EXISTS idx_notification_isRead ON NOTIFICATION(isRead);
  CREATE INDEX IF NOT EXISTS idx_tag_userID ON TAG(userID);
  CREATE INDEX IF NOT EXISTS idx_transaction_tag_transactionID ON TRANSACTION_TAG(transactionID);
  CREATE INDEX IF NOT EXISTS idx_transaction_tag_tagID ON TRANSACTION_TAG(tagID);
  CREATE INDEX IF NOT EXISTS idx_device_userID ON DEVICE(userID);
  CREATE INDEX IF NOT EXISTS idx_report_userID ON REPORT(userID);
  CREATE INDEX IF NOT EXISTS idx_goal_contribution_goalID ON GOAL_CONTRIBUTION(goalID);
  CREATE INDEX IF NOT EXISTS idx_budget_history_budgetID ON BUDGET_HISTORY(budgetID);
  CREATE INDEX IF NOT EXISTS idx_expenses_userID ON EXPENSES(userID);
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON EXPENSES(date);
  CREATE INDEX IF NOT EXISTS idx_expenses_categoryID ON EXPENSES(categoryID);
  CREATE INDEX IF NOT EXISTS idx_expenses_isSynced ON EXPENSES(isSynced);
`);

// Database service functions
export const DatabaseService = {
  // Initialize database
  initializeDatabase: () => {
    console.log("✅ Database initialized with Firestore-compatible structure");
    return db;
  },

  // Get database instance
  getDB: () => {
    return db;
  },

  // Generic query functions
  executeQuery: (query, params = []) => {
    return db.runSync(query, params);
  },

  getAll: (query, params = []) => {
    return db.getAllSync(query, params);
  },

  getFirst: (query, params = []) => {
    return db.getFirstSync(query, params);
  },

  // Transaction functions
  beginTransaction: () => {
    db.execSync("BEGIN TRANSACTION");
  },

  commitTransaction: () => {
    db.execSync("COMMIT");
  },

  rollbackTransaction: () => {
    db.execSync("ROLLBACK");
  },
};

// Initialize the database
DatabaseService.initializeDatabase();

export default DatabaseService;

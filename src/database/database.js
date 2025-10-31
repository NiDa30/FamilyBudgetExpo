import * as SQLite from "expo-sqlite";

// Open or create database
const db = SQLite.openDatabaseSync("familybudget.db");

// Create all tables based on CSV data structure
db.execSync(`
  PRAGMA foreign_keys = ON;

  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'USER',
    account_status TEXT DEFAULT 'ACTIVE',
    monthly_income REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    last_login_time TEXT,
    currency TEXT DEFAULT 'VND',
    language TEXT DEFAULT 'vi',
    timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_number TEXT,
    avatar_url TEXT,
    budget_rule TEXT DEFAULT '50-30-20',
    created_at TEXT,
    updated_at TEXT
  );

  -- Categories table
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
    is_system_default BOOLEAN DEFAULT FALSE,
    keywords TEXT,
    icon TEXT,
    color TEXT,
    parent_category_id TEXT,
    display_order INTEGER DEFAULT 0,
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  -- Transactions table
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT,
    amount REAL NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
    date TEXT NOT NULL,
    description TEXT,
    payment_method TEXT,
    merchant_name TEXT,
    merchant_location TEXT,
    latitude REAL,
    longitude REAL,
    tags TEXT,
    is_synced BOOLEAN DEFAULT FALSE,
    last_modified_at TEXT,
    location TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TEXT,
    created_by TEXT,
    has_attachment BOOLEAN DEFAULT FALSE,
    recur_txn_id TEXT,
    parent_transaction_id TEXT,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (recur_txn_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
  );

  -- Budgets table
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    month_year TEXT, -- Format: YYYY-MM
    budget_amount REAL NOT NULL,
    spent_amount REAL DEFAULT 0,
    warning_threshold INTEGER DEFAULT 80,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  -- Goals table
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    saved_amount REAL DEFAULT 0,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    monthly_contribution REAL DEFAULT 0,
    status TEXT CHECK(status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')) DEFAULT 'ACTIVE',
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Attachments table
  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    mime_type TEXT,
    thumbnail_url TEXT,
    ocr_raw_text TEXT,
    ocr_confidence REAL,
    was_edited BOOLEAN DEFAULT FALSE,
    uploaded_at TEXT,
    uploaded_by TEXT,
    created_at TEXT,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
  );

  -- Sync logs table
  CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_id TEXT,
    sync_time TEXT,
    status TEXT CHECK(status IN ('SUCCESS', 'CONFLICT', 'FAILED')),
    conflict_details TEXT,
    table_name TEXT,
    record_id TEXT,
    action TEXT,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Additional tables from CSV data

  -- App settings table
  CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Budget history table
  CREATE TABLE IF NOT EXISTS budget_history (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    month_year TEXT,
    budget_amount REAL NOT NULL,
    spent_amount REAL DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  -- Category budget templates table
  CREATE TABLE IF NOT EXISTS category_budget_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    template_name TEXT NOT NULL,
    allocated_percentage REAL,
    allocated_amount REAL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  -- Devices table
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT,
    os_version TEXT,
    app_version TEXT,
    last_sync_time TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Goal contributions table
  CREATE TABLE IF NOT EXISTS goal_contributions (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    transaction_id TEXT,
    amount REAL NOT NULL,
    contribution_date TEXT,
    created_at TEXT,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
  );

  -- Merchants table
  CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT,
    location TEXT,
    latitude REAL,
    longitude REAL,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  -- Notifications table
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    related_transaction_id TEXT,
    related_budget_id TEXT,
    scheduled_time TEXT,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    FOREIGN KEY (related_budget_id) REFERENCES budgets(id) ON DELETE SET NULL
  );

  -- Payment methods table
  CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    icon TEXT,
    color TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Recurring transactions table
  CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT,
    amount REAL NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')),
    description TEXT,
    frequency TEXT, -- DAILY, WEEKLY, MONTHLY, YEARLY
    interval INTEGER DEFAULT 1,
    start_date TEXT,
    end_date TEXT,
    next_occurrence TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  -- Reports table
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT,
    period TEXT,
    start_date TEXT,
    end_date TEXT,
    data_json TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Split transactions table
  CREATE TABLE IF NOT EXISTS split_transactions (
    id TEXT PRIMARY KEY,
    parent_transaction_id TEXT NOT NULL,
    category_id TEXT,
    amount REAL NOT NULL,
    description TEXT,
    created_at TEXT,
    FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  -- Tags table
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Transaction tags table (many-to-many relationship)
  CREATE TABLE IF NOT EXISTS transaction_tags (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  -- Family info table
  CREATE TABLE IF NOT EXISTS family_info (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    family_name TEXT,
    member_count INTEGER,
    primary_income REAL,
    secondary_income REAL,
    housing_type TEXT,
    housing_cost REAL,
    location TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- House utilities table
  CREATE TABLE IF NOT EXISTS house_utilities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    utility_type TEXT,
    monthly_cost REAL,
    provider TEXT,
    billing_cycle TEXT,
    is_autopay BOOLEAN DEFAULT FALSE,
    last_payment_date TEXT,
    next_payment_date TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Household expenses table
  CREATE TABLE IF NOT EXISTS household_expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expense_type TEXT,
    monthly_amount REAL,
    annual_amount REAL,
    frequency TEXT,
    description TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
  CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
  CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_transaction_id ON attachments(transaction_id);
  CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON sync_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_recurring_next_occurrence ON recurring_transactions(next_occurrence);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
`);

// Database service functions
export const DatabaseService = {
  // Initialize database
  initializeDatabase: () => {
    console.log("Database initialized");
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

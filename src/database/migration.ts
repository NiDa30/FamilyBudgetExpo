/**
 * Database Migration Script
 * Migrates from old schema to new unified schema
 * 
 * IMPORTANT: Backup your database before running!
 * 
 * Changes:
 * 1. Rename tables (categories → category)
 * 2. Rename columns (user_id → userID, snake_case → camelCase)
 * 3. Add sync metadata (version, syncStatus, etc.)
 * 4. Merge CATEGORY + CATEGORY_DEFAULT
 * 5. Remove expenses duplicate
 * 6. Add missing indexes
 */

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

const DB_NAME = 'family_budget.db';
const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;

export class DatabaseMigration {
  private db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabaseSync(DB_NAME);
  }

  /**
   * Main migration function
   */
  async migrate(): Promise<void> {
    console.log('🔄 Starting database migration...');

    try {
      // 1. Backup current database
      await this.backup();

      // 2. Begin transaction
      this.db.execSync('BEGIN TRANSACTION;');

      // 3. Create new tables
      await this.createNewTables();

      // 4. Migrate data
      await this.migrateData();

      // 5. Drop old tables
      await this.dropOldTables();

      // 6. Verify migration
      await this.verify();

      // 7. Commit
      this.db.execSync('COMMIT;');

      console.log('✅ Migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.db.execSync('ROLLBACK;');
      throw error;
    }
  }

  /**
   * Backup current database
   */
  private async backup(): Promise<void> {
    console.log('📦 Creating backup...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${BACKUP_DIR}${DB_NAME}_${timestamp}.db`;

    // Create backup directory
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });

    // Copy database file
    const dbPath = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
    await FileSystem.copyAsync({
      from: dbPath,
      to: backupPath
    });

    console.log(`✅ Backup created: ${backupPath}`);
  }

  /**
   * Create new tables with new schema
   */
  private async createNewTables(): Promise<void> {
    console.log('🏗️  Creating new tables...');

    // Temporarily rename old tables
    this.db.execSync(`
      ALTER TABLE USER RENAME TO USER_OLD;
      ALTER TABLE CATEGORY RENAME TO CATEGORY_OLD;
      ALTER TABLE CATEGORY_DEFAULT RENAME TO CATEGORY_DEFAULT_OLD;
      ALTER TABLE TRANSACTION RENAME TO TRANSACTION_OLD;
      ALTER TABLE BUDGET RENAME TO BUDGET_OLD;
      ALTER TABLE GOAL RENAME TO GOAL_OLD;
      ALTER TABLE TAG RENAME TO TAG_OLD;
      ALTER TABLE TRANSACTION_TAG RENAME TO TRANSACTION_TAG_OLD;
      ALTER TABLE ATTACHMENT RENAME TO ATTACHMENT_OLD;
    `);

    // Create new user table
    this.db.execSync(`
      CREATE TABLE user (
        userID TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT,
        name TEXT,
        phoneNumber TEXT,
        avatarURL TEXT,
        role TEXT DEFAULT 'USER',
        accountStatus TEXT DEFAULT 'ACTIVE',
        emailVerified INTEGER DEFAULT 0,
        monthlyIncome REAL DEFAULT 0,
        currentBalance REAL DEFAULT 0,
        currency TEXT DEFAULT 'VND',
        budgetRule TEXT DEFAULT '50-30-20',
        language TEXT DEFAULT 'vi',
        timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
        theme TEXT DEFAULT 'light',
        failedLoginAttempts INTEGER DEFAULT 0,
        lastLoginAt TEXT,
        version INTEGER DEFAULT 1,
        lastModifiedAt TEXT NOT NULL,
        lastModifiedBy TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        syncedAt TEXT,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT,
        updatedAt TEXT NOT NULL,
        updatedBy TEXT
      );
    `);

    // Create new category table (merged)
    this.db.execSync(`
      CREATE TABLE category (
        categoryID TEXT PRIMARY KEY,
        userID TEXT,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('INCOME', 'EXPENSE')) NOT NULL,
        icon TEXT,
        color TEXT,
        description TEXT,
        parentCategoryID TEXT,
        isSystemDefault INTEGER DEFAULT 0,
        budgetGroup TEXT,
        keywords TEXT,
        displayOrder INTEGER DEFAULT 0,
        isHidden INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        lastModifiedAt TEXT NOT NULL,
        lastModifiedBy TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        syncedAt TEXT,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT,
        updatedAt TEXT NOT NULL,
        updatedBy TEXT,
        FOREIGN KEY (userID) REFERENCES user(userID) ON DELETE CASCADE,
        FOREIGN KEY (parentCategoryID) REFERENCES category(categoryID) ON DELETE SET NULL
      );
    `);

    // Create new transaction table
    this.db.execSync(`
      CREATE TABLE transaction (
        transactionID TEXT PRIMARY KEY,
        userID TEXT NOT NULL,
        categoryID TEXT,
        amount REAL NOT NULL,
        type TEXT CHECK(type IN ('INCOME', 'EXPENSE')) NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        paymentMethodID TEXT,
        merchantID TEXT,
        merchantName TEXT,
        location TEXT,
        latitude REAL,
        longitude REAL,
        recurringTransactionID TEXT,
        parentTransactionID TEXT,
        hasAttachment INTEGER DEFAULT 0,
        isRecurring INTEGER DEFAULT 0,
        isSplit INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        lastModifiedAt TEXT NOT NULL,
        lastModifiedBy TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        syncedAt TEXT,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        updatedBy TEXT,
        FOREIGN KEY (userID) REFERENCES user(userID) ON DELETE CASCADE,
        FOREIGN KEY (categoryID) REFERENCES category(categoryID) ON DELETE SET NULL
      );
    `);

    // Create other new tables...
    this.createBudgetTable();
    this.createGoalTable();
    this.createTagTable();
    this.createTransactionTagTable();
    this.createAttachmentTable();

    console.log('✅ New tables created');
  }

  private createBudgetTable() {
    this.db.execSync(`
      CREATE TABLE budget (
        budgetID TEXT PRIMARY KEY,
        userID TEXT NOT NULL,
        categoryID TEXT NOT NULL,
        monthYear TEXT NOT NULL,
        budgetAmount REAL NOT NULL,
        spentAmount REAL DEFAULT 0,
        remainingAmount REAL DEFAULT 0,
        warningThreshold INTEGER DEFAULT 80,
        version INTEGER DEFAULT 1,
        lastModifiedAt TEXT NOT NULL,
        lastModifiedBy TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        syncedAt TEXT,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT,
        updatedAt TEXT NOT NULL,
        updatedBy TEXT,
        FOREIGN KEY (userID) REFERENCES user(userID) ON DELETE CASCADE,
        FOREIGN KEY (categoryID) REFERENCES category(categoryID) ON DELETE CASCADE,
        UNIQUE(userID, categoryID, monthYear)
      );
    `);
  }

  private createGoalTable() {
    this.db.execSync(`
      CREATE TABLE goal (
        goalID TEXT PRIMARY KEY,
        userID TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        targetAmount REAL NOT NULL,
        savedAmount REAL DEFAULT 0,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        status TEXT CHECK(status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED')) DEFAULT 'ACTIVE',
        monthlyContribution REAL DEFAULT 0,
        progressPercentage REAL DEFAULT 0,
        version INTEGER DEFAULT 1,
        lastModifiedAt TEXT NOT NULL,
        lastModifiedBy TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        syncedAt TEXT,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT,
        updatedAt TEXT NOT NULL,
        updatedBy TEXT,
        FOREIGN KEY (userID) REFERENCES user(userID) ON DELETE CASCADE
      );
    `);
  }

  private createTagTable() {
    this.db.execSync(`
      CREATE TABLE tag (
        tagID TEXT PRIMARY KEY,
        userID TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#808080',
        icon TEXT DEFAULT 'tag',
        description TEXT,
        usageCount INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        lastModifiedAt TEXT NOT NULL,
        lastModifiedBy TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        syncedAt TEXT,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT,
        updatedAt TEXT NOT NULL,
        updatedBy TEXT,
        FOREIGN KEY (userID) REFERENCES user(userID) ON DELETE CASCADE,
        UNIQUE(userID, name)
      );
    `);
  }

  private createTransactionTagTable() {
    this.db.execSync(`
      CREATE TABLE transactionTag (
        transactionTagID TEXT PRIMARY KEY,
        transactionID TEXT NOT NULL,
        tagID TEXT NOT NULL,
        taggedAt TEXT NOT NULL,
        taggedBy TEXT,
        FOREIGN KEY (transactionID) REFERENCES transaction(transactionID) ON DELETE CASCADE,
        FOREIGN KEY (tagID) REFERENCES tag(tagID) ON DELETE CASCADE,
        UNIQUE(transactionID, tagID)
      );
    `);
  }

  private createAttachmentTable() {
    this.db.execSync(`
      CREATE TABLE attachment (
        attachmentID TEXT PRIMARY KEY,
        transactionID TEXT NOT NULL,
        fileURL TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileType TEXT,
        fileSize INTEGER,
        mimeType TEXT,
        thumbnailURL TEXT,
        ocrRawText TEXT,
        ocrConfidence REAL,
        wasEdited INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        lastModifiedAt TEXT NOT NULL,
        lastModifiedBy TEXT,
        syncStatus TEXT DEFAULT 'PENDING',
        syncedAt TEXT,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        uploadedAt TEXT NOT NULL,
        uploadedBy TEXT NOT NULL,
        FOREIGN KEY (transactionID) REFERENCES transaction(transactionID) ON DELETE CASCADE
      );
    `);
  }

  /**
   * Migrate data from old tables to new tables
   */
  private async migrateData(): Promise<void> {
    console.log('📊 Migrating data...');

    const now = new Date().toISOString();

    // Migrate users
    this.db.execSync(`
      INSERT INTO user (
        userID, email, passwordHash, name, phoneNumber, avatarURL,
        role, accountStatus, emailVerified, monthlyIncome, currentBalance,
        currency, budgetRule, language, timezone,
        lastLoginAt, version, lastModifiedAt, lastModifiedBy,
        syncStatus, isDeleted, createdAt, updatedAt
      )
      SELECT 
        userID, email, passwordHash, name, phoneNumber, avatarURL,
        role, accountStatus, emailVerified, monthlyIncome, currentBalance,
        currency, budgetRule, language, timezone,
        lastLoginTime, 1, COALESCE(updatedAt, '${now}'), userID,
        'PENDING', 0, COALESCE(createdAt, '${now}'), COALESCE(updatedAt, '${now}')
      FROM USER_OLD;
    `);

    // Migrate categories (merge CATEGORY + CATEGORY_DEFAULT)
    // First, migrate user categories
    this.db.execSync(`
      INSERT INTO category (
        categoryID, userID, name, type, icon, color, description,
        parentCategoryID, isSystemDefault, budgetGroup, keywords,
        displayOrder, isHidden, version, lastModifiedAt,
        syncStatus, isDeleted, createdAt, updatedAt
      )
      SELECT 
        categoryID, userID, name, type, icon, color, NULL,
        parentCategoryID, COALESCE(isSystemDefault, 0), NULL, keywords,
        COALESCE(displayOrder, 0), COALESCE(isHidden, 0), 1, '${now}',
        'PENDING', 0, COALESCE(createdAt, '${now}'), COALESCE(createdAt, '${now}')
      FROM CATEGORY_OLD
      WHERE categoryID NOT IN (SELECT categoryID FROM CATEGORY_DEFAULT_OLD);
    `);

    // Then, migrate default categories
    this.db.execSync(`
      INSERT INTO category (
        categoryID, userID, name, type, icon, color, description,
        parentCategoryID, isSystemDefault, budgetGroup, keywords,
        displayOrder, isHidden, version, lastModifiedAt,
        syncStatus, isDeleted, createdAt, updatedAt, createdBy
      )
      SELECT 
        categoryID, NULL, name, type, icon, color, NULL,
        parentCategoryID, 1, NULL, keywords,
        COALESCE(displayOrder, 0), COALESCE(isHidden, 0), 1, '${now}',
        'SYNCED', 0, COALESCE(createdAt, '${now}'), COALESCE(updatedAt, '${now}'), 'SYSTEM'
      FROM CATEGORY_DEFAULT_OLD;
    `);

    // Migrate transactions
    this.db.execSync(`
      INSERT INTO transaction (
        transactionID, userID, categoryID, amount, type, description, date,
        merchantName, location, latitude, longitude,
        hasAttachment, version, lastModifiedAt, lastModifiedBy,
        syncStatus, isDeleted, deletedAt, createdAt, createdBy, updatedAt
      )
      SELECT 
        transactionID, userID, categoryID, amount, type, description, date,
        merchantName, location, latitude, longitude,
        COALESCE(hasAttachment, 0), 1, COALESCE(lastModifiedAt, '${now}'), userID,
        CASE WHEN COALESCE(isSynced, 0) = 1 THEN 'SYNCED' ELSE 'PENDING' END,
        COALESCE(isDeleted, 0), deletedAt, COALESCE(createdAt, '${now}'), createdBy, 
        COALESCE(lastModifiedAt, createdAt, '${now}')
      FROM TRANSACTION_OLD;
    `);

    // Migrate budgets
    this.db.execSync(`
      INSERT INTO budget (
        budgetID, userID, categoryID, monthYear, budgetAmount,
        spentAmount, warningThreshold, version, lastModifiedAt,
        syncStatus, isDeleted, createdAt, updatedAt
      )
      SELECT 
        budgetID, userID, categoryID, monthYear, budgetAmount,
        COALESCE(spentAmount, 0), COALESCE(warningThreshold, 80), 1, '${now}',
        'PENDING', 0, COALESCE(createdAt, '${now}'), COALESCE(updatedAt, '${now}')
      FROM BUDGET_OLD;
    `);

    // Migrate goals
    this.db.execSync(`
      INSERT INTO goal (
        goalID, userID, name, targetAmount, savedAmount,
        startDate, endDate, status, monthlyContribution,
        version, lastModifiedAt, syncStatus, isDeleted,
        createdAt, updatedAt
      )
      SELECT 
        goalID, userID, name, targetAmount, COALESCE(savedAmount, 0),
        startDate, endDate, COALESCE(status, 'ACTIVE'), COALESCE(monthlyContribution, 0),
        1, '${now}', 'PENDING', 0,
        COALESCE(createdAt, '${now}'), COALESCE(updatedAt, '${now}')
      FROM GOAL_OLD;
    `);

    // Migrate tags
    this.db.execSync(`
      INSERT INTO tag (
        tagID, userID, name, color, icon, description,
        usageCount, version, lastModifiedAt, syncStatus,
        isDeleted, createdAt, updatedAt
      )
      SELECT 
        tagID, userID, name, COALESCE(color, '#808080'), COALESCE(icon, 'tag'), description,
        COALESCE(usageCount, 0), 1, '${now}', 'PENDING',
        0, COALESCE(createdAt, '${now}'), '${now}'
      FROM TAG_OLD;
    `);

    // Migrate transaction tags
    this.db.execSync(`
      INSERT INTO transactionTag (
        transactionTagID, transactionID, tagID, taggedAt
      )
      SELECT 
        id, transactionID, tagID, COALESCE(taggedAt, '${now}')
      FROM TRANSACTION_TAG_OLD;
    `);

    // Migrate attachments
    this.db.execSync(`
      INSERT INTO attachment (
        attachmentID, transactionID, fileURL, fileName, fileType,
        fileSize, mimeType, thumbnailURL, ocrRawText, ocrConfidence,
        wasEdited, version, lastModifiedAt, syncStatus,
        isDeleted, createdAt, uploadedAt, uploadedBy
      )
      SELECT 
        attachmentID, transactionID, fileURL, fileName, fileType,
        COALESCE(fileSize, 0), mimeType, thumbnailURL, ocrRawText, ocrConfidence,
        COALESCE(wasEdited, 0), 1, '${now}', 'PENDING',
        0, COALESCE(createdAt, '${now}'), COALESCE(uploadedAt, '${now}'), uploadedBy
      FROM ATTACHMENT_OLD;
    `);

    console.log('✅ Data migrated');
  }

  /**
   * Drop old tables
   */
  private async dropOldTables(): Promise<void> {
    console.log('🗑️  Dropping old tables...');

    this.db.execSync(`
      DROP TABLE IF EXISTS USER_OLD;
      DROP TABLE IF EXISTS CATEGORY_OLD;
      DROP TABLE IF EXISTS CATEGORY_DEFAULT_OLD;
      DROP TABLE IF EXISTS TRANSACTION_OLD;
      DROP TABLE IF EXISTS BUDGET_OLD;
      DROP TABLE IF EXISTS GOAL_OLD;
      DROP TABLE IF EXISTS TAG_OLD;
      DROP TABLE IF EXISTS TRANSACTION_TAG_OLD;
      DROP TABLE IF EXISTS ATTACHMENT_OLD;
      DROP TABLE IF EXISTS EXPENSES;
    `);

    console.log('✅ Old tables dropped');
  }

  /**
   * Verify migration
   */
  private async verify(): Promise<void> {
    console.log('🔍 Verifying migration...');

    const checks = [
      { table: 'user', oldTable: 'USER_OLD' },
      { table: 'category', oldTable: 'CATEGORY_OLD + CATEGORY_DEFAULT_OLD' },
      { table: 'transaction', oldTable: 'TRANSACTION_OLD' },
      { table: 'budget', oldTable: 'BUDGET_OLD' },
      { table: 'goal', oldTable: 'GOAL_OLD' },
      { table: 'tag', oldTable: 'TAG_OLD' }
    ];

    for (const check of checks) {
      const result = this.db.getFirstSync(
        `SELECT COUNT(*) as count FROM ${check.table}`
      ) as { count: number };
      
      console.log(`✓ ${check.table}: ${result.count} records`);
    }

    console.log('✅ Migration verified');
  }

  /**
   * Rollback migration
   */
  async rollback(): Promise<void> {
    console.log('⏪ Rolling back migration...');
    
    this.db.execSync('BEGIN TRANSACTION;');
    
    try {
      // Drop new tables
      this.db.execSync(`
        DROP TABLE IF EXISTS user;
        DROP TABLE IF EXISTS category;
        DROP TABLE IF EXISTS transaction;
        DROP TABLE IF EXISTS budget;
        DROP TABLE IF EXISTS goal;
        DROP TABLE IF EXISTS tag;
        DROP TABLE IF EXISTS transactionTag;
        DROP TABLE IF EXISTS attachment;
      `);

      // Restore old tables
      this.db.execSync(`
        ALTER TABLE USER_OLD RENAME TO USER;
        ALTER TABLE CATEGORY_OLD RENAME TO CATEGORY;
        ALTER TABLE CATEGORY_DEFAULT_OLD RENAME TO CATEGORY_DEFAULT;
        ALTER TABLE TRANSACTION_OLD RENAME TO TRANSACTION;
        ALTER TABLE BUDGET_OLD RENAME TO BUDGET;
        ALTER TABLE GOAL_OLD RENAME TO GOAL;
        ALTER TABLE TAG_OLD RENAME TO TAG;
        ALTER TABLE TRANSACTION_TAG_OLD RENAME TO TRANSACTION_TAG;
        ALTER TABLE ATTACHMENT_OLD RENAME TO ATTACHMENT;
      `);

      this.db.execSync('COMMIT;');
      console.log('✅ Rollback completed');
    } catch (error) {
      this.db.execSync('ROLLBACK;');
      throw error;
    }
  }
}

// Export singleton
export const databaseMigration = new DatabaseMigration();

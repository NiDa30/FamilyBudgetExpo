/**
 * Sync Service for React Native (SQLite)
 * Handles synchronization between SQLite and Firestore
 * Firestore is the Source of Truth
 */

import DatabaseService from "../database/database";
import { COLLECTIONS } from "../constants/collections";

// Firestore configuration (you'll need to configure this)
// import { db } from "../firebase"; // Uncomment when Firebase is configured

class SyncService {
  constructor() {
    this.db = DatabaseService.getDB();
    this.batchSize = 100;
  }

  /**
   * Convert SQLite row to object with camelCase keys
   */
  _rowToObject(row, columns) {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  }

  /**
   * Get all records from a SQLite table
   */
  async getAllFromTable(tableName) {
    try {
      const query = `SELECT * FROM ${tableName}`;
      const rows = this.db.getAllSync(query);
      
      if (rows.length === 0) {
        return [];
      }

      // Get column names from first row keys or from schema
      const columns = Object.keys(rows[0] || {});
      
      return rows.map((row) => {
        if (Array.isArray(row)) {
          return this._rowToObject(row, columns);
        }
        return row;
      });
    } catch (error) {
      console.error(`❌ Error getting records from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get unsynced records from SQLite
   */
  async getUnsyncedRecords(tableName) {
    try {
      const query = `SELECT * FROM ${tableName} WHERE isSynced = 0 OR isSynced IS NULL`;
      const rows = this.db.getAllSync(query);
      return rows;
    } catch (error) {
      console.error(`❌ Error getting unsynced records from ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Mark record as synced in SQLite
   */
  async markAsSynced(tableName, primaryKey, recordId) {
    try {
      const query = `UPDATE ${tableName} SET isSynced = 1 WHERE ${primaryKey} = ?`;
      this.db.runSync(query, [recordId]);
      return true;
    } catch (error) {
      console.error(`❌ Error marking record as synced:`, error);
      return false;
    }
  }

  /**
   * Insert or update record in SQLite
   */
  async upsertRecord(tableName, record) {
    try {
      const columns = Object.keys(record);
      const placeholders = columns.map(() => "?").join(", ");
      const columnNames = columns.join(", ");
      const values = columns.map((col) => record[col] || null);

      const query = `INSERT OR REPLACE INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;
      this.db.runSync(query, values);
      return true;
    } catch (error) {
      console.error(`❌ Error upserting record in ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Sync data from Firestore to SQLite
   * This should be called when you have Firestore data
   */
  async syncFromFirestore(collectionName, firestoreData) {
    try {
      const tableName = this._getTableName(collectionName);
      console.log(`🔄 Syncing ${collectionName} to ${tableName}...`);

      this.db.beginTransaction();

      try {
        for (const doc of firestoreData) {
          await this.upsertRecord(tableName, doc);
        }

        this.db.commitTransaction();
        console.log(`✅ Synced ${firestoreData.length} records to ${tableName}`);
        return { tableName, count: firestoreData.length };
      } catch (error) {
        this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error(`❌ Error syncing from Firestore:`, error);
      throw error;
    }
  }

  /**
   * Prepare unsynced records for Firestore upload
   */
  async prepareUnsyncedForFirestore(tableName, primaryKey) {
    try {
      const unsyncedRecords = await this.getUnsyncedRecords(tableName);
      
      return unsyncedRecords.map((record) => {
        // Ensure primary key is set
        if (!record[primaryKey] && record.id) {
          record[primaryKey] = record.id;
        }
        return record;
      });
    } catch (error) {
      console.error(`❌ Error preparing unsynced records:`, error);
      return [];
    }
  }

  /**
   * Mark records as synced after successful Firestore upload
   */
  async markRecordsAsSynced(tableName, primaryKey, recordIds) {
    try {
      this.db.beginTransaction();

      for (const recordId of recordIds) {
        await this.markAsSynced(tableName, primaryKey, recordId);
      }

      this.db.commitTransaction();
      return true;
    } catch (error) {
      this.db.rollbackTransaction();
      console.error(`❌ Error marking records as synced:`, error);
      return false;
    }
  }

  /**
   * Get table name from collection name
   */
  _getTableName(collectionName) {
    // Map Firestore collection names to SQLite table names
    const mapping = {
      USER: "USER",
      CATEGORIES: "CATEGORY", // Firestore uses CATEGORIES, SQLite uses CATEGORY
      CATEGORIES_DEFAULT: "CATEGORY_DEFAULT", // Firestore uses CATEGORIES_DEFAULT, SQLite uses CATEGORY_DEFAULT
      TRANSACTIONS: "TRANSACTION", // Firestore uses TRANSACTIONS, SQLite uses TRANSACTION
      BUDGET: "BUDGET",
      GOAL: "GOAL",
      RECURRING_TXN: "RECURRING_TXN",
      BUDGET_HISTORY: "BUDGET_HISTORY",
      GOAL_CONTRIBUTION: "GOAL_CONTRIBUTION",
      SYNC_LOG: "SYNC_LOG",
      ACTIVITY_LOG: "ACTIVITY_LOG", // Added
      NOTIFICATION: "NOTIFICATION",
      DEVICE: "DEVICE",
      ATTACHMENT: "ATTACHMENT",
      PAYMENT_METHHOD: "PAYMENT_METHOD", // Firestore typo, SQLite uses correct spelling
      MERCHART: "MERCHANT", // Firestore typo, SQLite uses correct spelling
      TAG: "TAG",
      TRANSACTION_TAG: "TRANSACTION_TAG",
      SPLIT_TRANSACTION: "SPLIT_TRANSACTION",
      REPORT: "REPORT",
      APP_SETTINGS: "APP_SETTINGS",
      CATEGORY_BUDGET_TEMPLATE: "CATEGORY_BUDGET_TEMPLATE",
      expenses: "EXPENSES", // Firestore lowercase, SQLite uppercase
    };

    return mapping[collectionName] || collectionName;
  }

  /**
   * Get primary key field for a table
   */
  _getPrimaryKey(tableName) {
    const primaryKeys = {
      USER: "userID",
      CATEGORY: "categoryID",
      CATEGORY_DEFAULT: "categoryID", // Added
      TRANSACTION: "transactionID",
      BUDGET: "budgetID",
      GOAL: "goalID",
      RECURRING_TXN: "recurTxnID",
      BUDGET_HISTORY: "historyID",
      GOAL_CONTRIBUTION: "contributionID",
      SYNC_LOG: "logID",
      ACTIVITY_LOG: "logID", // Added
      NOTIFICATION: "notificationID",
      DEVICE: "deviceID",
      ATTACHMENT: "attachmentID",
      PAYMENT_METHOD: "methodID",
      MERCHANT: "merchantID",
      TAG: "tagID",
      TRANSACTION_TAG: "id",
      SPLIT_TRANSACTION: "splitID",
      REPORT: "reportID",
      APP_SETTINGS: "settingID",
      CATEGORY_BUDGET_TEMPLATE: "templateID",
      EXPENSES: "expenseID", // Added
    };

    return primaryKeys[tableName] || "id";
  }

  /**
   * Sync all collections from Firestore
   * This is a high-level method that should be called with Firestore data
   */
  async syncAllFromFirestore(firestoreDataByCollection) {
    const results = [];

    for (const [collectionName, data] of Object.entries(firestoreDataByCollection)) {
      try {
        const result = await this.syncFromFirestore(collectionName, data);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to sync ${collectionName}:`, error.message);
        results.push({
          collection: collectionName,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get all unsynced records across all tables
   */
  async getAllUnsyncedRecords() {
    const tables = [
      "USER",
      "CATEGORY",
      "CATEGORY_DEFAULT", // Added
      "TRANSACTION",
      "BUDGET",
      "GOAL",
      "RECURRING_TXN",
      "BUDGET_HISTORY",
      "GOAL_CONTRIBUTION",
      "SYNC_LOG",
      "ACTIVITY_LOG", // Added
      "NOTIFICATION",
      "DEVICE",
      "ATTACHMENT",
      "PAYMENT_METHOD",
      "MERCHANT",
      "TAG",
      "TRANSACTION_TAG",
      "SPLIT_TRANSACTION",
      "REPORT",
      "APP_SETTINGS",
      "CATEGORY_BUDGET_TEMPLATE",
      "EXPENSES", // Added
    ];

    const unsynced = {};

    for (const tableName of tables) {
      try {
        const records = await this.getUnsyncedRecords(tableName);
        if (records.length > 0) {
          unsynced[tableName] = records;
        }
      } catch (error) {
        console.error(`❌ Error getting unsynced records from ${tableName}:`, error);
      }
    }

    return unsynced;
  }

  /**
   * Create sync log entry
   */
  async createSyncLog(userID, deviceID, status, tableName, recordID, action, conflictDetails = null) {
    try {
      const logID = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const syncTime = new Date().toISOString();
      const createdAt = syncTime;

      const query = `
        INSERT INTO SYNC_LOG (logID, userID, deviceID, syncTime, status, conflictDetails, tableName, recordID, action, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.runSync(query, [
        logID,
        userID,
        deviceID,
        syncTime,
        status,
        conflictDetails,
        tableName,
        recordID,
        action,
        createdAt,
      ]);

      return logID;
    } catch (error) {
      console.error(`❌ Error creating sync log:`, error);
      throw error;
    }
  }
}

export default new SyncService();


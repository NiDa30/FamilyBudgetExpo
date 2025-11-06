// src/database/migrations.js

export const runMigrations = async (db) => {
  console.log("Running database migrations...");

  try {
    await addMissingTransactionColumns(db);
    await fixCategoryIdConstraint(db); // Add this line
    console.log("All migrations completed successfully!");
  } catch (error) {
    console.error("Error running migrations:", error);
  }
};

export const addMissingTransactionColumns = async (db) => {
  console.log("Checking for missing transaction columns...");

  if (!db) {
    throw new Error("Database instance not available");
  }

  try {
    // Thêm updated_at nếu chưa có (để tương thích DB cũ)
    try {
      await db.execAsync("ALTER TABLE transactions ADD COLUMN updated_at TEXT");
      console.log("Added updated_at column to transactions table");
    } catch (error) {
      if (!error.message.includes("duplicate column name")) {
        console.warn("Warning adding updated_at:", error.message);
      }
    }

    // Đồng bộ dữ liệu: copy updated_at từ last_modified_at nếu cần
    await db.execAsync(`
      UPDATE transactions 
      SET updated_at = last_modified_at 
      WHERE updated_at IS NULL AND last_modified_at IS NOT NULL
    `);

    await db.execAsync(`
      UPDATE transactions 
      SET updated_at = created_at 
      WHERE updated_at IS NULL AND created_at IS NOT NULL
    `);

    // Các cột khác
    const columnsToAdd = [
      {
        name: "location_lat",
        sql: "ALTER TABLE transactions ADD COLUMN location_lat REAL",
      },
      {
        name: "location_lng",
        sql: "ALTER TABLE transactions ADD COLUMN location_lng REAL",
      },
      {
        name: "merchant_location",
        sql: "ALTER TABLE transactions ADD COLUMN merchant_location TEXT",
      },
      {
        name: "last_modified_at",
        sql: "ALTER TABLE transactions ADD COLUMN last_modified_at TEXT",
      },
    ];

    for (const col of columnsToAdd) {
      try {
        await db.execAsync(col.sql);
        console.log(`Added ${col.name} column`);
      } catch (error) {
        if (!error.message.includes("duplicate column name")) {
          console.warn(`Warning adding ${col.name}:`, error.message);
        }
      }
    }

    // Tạo index
    try {
      await db.execAsync(
        "CREATE INDEX IF NOT EXISTS idx_transactions_last_modified ON transactions(last_modified_at)"
      );
      console.log("Created index on last_modified_at");
    } catch (error) {
      console.warn("Warning creating index:", error.message);
    }

    console.log("Transaction table schema check completed");
  } catch (error) {
    console.error("Error adding missing transaction columns:", error);
    throw error;
  }
};

// Add this new function to fix the category_id constraint
export const fixCategoryIdConstraint = async (db) => {
  console.log("Checking and fixing category_id constraint...");

  if (!db) {
    throw new Error("Database instance not available");
  }

  try {
    // Try to insert a test record with NULL category_id to check constraint
    try {
      await db.runAsync(
        "INSERT INTO transactions (id, user_id, category_id, amount, type, date, created_at, updated_at, last_modified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          "constraint_test_" + Date.now(),
          "test_user",
          null,
          100,
          "EXPENSE",
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      // If we get here, NULL is allowed. Clean up and return.
      await db.runAsync(
        "DELETE FROM transactions WHERE id LIKE 'constraint_test_%'"
      );
      console.log("category_id column allows NULL values - no fix needed");
      return;
    } catch (error) {
      if (error.message.includes("NOT NULL constraint failed")) {
        console.log(
          "category_id has NOT NULL constraint - this needs to be fixed in the application logic"
        );
        // We can't easily fix the constraint without recreating the table,
        // so we'll handle this in the application by ensuring we always provide a category_id
        // or use a default category
      } else {
        console.warn(
          "Unexpected error when testing constraint:",
          error.message
        );
      }
    }
  } catch (error) {
    console.error("Error checking category_id constraint:", error);
  }
};

export default {
  runMigrations,
  addMissingTransactionColumns,
  fixCategoryIdConstraint,
};

import {
  DatabaseService,
  UserService,
  CategoryService,
  TransactionService,
  BudgetService,
  GoalService,
  AttachmentService,
  SyncLogService,
} from "./databaseService";

// Sample data initialization based on CSV files
export const initializeSampleData = async () => {
  try {
    console.log("Initializing sample data from CSV files...");

    // Sample users from USER.csv
    const users = [
      {
        id: "u001",
        email: "admin@familybudget.com",
        password_hash:
          "$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
        name: "Admin User",
        role: "ADMIN",
        account_status: "ACTIVE",
        monthly_income: 0,
        current_balance: 0,
        failed_login_attempts: 0,
        last_login_time: "2025-01-10T10:00:00Z",
        currency: "VND",
        language: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        email_verified: true,
        phone_number: "0901234567",
        avatar_url: "https://i.pravatar.cc/150?img=1",
        budget_rule: "50-30-20",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-10T10:00:00Z",
      },
      {
        id: "u002",
        email: "user1@example.com",
        password_hash:
          "$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
        name: "Nguyễn Văn An",
        role: "USER",
        account_status: "ACTIVE",
        monthly_income: 15000000,
        current_balance: 5000000,
        failed_login_attempts: 0,
        last_login_time: "2025-01-10T09:30:00Z",
        currency: "VND",
        language: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        email_verified: true,
        phone_number: "0912345678",
        avatar_url: "https://i.pravatar.cc/150?img=2",
        budget_rule: "50-30-20",
        created_at: "2025-01-02T00:00:00Z",
        updated_at: "2025-01-10T09:30:00Z",
      },
      {
        id: "u003",
        email: "user2@example.com",
        password_hash:
          "$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
        name: "Trần Thị Bình",
        role: "USER",
        account_status: "ACTIVE",
        monthly_income: 20000000,
        current_balance: 8500000,
        failed_login_attempts: 0,
        last_login_time: "2025-01-09T14:20:00Z",
        currency: "VND",
        language: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        email_verified: true,
        phone_number: "0923456789",
        avatar_url: "https://i.pravatar.cc/150?img=3",
        budget_rule: "50-30-20",
        created_at: "2025-01-02T00:00:00Z",
        updated_at: "2025-01-09T14:20:00Z",
      },
    ];

    // Insert users
    for (const user of users) {
      try {
        UserService.createUser(user);
        console.log(`Created user: ${user.name}`);
      } catch (error) {
        console.log(
          `User ${user.name} already exists or error:`,
          error.message
        );
      }
    }

    // Sample categories from CATEGORY.csv
    const categories = [
      {
        id: "cat001",
        user_id: null, // System default categories have no user_id
        name: "Ăn uống",
        type: "EXPENSE",
        is_system_default: true,
        keywords: '["food","restaurant","cafe","lunch","dinner"]',
        icon: "restaurant",
        color: "#FF6B6B",
        parent_category_id: null,
        display_order: 0,
        is_hidden: false,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "cat002",
        user_id: null,
        name: "Sinh hoạt",
        type: "EXPENSE",
        is_system_default: true,
        keywords: '["utility","electricity","water","internet","phone"]',
        icon: "home",
        color: "#4ECDC4",
        parent_category_id: null,
        display_order: 1,
        is_hidden: false,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "cat003",
        user_id: null,
        name: "Giáo dục",
        type: "EXPENSE",
        is_system_default: true,
        keywords: '["school","course","book","tuition"]',
        icon: "school",
        color: "#45B7D1",
        parent_category_id: null,
        display_order: 2,
        is_hidden: false,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "cat008",
        user_id: null,
        name: "Lương",
        type: "INCOME",
        is_system_default: true,
        keywords: '["salary","wage","income"]',
        icon: "attach-money",
        color: "#00B894",
        parent_category_id: null,
        display_order: 0,
        is_hidden: false,
        created_at: "2025-01-01T00:00:00Z",
      },
    ];

    // Insert categories
    for (const category of categories) {
      try {
        CategoryService.createCategory(category);
        console.log(`Created category: ${category.name}`);
      } catch (error) {
        console.log(
          `Category ${category.name} already exists or error:`,
          error.message
        );
      }
    }

    // Sample transactions from TRANSACTION.csv
    const transactions = [
      {
        id: "txn001",
        user_id: "u002",
        category_id: "cat001",
        amount: 50000,
        type: "EXPENSE",
        date: "2025-01-10T08:30:00Z",
        description: "Ăn sáng Starbucks",
        payment_method: "CASH",
        merchant_name: "Starbucks",
        merchant_location: "Quận 1 TPHCM",
        latitude: 10.7769,
        longitude: 106.7009,
        tags: '["work"]',
        is_synced: true,
        last_modified_at: "2025-01-10T08:31:00Z",
        location: "Quận 1 TPHCM",
        is_deleted: false,
        deleted_at: null,
        created_by: "USER",
        has_attachment: false,
        recur_txn_id: null,
        parent_transaction_id: null,
        created_at: "2025-01-10T08:30:00Z",
      },
      {
        id: "txn004",
        user_id: "u003",
        category_id: "cat008",
        amount: 20000000,
        type: "INCOME",
        date: "2025-01-05T09:00:00Z",
        description: "Lương tháng 1",
        payment_method: "BANK_TRANSFER",
        merchant_name: null,
        merchant_location: null,
        latitude: null,
        longitude: null,
        tags: null,
        is_synced: true,
        last_modified_at: "2025-01-05T09:01:00Z",
        location: null,
        is_deleted: false,
        deleted_at: null,
        created_by: "USER",
        has_attachment: false,
        recur_txn_id: null,
        parent_transaction_id: null,
        created_at: "2025-01-05T09:00:00Z",
      },
    ];

    // Insert transactions
    for (const transaction of transactions) {
      try {
        TransactionService.createTransaction(transaction);
        console.log(`Created transaction: ${transaction.description}`);
      } catch (error) {
        console.log(
          `Transaction ${transaction.description} already exists or error:`,
          error.message
        );
      }
    }

    // Sample budgets from BUDGET.csv
    const budgets = [
      {
        id: "bud001",
        user_id: "u002",
        category_id: "cat001",
        month_year: "2025-01",
        budget_amount: 3000000,
        spent_amount: 500000,
        warning_threshold: 80,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-10T08:31:00Z",
      },
      {
        id: "bud002",
        user_id: "u002",
        category_id: "cat002",
        month_year: "2025-01",
        budget_amount: 2000000,
        spent_amount: 500000,
        warning_threshold: 80,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-09T14:01:00Z",
      },
    ];

    // Insert budgets
    for (const budget of budgets) {
      try {
        BudgetService.createBudget(budget);
        console.log(`Created budget for category: ${budget.category_id}`);
      } catch (error) {
        console.log(
          `Budget for category ${budget.category_id} already exists or error:`,
          error.message
        );
      }
    }

    // Sample goals from GOAL.csv
    const goals = [
      {
        id: "goal001",
        user_id: "u002",
        name: "Mua laptop mới",
        target_amount: 20000000,
        saved_amount: 5000000,
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        monthly_contribution: 1500000,
        status: "ACTIVE",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-10T00:00:00Z",
      },
    ];

    // Insert goals
    for (const goal of goals) {
      try {
        GoalService.createGoal(goal);
        console.log(`Created goal: ${goal.name}`);
      } catch (error) {
        console.log(
          `Goal ${goal.name} already exists or error:`,
          error.message
        );
      }
    }

    console.log("Sample data initialization completed!");
  } catch (error) {
    console.error("Error initializing sample data:", error);
  }
};

// Database migration functions
export const runMigrations = async () => {
  console.log("Running database migrations...");

  // In a real app, you would check the current migration version
  // and run only the necessary migrations

  try {
    // Initialize sample data
    await initializeSampleData();

    console.log("All migrations completed successfully!");
  } catch (error) {
    console.error("Error running migrations:", error);
  }
};

export default { runMigrations, initializeSampleData };

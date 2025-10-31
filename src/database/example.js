// Example usage of the database services

import {
  UserService,
  CategoryService,
  TransactionService,
  BudgetService,
  GoalService,
  AttachmentService,
  SyncLogService,
} from "./databaseService";

import { generateId, formatDate } from "./utils";

// Example: Create a new user
export const createExampleUser = async () => {
  try {
    const userId = generateId();

    const userData = {
      id: userId,
      email: "newuser@example.com",
      password_hash: "hashed-password-here",
      name: "New User",
      role: "USER",
      account_status: "ACTIVE",
      monthly_income: 15000000,
      current_balance: 5000000,
      currency: "VND",
      language: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      email_verified: true,
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    };

    UserService.createUser(userData);
    console.log("User created successfully:", userData.name);
    return userId;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

// Example: Add a transaction
export const addExampleTransaction = async (userId) => {
  try {
    const transactionId = generateId();

    // First, let's create a category if it doesn't exist
    const categoryId = "cat-food-001";
    try {
      CategoryService.createCategory({
        id: categoryId,
        user_id: userId,
        name: "Ăn uống",
        type: "EXPENSE",
        icon: "restaurant",
        color: "#FF6B6B",
        created_at: formatDate(new Date()),
      });
    } catch (error) {
      // Category might already exist, which is fine
      console.log("Category may already exist, continuing...");
    }

    // Now create the transaction
    const transactionData = {
      id: transactionId,
      user_id: userId,
      category_id: categoryId,
      amount: 150000,
      type: "EXPENSE",
      date: formatDate(new Date()),
      description: "Bữa tối tại nhà hàng",
      payment_method: "CASH",
      merchant_name: "Nhà hàng ABC",
      created_at: formatDate(new Date()),
      last_modified_at: formatDate(new Date()),
      is_synced: false,
    };

    TransactionService.createTransaction(transactionData);
    console.log(
      "Transaction created successfully:",
      transactionData.description
    );
    return transactionId;
  } catch (error) {
    console.error("Error creating transaction:", error);
    throw error;
  }
};

// Example: Set a budget
export const setExampleBudget = async (userId) => {
  try {
    const budgetId = generateId();
    const categoryId = "cat-food-001"; // Using the same category as above

    const budgetData = {
      id: budgetId,
      user_id: userId,
      category_id: categoryId,
      month_year: "2025-01", // January 2025
      budget_amount: 3000000, // 3 million VND budget for food
      warning_threshold: 80, // Warn at 80% of budget
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    };

    BudgetService.createBudget(budgetData);
    console.log("Budget created successfully for category:", categoryId);
    return budgetId;
  } catch (error) {
    console.error("Error creating budget:", error);
    throw error;
  }
};

// Example: Create a savings goal
export const createExampleGoal = async (userId) => {
  try {
    const goalId = generateId();

    const goalData = {
      id: goalId,
      user_id: userId,
      name: "Mua laptop mới",
      target_amount: 20000000, // 20 million VND
      saved_amount: 5000000, // Already saved 5 million
      start_date: formatDate(new Date()),
      end_date: formatDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)), // 1 year from now
      monthly_contribution: 1500000, // Need to save 1.5 million per month
      status: "ACTIVE",
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    };

    GoalService.createGoal(goalData);
    console.log("Savings goal created successfully:", goalData.name);
    return goalId;
  } catch (error) {
    console.error("Error creating goal:", error);
    throw error;
  }
};

// Example: Get user's financial summary
export const getUserFinancialSummary = async (userId) => {
  try {
    // Get user info
    const user = UserService.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get transactions summary
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = new Date();

    const transactionSummary = TransactionService.getTransactionSummary(
      userId,
      formatDate(startDate),
      formatDate(endDate)
    );

    // Get budgets
    const budgets = BudgetService.getBudgetsByUser(userId);

    // Get goals
    const goals = GoalService.getGoalsByUser(userId);

    const summary = {
      user: {
        name: user.name,
        email: user.email,
        monthly_income: user.monthly_income,
        current_balance: user.current_balance,
      },
      transaction_summary: transactionSummary,
      budgets: budgets,
      goals: goals,
    };

    console.log("Financial summary retrieved successfully");
    return summary;
  } catch (error) {
    console.error("Error getting financial summary:", error);
    throw error;
  }
};

// Example usage function
export const runExample = async () => {
  console.log("Running database example...");

  try {
    // Create a user
    const userId = await createExampleUser();

    // Add a transaction
    await addExampleTransaction(userId);

    // Set a budget
    await setExampleBudget(userId);

    // Create a goal
    await createExampleGoal(userId);

    // Get financial summary
    const summary = await getUserFinancialSummary(userId);
    console.log("Financial Summary:", JSON.stringify(summary, null, 2));

    console.log("Database example completed successfully!");
  } catch (error) {
    console.error("Database example failed:", error);
  }
};

// Export all examples
export default {
  createExampleUser,
  addExampleTransaction,
  setExampleBudget,
  createExampleGoal,
  getUserFinancialSummary,
  runExample,
};

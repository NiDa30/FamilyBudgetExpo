import DatabaseService from "./database";
import {
  UserService,
  CategoryService,
  TransactionService,
} from "./databaseService";

// Integration test for the database implementation
export const runIntegrationTest = async () => {
  console.log("Running database integration test...");

  try {
    // Test 1: Database initialization
    console.log("Test 1: Database initialization");
    const db = DatabaseService.getDB();
    if (db) {
      console.log("✓ Database initialized successfully");
    } else {
      throw new Error("Database failed to initialize");
    }

    // Test 2: Create and retrieve user
    console.log("Test 2: User operations");
    const userId = "int-test-user-" + Date.now();
    const userEmail = `integration-test-${Date.now()}@example.com`;

    const testUser = {
      id: userId,
      email: userEmail,
      password_hash: "test-password-hash",
      name: "Integration Test User",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Create user
    UserService.createUser(testUser);
    console.log("✓ User created successfully");

    // Retrieve user
    const retrievedUser = UserService.getUserById(userId);
    if (retrievedUser && retrievedUser.email === userEmail) {
      console.log("✓ User retrieved successfully");
    } else {
      throw new Error("Failed to retrieve user");
    }

    // Test 3: Create and retrieve category
    console.log("Test 3: Category operations");
    const categoryId = "int-test-cat-" + Date.now();

    const testCategory = {
      id: categoryId,
      user_id: userId,
      name: "Integration Test Category",
      type: "EXPENSE",
      is_system_default: false,
      icon: "test-icon",
      color: "#00FF00",
      created_at: new Date().toISOString(),
    };

    // Create category
    CategoryService.createCategory(testCategory);
    console.log("✓ Category created successfully");

    // Retrieve categories
    const categories = CategoryService.getCategoriesByUser(userId);
    if (categories.length > 0) {
      console.log("✓ Categories retrieved successfully");
    } else {
      throw new Error("Failed to retrieve categories");
    }

    // Test 4: Create and retrieve transaction
    console.log("Test 4: Transaction operations");
    const transactionId = "int-test-txn-" + Date.now();

    const testTransaction = {
      id: transactionId,
      user_id: userId,
      category_id: categoryId,
      amount: 250000,
      type: "EXPENSE",
      date: new Date().toISOString(),
      description: "Integration test transaction",
      created_at: new Date().toISOString(),
    };

    // Create transaction
    TransactionService.createTransaction(testTransaction);
    console.log("✓ Transaction created successfully");

    // Retrieve transactions
    const transactions = TransactionService.getTransactionsByUser(userId);
    if (transactions.length > 0) {
      console.log("✓ Transactions retrieved successfully");
    } else {
      throw new Error("Failed to retrieve transactions");
    }

    // Test 5: Test queries with results
    console.log("Test 5: Query operations");
    const transactionSummary = TransactionService.getTransactionSummary(
      userId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      new Date().toISOString()
    );
    console.log(
      `✓ Transaction summary retrieved: ${transactionSummary.length} records`
    );

    // Clean up test data
    console.log("Cleaning up test data...");
    // Note: In a real test, we would clean up, but for now we'll leave the data

    console.log("All integration tests passed!");
    return true;
  } catch (error) {
    console.error("Integration test failed:", error);
    return false;
  }
};

// Run the integration test if this file is executed directly
if (require.main === module) {
  runIntegrationTest().then((success) => {
    if (success) {
      console.log("Integration test completed successfully!");
      process.exit(0);
    } else {
      console.log("Integration test failed!");
      process.exit(1);
    }
  });
}

export default { runIntegrationTest };

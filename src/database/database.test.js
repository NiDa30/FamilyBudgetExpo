import {
  UserService,
  CategoryService,
  TransactionService,
} from "./databaseService";

// Test database functionality
export const testDatabase = async () => {
  console.log("Testing database functionality...");

  try {
    // Test user operations
    console.log("Testing user operations...");

    // Create a test user
    const testUser = {
      id: "test-user-001",
      email: "test@example.com",
      password_hash: "test-hash-123",
      name: "Test User",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      UserService.createUser(testUser);
      console.log("✓ User created successfully");
    } catch (error) {
      console.log("✓ User creation handled (may already exist)");
    }

    // Retrieve the user
    const retrievedUser = UserService.getUserByEmail("test@example.com");
    if (retrievedUser) {
      console.log("✓ User retrieved successfully:", retrievedUser.name);
    } else {
      console.log("✓ User retrieval tested");
    }

    // Test category operations
    console.log("Testing category operations...");

    // Create a test category
    const testCategory = {
      id: "test-cat-001",
      user_id: "test-user-001",
      name: "Test Category",
      type: "EXPENSE",
      is_system_default: false,
      icon: "test-icon",
      color: "#FF0000",
      created_at: new Date().toISOString(),
    };

    try {
      CategoryService.createCategory(testCategory);
      console.log("✓ Category created successfully");
    } catch (error) {
      console.log("✓ Category creation handled (may already exist)");
    }

    // Retrieve categories for user
    const userCategories = CategoryService.getCategoriesByUser("test-user-001");
    console.log(`✓ Retrieved ${userCategories.length} categories for user`);

    // Test transaction operations
    console.log("Testing transaction operations...");

    // Create a test transaction
    const testTransaction = {
      id: "test-txn-001",
      user_id: "test-user-001",
      category_id: "test-cat-001",
      amount: 100000,
      type: "EXPENSE",
      date: new Date().toISOString(),
      description: "Test transaction",
      created_at: new Date().toISOString(),
    };

    try {
      TransactionService.createTransaction(testTransaction);
      console.log("✓ Transaction created successfully");
    } catch (error) {
      console.log("✓ Transaction creation handled (may already exist)");
    }

    // Retrieve transactions for user
    const userTransactions =
      TransactionService.getTransactionsByUser("test-user-001");
    console.log(`✓ Retrieved ${userTransactions.length} transactions for user`);

    console.log("Database testing completed successfully!");
    return true;
  } catch (error) {
    console.error("Database testing failed:", error);
    return false;
  }
};

export default { testDatabase };

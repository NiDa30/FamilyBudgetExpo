# FamilyBudget Expo Database Implementation

This directory contains the SQLite database implementation for the FamilyBudget Expo mobile application.

## Overview

The database implementation provides a local SQLite storage solution for the FamilyBudget mobile app with the following features:

1. **Full SQLite integration** using `expo-sqlite`
2. **Complete schema** matching the Firestore data model from CSV files
3. **CRUD operations** for all entity types
4. **Data synchronization** ready architecture
5. **Sample data initialization**

## Database Schema

The database includes the following tables based on the CSV data files:

### Core Tables

1. **Users** (`users`)

   - Stores user account information
   - Fields: id, email, password_hash, name, role, account_status, monthly_income, current_balance, etc.

2. **Categories** (`categories`)

   - Expense and income categories
   - Supports hierarchical categories with parent-child relationships
   - Fields: id, user_id, name, type, is_system_default, keywords, icon, color, etc.

3. **Transactions** (`transactions`)

   - Financial transactions (income/expense)
   - Complete with merchant info, location, attachments, etc.
   - Fields: id, user_id, category_id, amount, type, date, description, payment_method, etc.

4. **Budgets** (`budgets`)

   - Monthly budget allocations by category
   - Includes spending tracking and warning thresholds
   - Fields: id, user_id, category_id, month_year, budget_amount, spent_amount, warning_threshold, etc.

5. **Goals** (`goals`)

   - Savings goals with targets, timelines, and progress tracking
   - Fields: id, user_id, name, target_amount, saved_amount, start_date, end_date, etc.

6. **Attachments** (`attachments`)

   - Receipt images and documents linked to transactions
   - OCR text storage
   - Fields: id, transaction_id, file_url, file_name, file_type, ocr_raw_text, etc.

7. **Sync Logs** (`sync_logs`)
   - Records of synchronization activities
   - Conflict resolution tracking
   - Fields: id, user_id, device_id, sync_time, status, conflict_details, etc.

### Additional Tables from CSV Data

8. **App Settings** (`app_settings`)

   - User-specific application settings
   - Fields: id, user_id, setting_key, setting_value, etc.

9. **Budget History** (`budget_history`)

   - Historical budget tracking
   - Fields: id, budget_id, user_id, category_id, month_year, budget_amount, spent_amount, etc.

10. **Category Budget Templates** (`category_budget_templates`)

    - Budget templates for category allocations
    - Fields: id, user_id, category_id, template_name, allocated_percentage, etc.

11. **Devices** (`devices`)

    - User device tracking for sync purposes
    - Fields: id, user_id, device_name, device_type, os_version, app_version, etc.

12. **Goal Contributions** (`goal_contributions`)

    - Tracking contributions to savings goals
    - Fields: id, goal_id, transaction_id, amount, contribution_date, etc.

13. **Merchants** (`merchants`)

    - Merchant information and favorites
    - Fields: id, name, category_id, location, latitude, longitude, etc.

14. **Notifications** (`notifications`)

    - User notifications and alerts
    - Fields: id, user_id, title, message, type, is_read, etc.

15. **Payment Methods** (`payment_methods`)

    - User payment method preferences
    - Fields: id, user_id, name, type, is_default, icon, color, etc.

16. **Recurring Transactions** (`recurring_transactions`)

    - Recurring income/expense transactions
    - Fields: id, user_id, category_id, amount, type, frequency, interval, etc.

17. **Reports** (`reports`)

    - Generated financial reports
    - Fields: id, user_id, title, type, period, data_json, etc.

18. **Split Transactions** (`split_transactions`)

    - Transactions split across multiple categories
    - Fields: id, parent_transaction_id, category_id, amount, description, etc.

19. **Tags** (`tags`)

    - User-defined tags for transactions
    - Fields: id, user_id, name, color, etc.

20. **Transaction Tags** (`transaction_tags`)

    - Many-to-many relationship between transactions and tags
    - Fields: id, transaction_id, tag_id, etc.

21. **Family Info** (`family_info`)

    - Family demographic and financial information
    - Fields: id, user_id, family_name, member_count, primary_income, etc.

22. **House Utilities** (`house_utilities`)

    - Household utility tracking
    - Fields: id, user_id, utility_type, monthly_cost, provider, etc.

23. **Household Expenses** (`household_expenses`)
    - Recurring household expenses
    - Fields: id, user_id, expense_type, monthly_amount, annual_amount, etc.

## File Structure

```
src/database/
├── database.js          # Database initialization and connection
├── databaseService.js   # CRUD operations for all entities
├── migrations.js        # Database migrations and sample data
├── utils.js            # Helper functions
├── example.js          # Usage examples
├── database.test.js    # Unit tests
└── integration.test.js # Integration tests
```

## Usage

### Initializing the Database

The database is automatically initialized when the app starts:

```javascript
import DatabaseService from "./database";
// Database is initialized automatically
```

### Using Database Services

```javascript
import { UserService, TransactionService } from "./databaseService";

// Create a user
const userData = {
  id: "user-123",
  email: "user@example.com",
  password_hash: "hashed-password",
  name: "John Doe",
  created_at: new Date().toISOString(),
};

UserService.createUser(userData);

// Create a transaction
const transactionData = {
  id: "txn-456",
  user_id: "user-123",
  amount: 50000,
  type: "EXPENSE",
  date: new Date().toISOString(),
  description: "Coffee purchase",
};

TransactionService.createTransaction(transactionData);
```

## Schema Design

The database schema is designed to match the Firestore collections from the CSV files:

- **Users** → `users` table
- **Categories** → `categories` table
- **Transactions** → `transactions` table
- **Budgets** → `budgets` table
- **Goals** → `goals` table
- **Attachments** → `attachments` table
- **Sync Logs** → `sync_logs` table
- **App Settings** → `app_settings` table
- **Budget History** → `budget_history` table
- **Category Budget Templates** → `category_budget_templates` table
- **Devices** → `devices` table
- **Goal Contributions** → `goal_contributions` table
- **Merchants** → `merchants` table
- **Notifications** → `notifications` table
- **Payment Methods** → `payment_methods` table
- **Recurring Transactions** → `recurring_transactions` table
- **Reports** → `reports` table
- **Split Transactions** → `split_transactions` table
- **Tags** → `tags` table
- **Transaction Tags** → `transaction_tags` table
- **Family Info** → `family_info` table
- **House Utilities** → `house_utilities` table
- **Household Expenses** → `household_expenses` table

## Synchronization

The database is designed to work with a synchronization system:

1. **Offline-first**: All operations work offline
2. **Sync flags**: `is_synced` field tracks what needs to be synced
3. **Conflict resolution**: Sync logs track conflicts
4. **Last-write-wins**: Default conflict resolution strategy

## Testing

The implementation includes:

- Unit tests in `database.test.js`
- Integration tests in `integration.test.js`

Run tests with:

```bash
npm test
```

## Migration

The database includes a migration system that:

1. Creates all tables if they don't exist
2. Initializes sample data from CSV files
3. Can be extended for future schema changes

## Security

- Passwords are stored as hashes (not plain text)
- SQLite database is stored in app sandbox
- No sensitive data is logged

## Performance

- Indexes on frequently queried fields
- Foreign key constraints for data integrity
- Prepared statements for query performance

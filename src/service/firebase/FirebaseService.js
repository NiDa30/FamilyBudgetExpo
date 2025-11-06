import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { dbInstance as db } from "../../firebaseConfig";

class FirebaseService {
  // ==================== USER ====================

  async getUser(userId) {
    const docRef = doc(db, "USERS", userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  async updateUser(userId, data) {
    const docRef = doc(db, "USERS", userId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  }

  // ==================== CATEGORIES ====================

  async getCategories(userId) {
    const q = query(
      collection(db, "CATEGORIES"),
      where("userID", "==", userId),
      where("isHidden", "==", false)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis(),
    }));
  }

  async addCategory(userId, category) {
    const docRef = await addDoc(collection(db, "CATEGORIES"), {
      categoryID: category.id,
      userID: userId,
      name: category.name,
      type: category.type || "EXPENSE",
      icon: category.icon,
      color: category.color,
      isSystemDefault: false,
      isHidden: false,
      displayOrder: 0,
      createdAt: Timestamp.now(),
      keywords: category.name.toLowerCase(),
    });
    return docRef.id;
  }

  async updateCategory(categoryId, updates) {
    const docRef = doc(db, "CATEGORIES", categoryId);
    await updateDoc(docRef, updates);
  }

  async deleteCategory(categoryId) {
    const docRef = doc(db, "CATEGORIES", categoryId);
    await updateDoc(docRef, { isHidden: true });
  }

  // ==================== TRANSACTIONS ====================

  async getTransactions(userId, filters = {}) {
    let q = query(
      collection(db, "TRANSACTIONS"),
      where("userID", "==", userId),
      where("isDeleted", "==", false)
    );

    if (filters.startDate) {
      q = query(
        q,
        where("date", ">=", Timestamp.fromMillis(filters.startDate))
      );
    }
    if (filters.endDate) {
      q = query(q, where("date", "<=", Timestamp.fromMillis(filters.endDate)));
    }
    if (filters.type) {
      q = query(q, where("type", "==", filters.type));
    }

    q = query(q, orderBy("date", "desc"));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toMillis(),
      createdAt: doc.data().createdAt?.toMillis(),
    }));
  }

  async addTransaction(userId, transaction) {
    // Prepare transaction data, filtering out undefined values
    const transactionData = {
      transactionID: transaction.id,
      userID: userId,
      categoryID: transaction.category_id,
      amount: transaction.amount,
      type: transaction.type,
      date: Timestamp.fromMillis(transaction.date),
      description: transaction.description || "",
      paymentMethod: transaction.payment_method,
      merchantName: transaction.merchant_name,
      isSynced: true,
      isDeleted: false,
      createdAt: Timestamp.now(),
      lastModifiedAt: Timestamp.now(),
    };

    // Only add location data if it exists and is not null
    if (
      transaction.location_lat !== undefined &&
      transaction.location_lat !== null &&
      transaction.location_lat !== 0
    ) {
      transactionData.location_lat = transaction.location_lat;
    }

    if (
      transaction.location_lng !== undefined &&
      transaction.location_lng !== null &&
      transaction.location_lng !== 0
    ) {
      transactionData.location_lng = transaction.location_lng;
    }

    const docRef = await addDoc(
      collection(db, "TRANSACTIONS"),
      transactionData
    );
    return docRef.id;
  }

  async updateTransaction(transactionId, updates) {
    const docRef = doc(db, "TRANSACTIONS", transactionId);
    await updateDoc(docRef, {
      ...updates,
      lastModifiedAt: Timestamp.now(),
    });
  }

  async deleteTransaction(transactionId) {
    const docRef = doc(db, "TRANSACTIONS", transactionId);
    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: Timestamp.now(),
    });
  }

  // ==================== BUDGETS ====================

  async getBudgets(userId) {
    const q = query(collection(db, "BUDGETS"), where("userID", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis(),
    }));
  }

  async addBudget(userId, budget) {
    const docRef = await addDoc(collection(db, "BUDGETS"), {
      budgetID: budget.id,
      userID: userId,
      categoryID: budget.category_id,
      monthYear: budget.month_year,
      budgetAmount: budget.amount,
      spentAmount: 0,
      warningThreshold: budget.warning_threshold || 80,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  }

  // ==================== GOALS ====================

  async getGoals(userId) {
    const q = query(collection(db, "GOALS"), where("userID", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      startDate: doc.data().startDate?.toMillis(),
      endDate: doc.data().endDate?.toMillis(),
      createdAt: doc.data().createdAt?.toMillis(),
    }));
  }

  async addGoal(userId, goal) {
    const docRef = await addDoc(collection(db, "GOALS"), {
      goalID: goal.id,
      userID: userId,
      name: goal.name,
      targetAmount: goal.target_amount,
      savedAmount: goal.current_amount || 0,
      startDate: Timestamp.fromMillis(goal.start_date),
      endDate: Timestamp.fromMillis(goal.target_date),
      monthlyContribution: goal.monthly_contribution || 0,
      status: "ACTIVE",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  }

  // ==================== PAYMENT METHODS ====================

  async getPaymentMethods(userId) {
    const q = query(
      collection(db, "PAYMENT_METHODS"),
      where("userID", "==", userId),
      where("isActive", "==", true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  // ==================== BATCH OPERATIONS ====================

  async batchWrite(operations) {
    const batch = writeBatch(db);

    operations.forEach((op) => {
      const docRef = doc(db, op.collection, op.id);

      switch (op.type) {
        case "set":
          batch.set(docRef, op.data);
          break;
        case "update":
          batch.update(docRef, op.data);
          break;
        case "delete":
          batch.delete(docRef);
          break;
      }
    });

    await batch.commit();
  }

  // ==================== SYNC HELPERS ====================

  async getUpdatedRecords(collection, userId, lastSyncTime) {
    const q = query(
      collection(db, collection),
      where("userID", "==", userId),
      where("updatedAt", ">", Timestamp.fromMillis(lastSyncTime))
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async addSyncLog(userId, deviceId, syncData) {
    await addDoc(collection(db, "SYNC_LOGS"), {
      userID: userId,
      deviceID: deviceId,
      syncTime: Timestamp.now(),
      status: syncData.status,
      tableName: syncData.tableName,
      recordID: syncData.recordID,
      action: syncData.action,
      conflictDetails: syncData.conflictDetails || null,
      createdAt: Timestamp.now(),
    });
  }

  // Thêm vào FirebaseService.js
  async getCategoryById(userId, categoryId) {
    const docRef = doc(db, `users/${userId}/categories/${categoryId}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }

  async getTransactionById(userId, transactionId) {
    const docRef = doc(db, `users/${userId}/transactions/${transactionId}`);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }
}

export default new FirebaseService();

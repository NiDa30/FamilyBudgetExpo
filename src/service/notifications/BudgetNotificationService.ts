// src/service/notifications/BudgetNotificationService.ts
// Service để theo dõi và tạo thông báo tự động cho ngân sách và mục tiêu
import { auth, db } from "../../firebaseConfig";
import { collection, query, where, getDocs, addDoc, Timestamp, onSnapshot } from "firebase/firestore";
import { COLLECTIONS } from "../../constants/collections";
import { AnalyticsService } from "../analytics/AnalyticsService";
import NotificationService from "./NotificationService";
import databaseService from "../../database/databaseService";
import FirebaseService from "../firebase/FirebaseService";

export interface BudgetNotification {
  id: string;
  userId: string;
  type: "budget_warning" | "budget_exceeded" | "goal_progress" | "goal_achieved" | "goal_reminder" | "large_expense";
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "critical";
  relatedEntityType: "budget" | "goal" | "transaction";
  relatedEntityId: string;
  metadata?: {
    categoryId?: string;
    categoryName?: string;
    budgetLimit?: number;
    currentSpent?: number;
    percentage?: number;
    goalId?: string;
    goalName?: string;
    progress?: number;
    daysRemaining?: number;
    amount?: number;
    threshold?: number;
  };
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export class BudgetNotificationService {
  private static instance: BudgetNotificationService;
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  private constructor() {}

  static getInstance(): BudgetNotificationService {
    if (!BudgetNotificationService.instance) {
      BudgetNotificationService.instance = new BudgetNotificationService();
    }
    return BudgetNotificationService.instance;
  }

  /**
   * Bắt đầu theo dõi và kiểm tra tự động
   */
  startMonitoring(intervalMinutes: number = 60): void {
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    // Kiểm tra ngay lập tức
    this.checkAndCreateNotifications();

    // Sau đó kiểm tra định kỳ
    this.checkInterval = setInterval(() => {
      this.checkAndCreateNotifications();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Dừng theo dõi
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Kiểm tra và tạo thông báo
   */
  async checkAndCreateNotifications(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      // Kiểm tra ngân sách
      await this.checkBudgetAlerts(user.uid);

      // Kiểm tra mục tiêu
      await this.checkGoalAlerts(user.uid);

      // Kiểm tra chi tiêu lớn
      await this.checkLargeExpenses(user.uid);
    } catch (error) {
      console.error("Error checking notifications:", error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Kiểm tra cảnh báo ngân sách
   */
  private async checkBudgetAlerts(userId: string): Promise<void> {
    try {
      const currentDate = new Date();
      const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

      // Lấy cảnh báo từ AnalyticsService
      const alerts = await AnalyticsService.checkBudgetAlerts(userId, monthYear);

      // Lấy ngưỡng cảnh báo tùy chỉnh
      const settings = NotificationService.getSettings();
      const warningThreshold = settings.customThresholds.budgetWarningPercent || 80;

      for (const alert of alerts) {
        // Kiểm tra xem đã có thông báo cho cảnh báo này chưa (trong 24h)
        const existingNotification = await this.getRecentNotification(
          userId,
          alert.isOverLimit ? "budget_exceeded" : "budget_warning",
          alert.categoryId,
          24 * 60 * 60 * 1000 // 24 hours
        );

        if (existingNotification) continue;

        // Tạo thông báo mới
        const notification: Omit<BudgetNotification, "id" | "createdAt"> = {
          userId,
          type: alert.isOverLimit ? "budget_exceeded" : "budget_warning",
          title: alert.isOverLimit
            ? `⚠️ Vượt ngân sách: ${alert.categoryName}`
            : `⚠️ Cảnh báo ngân sách: ${alert.categoryName}`,
          message: alert.isOverLimit
            ? `Đã chi ${this.formatCurrency(alert.currentSpent)} / ${this.formatCurrency(alert.budgetLimit)} (${alert.percentage.toFixed(1)}%)`
            : `Đã chi ${alert.percentage.toFixed(1)}% ngân sách. Còn ${this.formatCurrency(alert.budgetLimit - alert.currentSpent)}.`,
          priority: alert.isOverLimit ? "critical" : alert.percentage >= 90 ? "high" : "medium",
          relatedEntityType: "budget",
          relatedEntityId: alert.categoryId,
          metadata: {
            categoryId: alert.categoryId,
            categoryName: alert.categoryName,
            budgetLimit: alert.budgetLimit,
            currentSpent: alert.currentSpent,
            percentage: alert.percentage,
          },
          isRead: false,
        };

        await this.createNotification(notification);

        // Gửi push notification
        if (alert.isOverLimit || alert.percentage >= warningThreshold) {
          await NotificationService.sendBudgetAlert(
            alert.categoryName,
            alert.currentSpent,
            alert.budgetLimit,
            alert.percentage
          );
        }
      }
    } catch (error) {
      console.error("Error checking budget alerts:", error);
    }
  }

  /**
   * Kiểm tra cảnh báo mục tiêu
   */
  private async checkGoalAlerts(userId: string): Promise<void> {
    try {
      const goals = await FirebaseService.getGoals(userId);
      const activeGoals = goals.filter((g: any) => g.status === "ACTIVE");

      for (const goal of activeGoals) {
        const targetAmount = goal.targetAmount || goal.target_amount || 0;
        const savedAmount = goal.savedAmount || goal.saved_amount || 0;
        const endDate = goal.endDate ? new Date(goal.endDate) : goal.end_date ? new Date(goal.end_date) : null;
        const goalName = goal.name || "Mục tiêu";

        if (!endDate) continue;

        const progress = targetAmount > 0 ? (savedAmount / targetAmount) * 100 : 0;
        const now = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Kiểm tra đạt mục tiêu
        if (progress >= 100) {
          const existingNotification = await this.getRecentNotification(
            userId,
            "goal_achieved",
            goal.id || goal.goalID,
            7 * 24 * 60 * 60 * 1000 // 7 days
          );

          if (!existingNotification) {
            await this.createNotification({
              userId,
              type: "goal_achieved",
              title: `🎉 Chúc mừng!`,
              message: `Bạn đã đạt được mục tiêu "${goalName}"!`,
              priority: "high",
              relatedEntityType: "goal",
              relatedEntityId: goal.id || goal.goalID,
              metadata: {
                goalId: goal.id || goal.goalID,
                goalName,
                progress: 100,
              },
              isRead: false,
            });

            await NotificationService.sendGoalAchievement(goalName);
          }
        } else {
          // Kiểm tra nhắc nhở tiến độ
          const expectedProgress = ((365 - daysRemaining) / 365) * 100;
          const isBehind = progress < expectedProgress - 10; // Chậm hơn 10%

          if (isBehind && daysRemaining > 0 && daysRemaining <= 30) {
            const existingNotification = await this.getRecentNotification(
              userId,
              "goal_reminder",
              goal.id || goal.goalID,
              3 * 24 * 60 * 60 * 1000 // 3 days
            );

            if (!existingNotification) {
              await this.createNotification({
                userId,
                type: "goal_reminder",
                title: `🎯 Nhắc nhở mục tiêu`,
                message: `${goalName}: ${progress.toFixed(1)}% hoàn thành. Còn ${daysRemaining} ngày.`,
                priority: "medium",
                relatedEntityType: "goal",
                relatedEntityId: goal.id || goal.goalID,
                metadata: {
                  goalId: goal.id || goal.goalID,
                  goalName,
                  progress,
                  daysRemaining,
                },
                isRead: false,
              });

              await NotificationService.sendGoalReminder(goalName, progress, daysRemaining);
            }
          }

          // Cập nhật tiến độ (không tạo thông báo mới nếu chỉ là cập nhật)
          const existingProgressNotification = await this.getRecentNotification(
            userId,
            "goal_progress",
            goal.id || goal.goalID,
            24 * 60 * 60 * 1000 // 24 hours
          );

          if (!existingProgressNotification && progress > 0) {
            await this.createNotification({
              userId,
              type: "goal_progress",
              title: `📊 Cập nhật tiến độ`,
              message: `${goalName}: ${progress.toFixed(1)}% hoàn thành (${this.formatCurrency(savedAmount)} / ${this.formatCurrency(targetAmount)})`,
              priority: "low",
              relatedEntityType: "goal",
              relatedEntityId: goal.id || goal.goalID,
              metadata: {
                goalId: goal.id || goal.goalID,
                goalName,
                progress,
                daysRemaining,
              },
              isRead: false,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error checking goal alerts:", error);
    }
  }

  /**
   * Kiểm tra chi tiêu lớn
   */
  private async checkLargeExpenses(userId: string): Promise<void> {
    try {
      const settings = NotificationService.getSettings();
      const threshold = settings.customThresholds.largeExpenseAmount || 1000000;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      const transactions = await databaseService.getTransactionsByUser(userId, {
        startDate: startOfDay,
        endDate: endOfDay,
        type: "EXPENSE",
      });

      for (const txn of transactions || []) {
        const amount = typeof txn.amount === "number" ? txn.amount : parseFloat(txn.amount) || 0;

        if (amount >= threshold) {
          const existingNotification = await this.getRecentNotification(
            userId,
            "large_expense",
            txn.id || txn.transactionID,
            24 * 60 * 60 * 1000 // 24 hours
          );

          if (!existingNotification) {
            const categoryName = txn.categoryName || "Không phân loại";
            const description = txn.description || "Chi tiêu lớn";

            await this.createNotification({
              userId,
              type: "large_expense",
              title: `💰 Chi tiêu lớn được ghi nhận`,
              message: `${description}: ${this.formatCurrency(amount)} (${categoryName})`,
              priority: "medium",
              relatedEntityType: "transaction",
              relatedEntityId: txn.id || txn.transactionID,
              metadata: {
                amount,
                threshold,
                categoryName,
              },
              isRead: false,
            });

            await NotificationService.sendLargeExpenseAlert(description, amount, categoryName);
          }
        }
      }
    } catch (error) {
      console.error("Error checking large expenses:", error);
    }
  }

  /**
   * Tạo thông báo mới trong Firebase
   */
  private async createNotification(
    notification: Omit<BudgetNotification, "id" | "createdAt">
  ): Promise<void> {
    try {
      const now = Timestamp.now();
      await addDoc(collection(db, COLLECTIONS.NOTIFICATION), {
        userID: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        relatedEntityType: notification.relatedEntityType,
        relatedEntityID: notification.relatedEntityId,
        metadata: notification.metadata || {},
        isRead: notification.isRead,
        createdAt: now,
        readAt: null,
        expiresAt: null,
      });
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  }

  /**
   * Lấy thông báo gần đây để tránh trùng lặp
   */
  private async getRecentNotification(
    userId: string,
    type: BudgetNotification["type"],
    relatedEntityId: string,
    timeWindowMs: number
  ): Promise<BudgetNotification | null> {
    try {
      const now = Date.now();
      const cutoffTime = new Date(now - timeWindowMs);

      const q = query(
        collection(db, COLLECTIONS.NOTIFICATION),
        where("userID", "==", userId),
        where("type", "==", type),
        where("relatedEntityID", "==", relatedEntityId)
      );

      const snapshot = await getDocs(q);
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
        if (createdAt >= cutoffTime.getTime()) {
          return {
            id: doc.id,
            userId: data.userID,
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority,
            relatedEntityType: data.relatedEntityType,
            relatedEntityId: data.relatedEntityID,
            metadata: data.metadata,
            isRead: data.isRead,
            createdAt: new Date(createdAt).toISOString(),
            readAt: data.readAt ? new Date(data.readAt.toMillis ? data.readAt.toMillis() : data.readAt).toISOString() : undefined,
          };
        }
      }
      return null;
    } catch (error) {
      console.error("Error getting recent notification:", error);
      return null;
    }
  }

  /**
   * Lấy tất cả thông báo của user
   */
  async getNotifications(userId: string, limit: number = 100): Promise<BudgetNotification[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATION),
        where("userID", "==", userId)
      );

      const snapshot = await getDocs(q);
      const notifications: BudgetNotification[] = [];

      snapshot.docs
        .sort((a, b) => {
          const aTime = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : new Date(a.data().createdAt).getTime();
          const bTime = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : new Date(b.data().createdAt).getTime();
          return bTime - aTime;
        })
        .slice(0, limit)
        .forEach((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
          notifications.push({
            id: doc.id,
            userId: data.userID,
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority,
            relatedEntityType: data.relatedEntityType,
            relatedEntityId: data.relatedEntityID,
            metadata: data.metadata,
            isRead: data.isRead,
            createdAt: new Date(createdAt).toISOString(),
            readAt: data.readAt ? new Date(data.readAt.toMillis ? data.readAt.toMillis() : data.readAt).toISOString() : undefined,
          });
        });

      return notifications;
    } catch (error) {
      console.error("Error getting notifications:", error);
      return [];
    }
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, COLLECTIONS.NOTIFICATION, notificationId), {
        isRead: true,
        readAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  /**
   * Đánh dấu tất cả đã đọc
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const { updateDoc, doc, getDocs } = await import("firebase/firestore");
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATION),
        where("userID", "==", userId),
        where("isRead", "==", false)
      );

      const snapshot = await getDocs(q);
      const batch = (await import("firebase/firestore")).writeBatch(db);

      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          isRead: true,
          readAt: Timestamp.now(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  }

  /**
   * Xóa thông báo
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const { deleteDoc, doc } = await import("firebase/firestore");
      await deleteDoc(doc(db, COLLECTIONS.NOTIFICATION, notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  /**
   * Xóa tất cả thông báo của user
   */
  async deleteAllNotifications(userId: string): Promise<void> {
    try {
      const { getDocs, deleteDoc, doc } = await import("firebase/firestore");
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATION),
        where("userID", "==", userId)
      );

      const snapshot = await getDocs(q);
      const batch = (await import("firebase/firestore")).writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      throw error;
    }
  }

  /**
   * Xóa các thông báo đã đọc
   */
  async deleteReadNotifications(userId: string): Promise<void> {
    try {
      const { getDocs, deleteDoc } = await import("firebase/firestore");
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATION),
        where("userID", "==", userId),
        where("isRead", "==", true)
      );

      const snapshot = await getDocs(q);
      const batch = (await import("firebase/firestore")).writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error deleting read notifications:", error);
      throw error;
    }
  }

  /**
   * Phân tích nguyên nhân vượt ngân sách
   */
  async analyzeBudgetExceeded(categoryId: string, userId: string): Promise<string> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const transactions = await databaseService.getTransactionsByUser(userId, {
        startDate: monthStart,
        endDate: monthEnd,
        categoryId,
      });

      if (!transactions || transactions.length === 0) {
        return "Không có giao dịch nào trong tháng này.";
      }

      // Tìm giao dịch lớn nhất
      const largeTransactions = transactions
        .map((txn: any) => ({
          amount: typeof txn.amount === "number" ? txn.amount : parseFloat(txn.amount) || 0,
          description: txn.description || "Không có mô tả",
          date: txn.date,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);

      if (largeTransactions.length > 0) {
        const total = transactions.reduce(
          (sum: number, txn: any) => sum + (typeof txn.amount === "number" ? txn.amount : parseFloat(txn.amount) || 0),
          0
        );
        const topTransactionPercent = (largeTransactions[0].amount / total) * 100;

        return `Nguyên nhân chính: ${largeTransactions[0].description} chiếm ${topTransactionPercent.toFixed(1)}% tổng chi tiêu. Tổng cộng ${transactions.length} giao dịch trong tháng.`;
      }

      return "Không thể phân tích nguyên nhân.";
    } catch (error) {
      console.error("Error analyzing budget exceeded:", error);
      return "Lỗi khi phân tích nguyên nhân.";
    }
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  }
}

export default BudgetNotificationService.getInstance();


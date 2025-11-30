// src/service/notifications/NotificationService.ts - Quản lý thông báo đa kênh
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export interface NotificationSettings {
  budgetAlerts: boolean;
  largeExpenseAlerts: boolean;
  goalReminders: boolean;
  backupReminders: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  customThresholds: {
    budgetWarningPercent: number; // Default: 80
    largeExpensePercent: number; // Default: 10% of income
    largeExpenseAmount: number; // Default: 1M VND
  };
}

export interface Notification {
  id: string;
  type: "budget" | "expense" | "goal" | "backup" | "system";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

class NotificationService {
  private static instance: NotificationService;
  private settings: NotificationSettings = {
    budgetAlerts: true,
    largeExpenseAlerts: true,
    goalReminders: true,
    backupReminders: true,
    pushNotifications: true,
    emailNotifications: false,
    smsNotifications: false,
    customThresholds: {
      budgetWarningPercent: 80,
      largeExpensePercent: 10,
      largeExpenseAmount: 1000000,
    },
  };

  private constructor() {
    this.initialize();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initialize() {
    try {
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Request permissions
      if (Platform.OS !== "web") {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          console.warn("Notification permissions not granted");
        }
      }

      // Load settings
      await this.loadSettings();
    } catch (error) {
      console.error("Error initializing NotificationService:", error);
    }
  }

  async loadSettings(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem("notificationSettings");
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    }
  }

  async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem("notificationSettings", JSON.stringify(this.settings));
    } catch (error) {
      console.error("Error saving notification settings:", error);
    }
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  /**
   * Gửi thông báo ngân sách
   */
  async sendBudgetAlert(
    categoryName: string,
    currentSpent: number,
    budgetLimit: number,
    percentage: number
  ): Promise<void> {
    if (!this.settings.budgetAlerts || !this.settings.pushNotifications) return;

    const isOverLimit = percentage >= 100;
    const title = isOverLimit
      ? `⚠️ Vượt ngân sách: ${categoryName}`
      : `⚠️ Cảnh báo ngân sách: ${categoryName}`;
    const message = isOverLimit
      ? `Đã chi ${this.formatCurrency(currentSpent)} / ${this.formatCurrency(budgetLimit)} (${percentage.toFixed(1)}%)`
      : `Đã chi ${percentage.toFixed(1)}% ngân sách. Còn ${this.formatCurrency(budgetLimit - currentSpent)}.`;

    await this.sendPushNotification(title, message, {
      type: "budget",
      categoryName,
      currentSpent,
      budgetLimit,
      percentage,
    });
  }

  /**
   * Gửi thông báo chi tiêu lớn
   */
  async sendLargeExpenseAlert(
    description: string,
    amount: number,
    categoryName: string
  ): Promise<void> {
    if (!this.settings.largeExpenseAlerts || !this.settings.pushNotifications) return;

    const title = "💰 Chi tiêu lớn được ghi nhận";
    const message = `${description}: ${this.formatCurrency(amount)} (${categoryName})`;

    await this.sendPushNotification(title, message, {
      type: "expense",
      description,
      amount,
      categoryName,
    });
  }

  /**
   * Gửi thông báo mục tiêu
   */
  async sendGoalReminder(
    goalName: string,
    progress: number,
    daysRemaining: number
  ): Promise<void> {
    if (!this.settings.goalReminders || !this.settings.pushNotifications) return;

    const title = "🎯 Nhắc nhở mục tiêu";
    const message = `${goalName}: ${progress.toFixed(1)}% hoàn thành. Còn ${daysRemaining} ngày.`;

    await this.sendPushNotification(title, message, {
      type: "goal",
      goalName,
      progress,
      daysRemaining,
    });
  }

  /**
   * Gửi thông báo đạt mục tiêu
   */
  async sendGoalAchievement(goalName: string): Promise<void> {
    if (!this.settings.goalReminders || !this.settings.pushNotifications) return;

    const title = "🎉 Chúc mừng!";
    const message = `Bạn đã đạt được mục tiêu "${goalName}"!`;

    await this.sendPushNotification(title, message, {
      type: "goal",
      goalName,
      achieved: true,
    });
  }

  /**
   * Gửi thông báo sao lưu
   */
  async sendBackupReminder(): Promise<void> {
    if (!this.settings.backupReminders || !this.settings.pushNotifications) return;

    const title = "💾 Nhắc nhở sao lưu";
    const message = "Đã đến lúc sao lưu dữ liệu của bạn. Hãy thực hiện sao lưu để bảo vệ dữ liệu.";

    await this.sendPushNotification(title, message, {
      type: "backup",
    });
  }

  /**
   * Gửi push notification
   */
  private async sendPushNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      if (Platform.OS === "web") {
        // Web notifications
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body, data });
        }
        return;
      }

      // Mobile notifications
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  }

  /**
   * Lên lịch thông báo định kỳ
   */
  async scheduleRecurringNotifications(): Promise<void> {
    if (Platform.OS === "web") return;

    try {
      // Daily budget reminder at 8:00 AM
      if (this.settings.budgetAlerts) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "📊 Kiểm tra ngân sách hôm nay",
            body: "Hãy xem lại chi tiêu của bạn để đảm bảo không vượt ngân sách.",
            sound: true,
          },
          trigger: {
            hour: 8,
            minute: 0,
            repeats: true,
          },
        });
      }

      // Weekly backup reminder on Sunday at 9:00 AM
      if (this.settings.backupReminders) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "💾 Nhắc nhở sao lưu tuần",
            body: "Hãy sao lưu dữ liệu của bạn để đảm bảo an toàn.",
            sound: true,
          },
          trigger: {
            weekday: 0, // Sunday
            hour: 9,
            minute: 0,
            repeats: true,
          },
        });
      }
    } catch (error) {
      console.error("Error scheduling notifications:", error);
    }
  }

  /**
   * Lưu thông báo vào lịch sử
   */
  async saveNotification(notification: Notification): Promise<void> {
    try {
      const history = await this.getNotificationHistory();
      history.unshift(notification);
      // Keep only last 100 notifications
      const limited = history.slice(0, 100);
      await AsyncStorage.setItem("notificationHistory", JSON.stringify(limited));
    } catch (error) {
      console.error("Error saving notification:", error);
    }
  }

  /**
   * Lấy lịch sử thông báo
   */
  async getNotificationHistory(): Promise<Notification[]> {
    try {
      const history = await AsyncStorage.getItem("notificationHistory");
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error("Error loading notification history:", error);
      return [];
    }
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const history = await this.getNotificationHistory();
      const notification = history.find((n) => n.id === notificationId);
      if (notification) {
        notification.read = true;
        await AsyncStorage.setItem("notificationHistory", JSON.stringify(history));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  /**
   * Xóa tất cả thông báo
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await AsyncStorage.removeItem("notificationHistory");
      if (Platform.OS !== "web") {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  }
}

export default NotificationService.getInstance();


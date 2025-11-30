/**
 * Notification Service
 * Handles local and push notifications
 * Supports budget alerts, goal reminders, and transaction reminders
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationConfig {
  title: string;
  body: string;
  data?: any;
  sound?: boolean;
  priority?: 'default' | 'high' | 'max';
  categoryIdentifier?: string;
}

export interface BudgetAlertData {
  categoryID: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
}

export interface GoalReminderData {
  goalID: string;
  goalName: string;
  targetAmount: number;
  savedAmount: number;
  percentage: number;
  deadline?: string;
}

export interface ReminderSchedule {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // HH:mm format
  enabled: boolean;
  message: string;
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
}

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  /**
   * Initialize notification service
   */
  async initialize(): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return false;
      }

      // Get push token
      if (Device.isDevice) {
        this.expoPushToken = await this.registerForPushNotificationsAsync();
      }

      // Setup listeners
      this.setupNotificationListeners();

      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('Notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return false;
    }

    return true;
  }

  /**
   * Register for push notifications
   */
  private async registerForPushNotificationsAsync(): Promise<string | null> {
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo Push Token:', token);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        // Budget alerts channel
        await Notifications.setNotificationChannelAsync('budget-alerts', {
          name: 'Budget Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });

        // Goal reminders channel
        await Notifications.setNotificationChannelAsync('goal-reminders', {
          name: 'Goal Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });

        // Transaction reminders channel
        await Notifications.setNotificationChannelAsync('transaction-reminders', {
          name: 'Transaction Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }

      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Setup notification listeners
   */
  private setupNotificationListeners() {
    // Listener for when notification is received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response);
      const data = response.notification.request.content.data;
      this.handleNotificationResponse(data);
    });
  }

  /**
   * Handle notification tap
   */
  private handleNotificationResponse(data: any) {
    // Navigate to appropriate screen based on notification type
    if (data.type === 'budget_alert' && data.categoryID) {
      // Navigate to category details or budget screen
      console.log('Navigate to budget details:', data.categoryID);
    } else if (data.type === 'goal_reminder' && data.goalID) {
      // Navigate to goal details
      console.log('Navigate to goal details:', data.goalID);
    } else if (data.type === 'transaction_reminder') {
      // Navigate to add transaction screen
      console.log('Navigate to add transaction');
    }
  }

  /**
   * Send budget alert notification
   */
  async sendBudgetAlert(data: BudgetAlertData): Promise<void> {
    const percentage = Math.round(data.percentage);
    const isCritical = percentage >= 100;
    const isWarning = percentage >= 80;

    const config: NotificationConfig = {
      title: isCritical
        ? `🚨 Vượt Ngân sách: ${data.categoryName}`
        : `⚠️ Cảnh báo: ${data.categoryName}`,
      body: `Đã chi ${percentage}% (${this.formatMoney(data.spentAmount)}/${this.formatMoney(data.budgetAmount)})`,
      data: {
        type: 'budget_alert',
        categoryID: data.categoryID,
        categoryName: data.categoryName,
        percentage,
      },
      priority: isCritical ? 'max' : isWarning ? 'high' : 'default',
      categoryIdentifier: 'budget-alerts',
    };

    await this.scheduleNotification(config);
  }

  /**
   * Send goal reminder notification
   */
  async sendGoalReminder(data: GoalReminderData): Promise<void> {
    const percentage = Math.round(data.percentage);
    const isNearComplete = percentage >= 90;
    const emoji = isNearComplete ? '🎯' : '💰';

    const config: NotificationConfig = {
      title: `${emoji} Mục tiêu: ${data.goalName}`,
      body: isNearComplete
        ? `Sắp hoàn thành! Đã đạt ${percentage}% (${this.formatMoney(data.savedAmount)}/${this.formatMoney(data.targetAmount)})`
        : `Tiến độ ${percentage}%. Hãy đóng góp thêm để đạt mục tiêu!`,
      data: {
        type: 'goal_reminder',
        goalID: data.goalID,
        goalName: data.goalName,
        percentage,
      },
      categoryIdentifier: 'goal-reminders',
    };

    await this.scheduleNotification(config);
  }

  /**
   * Send goal achievement notification
   */
  async sendGoalAchievement(goalName: string, amount: number): Promise<void> {
    const config: NotificationConfig = {
      title: '🎉 Chúc mừng!',
      body: `Bạn đã hoàn thành mục tiêu "${goalName}" với ${this.formatMoney(amount)}!`,
      data: {
        type: 'goal_achievement',
        goalName,
        amount,
      },
      priority: 'high',
      categoryIdentifier: 'goal-reminders',
    };

    await this.scheduleNotification(config);
  }

  /**
   * Send large expense alert
   */
  async sendLargeExpenseAlert(amount: number, description: string, threshold: number): Promise<void> {
    const config: NotificationConfig = {
      title: '💸 Chi tiêu lớn phát hiện',
      body: `${this.formatMoney(amount)} - ${description} (Vượt ${this.formatMoney(threshold)})`,
      data: {
        type: 'large_expense',
        amount,
        description,
      },
      priority: 'high',
    };

    await this.scheduleNotification(config);
  }

  /**
   * Schedule daily transaction reminder
   */
  async scheduleDailyReminder(time: string, message?: string): Promise<string> {
    const [hour, minute] = time.split(':').map(Number);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Nhắc nhở ghi chi tiêu',
        body: message || 'Đừng quên ghi nhận chi tiêu hôm nay!',
        data: { type: 'transaction_reminder' },
        sound: true,
        categoryIdentifier: 'transaction-reminders',
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    // Save reminder config
    await this.saveReminderConfig({
      id,
      type: 'daily',
      time,
      enabled: true,
      message: message || 'Đừng quên ghi nhận chi tiêu hôm nay!',
    });

    return id;
  }

  /**
   * Schedule weekly budget review reminder
   */
  async scheduleWeeklyBudgetReview(dayOfWeek: number = 0, time: string = '10:00'): Promise<string> {
    const [hour, minute] = time.split(':').map(Number);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Báo cáo Tuần',
        body: 'Đã đến lúc xem lại chi tiêu tuần này!',
        data: { type: 'weekly_review' },
        categoryIdentifier: 'transaction-reminders',
      },
      trigger: {
        weekday: dayOfWeek + 1, // expo-notifications uses 1-7 (Sunday = 1)
        hour,
        minute,
        repeats: true,
      },
    });

    await this.saveReminderConfig({
      id,
      type: 'weekly',
      time,
      enabled: true,
      message: 'Đã đến lúc xem lại chi tiêu tuần này!',
      daysOfWeek: [dayOfWeek],
    });

    return id;
  }

  /**
   * Schedule monthly goal review
   */
  async scheduleMonthlyGoalReview(dayOfMonth: number = 25, time: string = '09:00'): Promise<string> {
    const [hour, minute] = time.split(':').map(Number);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 Kiểm tra Mục tiêu',
        body: 'Hãy xem lại tiến độ mục tiêu của bạn!',
        data: { type: 'monthly_goal_review' },
        categoryIdentifier: 'goal-reminders',
      },
      trigger: {
        day: dayOfMonth,
        hour,
        minute,
        repeats: true,
      },
    });

    await this.saveReminderConfig({
      id,
      type: 'monthly',
      time,
      enabled: true,
      message: 'Hãy xem lại tiến độ mục tiêu của bạn!',
      dayOfMonth,
    });

    return id;
  }

  /**
   * Schedule custom reminder
   */
  async scheduleCustomReminder(config: Partial<ReminderSchedule>): Promise<string> {
    const reminderConfig: ReminderSchedule = {
      id: '',
      type: config.type || 'custom',
      time: config.time || '20:00',
      enabled: true,
      message: config.message || 'Nhắc nhở',
      ...config,
    };

    const [hour, minute] = reminderConfig.time.split(':').map(Number);
    
    const trigger: any = {
      hour,
      minute,
      repeats: true,
    };

    if (reminderConfig.type === 'weekly' && reminderConfig.daysOfWeek) {
      trigger.weekday = reminderConfig.daysOfWeek[0] + 1;
    } else if (reminderConfig.type === 'monthly' && reminderConfig.dayOfMonth) {
      trigger.day = reminderConfig.dayOfMonth;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Nhắc nhở',
        body: reminderConfig.message,
        data: { type: 'custom_reminder' },
      },
      trigger,
    });

    reminderConfig.id = id;
    await this.saveReminderConfig(reminderConfig);

    return id;
  }

  /**
   * Cancel specific reminder
   */
  async cancelReminder(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
    await this.removeReminderConfig(id);
  }

  /**
   * Cancel all reminders
   */
  async cancelAllReminders(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem('notification_reminders');
  }

  /**
   * Get all scheduled reminders
   */
  async getAllReminders(): Promise<ReminderSchedule[]> {
    try {
      const data = await AsyncStorage.getItem('notification_reminders');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting reminders:', error);
      return [];
    }
  }

  /**
   * Get scheduled notifications count
   */
  async getScheduledNotificationsCount(): Promise<number> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
  }

  /**
   * Send immediate notification
   */
  private async scheduleNotification(config: NotificationConfig): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: config.title,
        body: config.body,
        data: config.data || {},
        sound: config.sound !== false,
        categoryIdentifier: config.categoryIdentifier,
      },
      trigger: null, // Send immediately
    });
  }

  /**
   * Save reminder configuration
   */
  private async saveReminderConfig(config: ReminderSchedule): Promise<void> {
    try {
      const reminders = await this.getAllReminders();
      const updatedReminders = [...reminders.filter(r => r.id !== config.id), config];
      await AsyncStorage.setItem('notification_reminders', JSON.stringify(updatedReminders));
    } catch (error) {
      console.error('Error saving reminder config:', error);
    }
  }

  /**
   * Remove reminder configuration
   */
  private async removeReminderConfig(id: string): Promise<void> {
    try {
      const reminders = await this.getAllReminders();
      const updatedReminders = reminders.filter(r => r.id !== id);
      await AsyncStorage.setItem('notification_reminders', JSON.stringify(updatedReminders));
    } catch (error) {
      console.error('Error removing reminder config:', error);
    }
  }

  /**
   * Format money for display
   */
  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Get push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }
}

export default new NotificationService();

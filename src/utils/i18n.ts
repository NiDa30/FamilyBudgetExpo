// src/utils/i18n.ts - Đa ngôn ngữ (Internationalization)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18n } from "i18n-js";
import * as Localization from "expo-localization";

// Translation files
const translations = {
  vi: {
    // Common
    common: {
      save: "Lưu",
      cancel: "Hủy",
      delete: "Xóa",
      edit: "Sửa",
      close: "Đóng",
      confirm: "Xác nhận",
      loading: "Đang tải...",
      error: "Lỗi",
      success: "Thành công",
      ok: "OK",
    },
    // Reports & Statistics
    reports: {
      title: "Báo cáo & Thống kê",
      totalIncome: "Tổng thu nhập",
      totalExpense: "Tổng chi tiêu",
      balance: "Số dư",
      period: "Kỳ",
      week: "Tuần",
      month: "Tháng",
      quarter: "Quý",
      year: "Năm",
      compare: "So sánh",
      filter: "Lọc",
      export: "Xuất dữ liệu",
      share: "Chia sẻ",
      categoryFilter: "Lọc theo danh mục",
      largeExpenseAlert: "Cảnh báo chi tiêu lớn",
      budgetAlert: "Cảnh báo ngân sách",
      noData: "Chưa có dữ liệu",
      chartDetail: "Chi tiết biểu đồ",
      customReport: "Báo cáo tùy chỉnh",
      forecast: "Dự báo",
      trend: "Xu hướng",
    },
    // Budget & Goals
    budget: {
      title: "Ngân sách & Mục tiêu",
      recommendation: "Gợi ý ngân sách",
      rule: "Quy tắc",
      needs: "Nhu cầu thiết yếu",
      wants: "Chi tiêu linh hoạt",
      savings: "Tiết kiệm & Đầu tư",
      categoryBudget: "Ngân sách theo danh mục",
      setBudget: "Thiết lập ngân sách",
      goal: "Mục tiêu",
      addGoal: "Thêm mục tiêu",
      progress: "Tiến độ",
      daysRemaining: "Còn lại",
      amountRemaining: "Còn thiếu",
      onTrack: "Đúng tiến độ",
      needSpeed: "Cần tăng tốc",
      alert: "Cảnh báo",
      overBudget: "Vượt ngân sách",
      adjustment: "Điều chỉnh",
      suggestion: "Gợi ý",
      trendAnalysis: "Phân tích xu hướng",
    },
    // Backup & Restore
    backup: {
      title: "Sao lưu & Khôi phục",
      autoBackup: "Sao lưu tự động",
      enableAutoBackup: "Bật sao lưu tự động",
      frequency: "Tần suất sao lưu",
      daily: "Hàng ngày",
      weekly: "Hàng tuần",
      monthly: "Hàng tháng",
      manualBackup: "Sao lưu thủ công",
      restore: "Khôi phục",
      lastBackup: "Sao lưu gần nhất",
      backupHistory: "Lịch sử sao lưu",
      storage: "Dung lượng lưu trữ",
      used: "Đã sử dụng",
      description: "Mô tả",
      confirmRestore: "Khôi phục dữ liệu sẽ thay thế toàn bộ dữ liệu hiện tại. Bạn có chắc chắn?",
      backupSuccess: "Đã sao lưu dữ liệu thành công!",
      restoreSuccess: "Đã khôi phục dữ liệu thành công!",
      backupError: "Không thể sao lưu dữ liệu",
      restoreError: "Không thể khôi phục dữ liệu",
    },
    // Settings
    settings: {
      title: "Cài đặt",
      theme: "Chủ đề",
      language: "Ngôn ngữ",
      notifications: "Thông báo",
      security: "Bảo mật",
      about: "Về ứng dụng",
      logout: "Đăng xuất",
      changePassword: "Đổi mật khẩu",
      accountInfo: "Thông tin tài khoản",
    },
  },
  en: {
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      close: "Close",
      confirm: "Confirm",
      loading: "Loading...",
      error: "Error",
      success: "Success",
      ok: "OK",
    },
    reports: {
      title: "Reports & Statistics",
      totalIncome: "Total Income",
      totalExpense: "Total Expense",
      balance: "Balance",
      period: "Period",
      week: "Week",
      month: "Month",
      quarter: "Quarter",
      year: "Year",
      compare: "Compare",
      filter: "Filter",
      export: "Export Data",
      share: "Share",
      categoryFilter: "Filter by Category",
      largeExpenseAlert: "Large Expense Alert",
      budgetAlert: "Budget Alert",
      noData: "No Data",
      chartDetail: "Chart Detail",
      customReport: "Custom Report",
      forecast: "Forecast",
      trend: "Trend",
    },
    budget: {
      title: "Budget & Goals",
      recommendation: "Budget Recommendation",
      rule: "Rule",
      needs: "Essential Needs",
      wants: "Flexible Spending",
      savings: "Savings & Investment",
      categoryBudget: "Category Budget",
      setBudget: "Set Budget",
      goal: "Goal",
      addGoal: "Add Goal",
      progress: "Progress",
      daysRemaining: "Days Remaining",
      amountRemaining: "Amount Remaining",
      onTrack: "On Track",
      needSpeed: "Need to Speed Up",
      alert: "Alert",
      overBudget: "Over Budget",
      adjustment: "Adjustment",
      suggestion: "Suggestion",
      trendAnalysis: "Spending Trend Analysis",
    },
    backup: {
      title: "Backup & Restore",
      autoBackup: "Auto Backup",
      enableAutoBackup: "Enable Auto Backup",
      frequency: "Backup Frequency",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      manualBackup: "Manual Backup",
      restore: "Restore",
      lastBackup: "Last Backup",
      backupHistory: "Backup History",
      storage: "Storage",
      used: "Used",
      description: "Description",
      confirmRestore: "Restoring data will replace all current data. Are you sure?",
      backupSuccess: "Backup completed successfully!",
      restoreSuccess: "Restore completed successfully!",
      backupError: "Failed to backup data",
      restoreError: "Failed to restore data",
    },
    settings: {
      title: "Settings",
      theme: "Theme",
      language: "Language",
      notifications: "Notifications",
      security: "Security",
      about: "About",
      logout: "Logout",
      changePassword: "Change Password",
      accountInfo: "Account Info",
    },
  },
  ja: {
    common: {
      save: "保存",
      cancel: "キャンセル",
      delete: "削除",
      edit: "編集",
      close: "閉じる",
      confirm: "確認",
      loading: "読み込み中...",
      error: "エラー",
      success: "成功",
      ok: "OK",
    },
    reports: {
      title: "レポート & 統計",
      totalIncome: "総収入",
      totalExpense: "総支出",
      balance: "残高",
      period: "期間",
      week: "週",
      month: "月",
      quarter: "四半期",
      year: "年",
      compare: "比較",
      filter: "フィルター",
      export: "データエクスポート",
      share: "共有",
      categoryFilter: "カテゴリでフィルター",
      largeExpenseAlert: "大きな支出の警告",
      budgetAlert: "予算の警告",
      noData: "データなし",
      chartDetail: "グラフの詳細",
      customReport: "カスタムレポート",
      forecast: "予測",
      trend: "トレンド",
    },
    budget: {
      title: "予算 & 目標",
      recommendation: "予算の推奨",
      rule: "ルール",
      needs: "必須ニーズ",
      wants: "柔軟な支出",
      savings: "貯蓄 & 投資",
      categoryBudget: "カテゴリ別予算",
      setBudget: "予算を設定",
      goal: "目標",
      addGoal: "目標を追加",
      progress: "進捗",
      daysRemaining: "残り日数",
      amountRemaining: "残り金額",
      onTrack: "順調",
      needSpeed: "加速が必要",
      alert: "警告",
      overBudget: "予算超過",
      adjustment: "調整",
      suggestion: "提案",
      trendAnalysis: "支出傾向分析",
    },
    backup: {
      title: "バックアップ & 復元",
      autoBackup: "自動バックアップ",
      enableAutoBackup: "自動バックアップを有効化",
      frequency: "バックアップ頻度",
      daily: "毎日",
      weekly: "毎週",
      monthly: "毎月",
      manualBackup: "手動バックアップ",
      restore: "復元",
      lastBackup: "最後のバックアップ",
      backupHistory: "バックアップ履歴",
      storage: "ストレージ",
      used: "使用済み",
      description: "説明",
      confirmRestore: "データを復元すると、現在のすべてのデータが置き換えられます。よろしいですか？",
      backupSuccess: "バックアップが正常に完了しました！",
      restoreSuccess: "復元が正常に完了しました！",
      backupError: "データのバックアップに失敗しました",
      restoreError: "データの復元に失敗しました",
    },
    settings: {
      title: "設定",
      theme: "テーマ",
      language: "言語",
      notifications: "通知",
      security: "セキュリティ",
      about: "アプリについて",
      logout: "ログアウト",
      changePassword: "パスワードを変更",
      accountInfo: "アカウント情報",
    },
  },
};

// Initialize i18n
const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = "vi";

// Load saved language preference
const loadLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem("app_language");
    if (savedLanguage) {
      i18n.locale = savedLanguage;
    } else {
      // Use device locale
      const deviceLocale = Localization.locale.split("-")[0];
      i18n.locale = translations[deviceLocale as keyof typeof translations] ? deviceLocale : "vi";
    }
  } catch (error) {
    console.error("Error loading language:", error);
    i18n.locale = "vi";
  }
};

// Save language preference
const setLanguage = async (locale: string) => {
  try {
    await AsyncStorage.setItem("app_language", locale);
    i18n.locale = locale;
  } catch (error) {
    console.error("Error saving language:", error);
  }
};

// Get current language
const getCurrentLanguage = () => i18n.locale;

// Get available languages
const getAvailableLanguages = () => [
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
];

// Initialize on import
loadLanguage();

export { i18n, setLanguage, getCurrentLanguage, getAvailableLanguages };
export default i18n;


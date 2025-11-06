import { Alert, Linking, Share } from "react-native";

/**
 * Chia sẻ ứng dụng qua các nền tảng mạng xã hội
 */
export async function shareApp(): Promise<void> {
  try {
    await Share.share({
      message: "Thử ứng dụng Family Budget - Quản lý tài chính thông minh!",
      title: "Family Budget",
    });
  } catch (error) {
    console.error("Error sharing app:", error);
  }
}

/**
 * Mở trang đánh giá ứng dụng trên cửa hàng
 */
export async function rateApp(): Promise<void> {
  Alert.alert(
    "Đánh giá ứng dụng",
    "Bạn có muốn đánh giá ứng dụng trên cửa hàng?",
    [
      { text: "Để sau", style: "cancel" },
      {
        text: "Đánh giá",
        onPress: () => {
          // URL cho Google Play Store (Android)
          const url =
            "https://play.google.com/store/apps/details?id=com.familybudget";

          // Nếu cần hỗ trợ iOS, có thể thêm logic kiểm tra Platform
          // const url = Platform.OS === 'ios'
          //   ? 'https://apps.apple.com/app/idXXXXXXXX'
          //   : 'https://play.google.com/store/apps/details?id=com.familybudget';

          Linking.openURL(url).catch((err) =>
            console.error("Error opening store:", err)
          );
        },
      },
    ]
  );
}

/**
 * Xuất dữ liệu ra file Excel
 * (Tính năng này sẽ được triển khai trong phiên bản tương lai)
 */
export async function exportToExcel(): Promise<void> {
  Alert.alert(
    "Xuất Excel",
    "Tính năng xuất báo cáo Excel sẽ được triển khai trong phiên bản tiếp theo",
    [
      {
        text: "OK",
        onPress: () => console.log("Export to Excel feature coming soon"),
      },
    ]
  );
}

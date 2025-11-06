// src/Veungdung.tsx
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { useTheme } from "./context/ThemeContext";

type VeungdungNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Veungdung"
>;

const Veungdung = () => {
  const navigation = useNavigation<VeungdungNavigationProp>();
  const { themeColor } = useTheme();

  const appInfo = {
    name: "Money Manager",
    version: "1.0.0",
    developer: "Team DevPro",
    year: "2025",
    description:
      "Money Manager giúp bạn quản lý tài chính cá nhân một cách thông minh và hiệu quả. Theo dõi thu chi, lập báo cáo, thiết lập mục tiêu tiết kiệm – tất cả trong một ứng dụng.",
    features: [
      "Ghi chép giao dịch nhanh chóng",
      "Phân loại chi tiêu thông minh",
      "Biểu đồ trực quan",
      "Sao lưu & phục hồi dữ liệu",
      "Giao diện thân thiện, dễ sử dụng",
    ],
  };

  const socialLinks = [
    { icon: "web", label: "Website", url: "https://money-manager.app" },
    {
      icon: "facebook",
      label: "Facebook",
      url: "https://facebook.com/moneymanager",
    },
    {
      icon: "instagram",
      label: "Instagram",
      url: "https://instagram.com/moneymanager",
    },
    {
      icon: "email-outline",
      label: "Email hỗ trợ",
      url: "mailto:support@moneymanager.app",
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header – DÙNG MÀU THEME */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Về ứng dụng</Text>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Tên app */}
        <View style={styles.appHeader}>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: "https://via.placeholder.com/80" }}
              style={styles.logo}
            />
          </View>
          {/* TÊN APP – DÙNG MÀU THEME */}
          <Text style={[styles.appName, { color: themeColor }]}>
            {appInfo.name}
          </Text>
          <Text style={styles.appVersion}>Phiên bản {appInfo.version}</Text>
        </View>

        {/* Mô tả */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>{appInfo.description}</Text>
        </View>

        {/* Tính năng nổi bật */}
        <View style={styles.featuresCard}>
          <Text style={styles.sectionTitle}>Tính năng nổi bật</Text>
          {appInfo.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Icon name="check-circle" size={18} color="#4CAF50" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Thông tin nhà phát triển */}
        <View style={styles.developerCard}>
          <Text style={styles.sectionTitle}>Nhà phát triển</Text>
          <View style={styles.developerInfo}>
            <Icon name="account-group" size={20} color="#666" />
            <Text style={styles.developerText}>{appInfo.developer}</Text>
          </View>
          <View style={styles.developerInfo}>
            <Icon name="copyright" size={20} color="#666" />
            <Text style={styles.developerText}>
              © {appInfo.year} Money Manager
            </Text>
          </View>
        </View>

        {/* Liên kết xã hội – DÙNG MÀU THEME CHO ICON */}
        <View style={styles.socialCard}>
          <Text style={styles.sectionTitle}>Liên hệ với chúng tôi</Text>
          {socialLinks.map((link, index) => (
            <TouchableOpacity
              key={index}
              style={styles.socialItem}
              onPress={() => Linking.openURL(link.url)}
            >
              <Icon name={link.icon} size={22} color={themeColor} />
              <Text style={styles.socialText}>{link.label}</Text>
              <Icon name="open-in-new" size={16} color="#BDBDBD" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Nút đánh giá – DÙNG MÀU THEME CHO NỀN & CHỮ */}
        <TouchableOpacity
          style={[styles.rateButton, { backgroundColor: `${themeColor}15` }]}
        >
          <Icon name="star" size={20} color="#FFD700" />
          <Text style={[styles.rateText, { color: themeColor }]}>
            Đánh giá ứng dụng
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Cảm ơn bạn đã sử dụng {appInfo.name}!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  scrollContent: {
    flex: 1,
  },
  appHeader: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  logo: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: "#757575",
  },
  descriptionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  descriptionText: {
    fontSize: 15,
    color: "#424242",
    lineHeight: 22,
    textAlign: "center",
  },
  featuresCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: "#424242",
    flex: 1,
  },
  developerCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  developerInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  developerText: {
    fontSize: 14,
    color: "#424242",
  },
  socialCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
  },
  socialItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  socialText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: "#212121",
  },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  rateText: {
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: "#757575",
    fontStyle: "italic",
  },
});

export default Veungdung;

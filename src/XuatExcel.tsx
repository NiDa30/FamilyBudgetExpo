import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as XLSX from "xlsx";
import { RootStackParamList } from "../App";
import { useTheme } from "./context/ThemeContext";

type XuatExcelNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "XuatExcel"
>;

interface Transaction {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  type: "Thu nhập" | "Chi tiêu";
}

const XuatExcel = () => {
  const navigation = useNavigation<XuatExcelNavigationProp>();
  const [loading, setLoading] = useState(false);
  const { themeColor } = useTheme();

  // Dữ liệu giao dịch giả lập
  const transactions: Transaction[] = [
    {
      id: "1",
      date: "01/11/2025",
      category: "Lương",
      description: "Lương tháng 10",
      amount: 15000000,
      type: "Thu nhập",
    },
    {
      id: "2",
      date: "02/11/2025",
      category: "Ăn uống",
      description: "Cơm trưa",
      amount: 50000,
      type: "Chi tiêu",
    },
    {
      id: "3",
      date: "02/11/2025",
      category: "Giao thông",
      description: "Xăng xe",
      amount: 200000,
      type: "Chi tiêu",
    },
    {
      id: "4",
      date: "31/10/2025",
      category: "Freelance",
      description: "Thiết kế logo",
      amount: 3000000,
      type: "Thu nhập",
    },
  ];

  // HÀM XIN QUYỀN (ANDROID < 10) - Không cần thiết với Expo FileSystem
  const requestStoragePermission = async (): Promise<boolean> => {
    // Expo FileSystem tự động xử lý quyền truy cập
    return true;
  };

  const exportToExcel = async () => {
    setLoading(true);
    try {
      const ws = XLSX.utils.json_to_sheet(transactions);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Báo cáo giao dịch");
      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

      const fileName = `BaoCaoGiaoDich_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      const documentDir = (FileSystem as any).documentDirectory;
      const fileUri = documentDir + fileName;

      // Ghi file vào document directory
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: "base64" as any,
      });

      // Kiểm tra xem có thể chia sẻ file không
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri);
        Alert.alert("Thành công", "Đã xuất Excel và mở hộp thoại chia sẻ!");
      } else {
        Alert.alert("Thành công", `Đã xuất Excel!\nVị trí: ${fileUri}`);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể xuất file. Vui lòng thử lại.");
      console.error("Export error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Tính toán tóm tắt
  const totalIncome = transactions
    .filter((t) => t.type === "Thu nhập")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "Chi tiêu")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header – DÙNG MÀU THEME */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xuất báo cáo Excel</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {/* Tóm tắt */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Tóm tắt tháng 11/2025</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Icon name="trending-up" size={20} color="#4CAF50" />
              <View>
                <Text style={styles.summaryLabel}>Thu nhập</Text>
                <Text style={styles.summaryValue}>
                  {totalIncome.toLocaleString()}đ
                </Text>
              </View>
            </View>
            <View style={styles.summaryItem}>
              <Icon name="trending-down" size={20} color="#F44336" />
              <View>
                <Text style={styles.summaryLabel}>Chi tiêu</Text>
                <Text style={styles.summaryValue}>
                  {totalExpense.toLocaleString()}đ
                </Text>
              </View>
            </View>
            <View style={styles.summaryItem}>
              {/* ICON SỐ DƯ – DÙNG MÀU THEME */}
              <Icon name="balance" size={20} color={themeColor} />
              <View>
                <Text style={styles.summaryLabel}>Số dư</Text>
                <Text style={[styles.summaryValue, { fontWeight: "bold" }]}>
                  {balance.toLocaleString()}đ
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Hướng dẫn */}
        <View style={styles.infoCard}>
          <Icon
            name="information-outline"
            size={20}
            color="#FF9800"
            style={styles.infoIcon}
          />
          <Text style={styles.infoText}>
            Tính năng này sẽ xuất toàn bộ giao dịch của bạn ra file Excel
            (.xlsx) để dễ dàng phân tích và chia sẻ.
          </Text>
        </View>

        {/* Nút xuất – DÙNG MÀU THEME */}
        <TouchableOpacity
          style={[
            styles.exportButton,
            { backgroundColor: themeColor, shadowColor: themeColor },
          ]}
          onPress={exportToExcel}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="file-export" size={20} color="#fff" />
              <Text style={styles.exportButtonText}>Xuất báo cáo Excel</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Danh sách mẫu */}
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Dữ liệu sẽ được xuất (Mẫu)</Text>
          {transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <Text style={styles.transactionDate}>{transaction.date}</Text>
                <Text style={styles.transactionDesc}>
                  {transaction.description}
                </Text>
              </View>
              <View style={styles.transactionRight}>
                <Text
                  style={[
                    styles.transactionAmount,
                    {
                      color:
                        transaction.type === "Thu nhập" ? "#4CAF50" : "#F44336",
                    },
                  ]}
                >
                  {transaction.type === "Thu nhập" ? "+" : "-"}
                  {transaction.amount.toLocaleString()}đ
                </Text>
                <Text style={styles.transactionCategory}>
                  {transaction.category}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollContent: { flexGrow: 1 },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", flex: 1 },
  headerRight: { width: 24 },
  content: { padding: 20 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
    textAlign: "center",
    marginBottom: 16,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 12, color: "#757575", marginTop: 4 },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIcon: { marginTop: 2 },
  infoText: { fontSize: 14, color: "#E65100", flex: 1 },
  exportButton: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 8,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  exportButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  listCard: { backgroundColor: "#fff", borderRadius: 12, elevation: 2 },
  listTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  transactionItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    justifyContent: "space-between",
  },
  transactionLeft: { flex: 1 },
  transactionDate: { fontSize: 12, color: "#757575" },
  transactionDesc: { fontSize: 14, color: "#212121", fontWeight: "500" },
  transactionRight: { alignItems: "flex-end", marginLeft: 16 },
  transactionAmount: { fontSize: 16, fontWeight: "bold" },
  transactionCategory: { fontSize: 12, color: "#666" },
});

export default XuatExcel;

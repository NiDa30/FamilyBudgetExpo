import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, Category } from "../App";
import AsyncStorage from "@react-native-async-storage/async-storage";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;
type HomeRouteProp = RouteProp<RootStackParamList, "Home">;

// Định nghĩa categories mặc định cho CHI TIÊU
const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: "1", name: "Ăn uống", icon: "food-apple", color: "#FF6347", count: 29 },
  { id: "2", name: "Quần áo", icon: "tshirt-crew", color: "#32CD32", count: 5 },
  {
    id: "3",
    name: "Hoa quả",
    icon: "fruit-cherries",
    color: "#00CED1",
    count: 3,
  },
  { id: "4", name: "Mua sắm", icon: "shopping", color: "#FF69B4", count: 4 },
  { id: "5", name: "Giao thông", icon: "bus", color: "#ADFF2F", count: 2 },
  { id: "6", name: "Nhà ở", icon: "home", color: "#FFA500", count: 6 },
  { id: "7", name: "Du lịch", icon: "airplane", color: "#20B2AA", count: 1 },
  {
    id: "8",
    name: "Rượu và đồ uống",
    icon: "glass-wine",
    color: "#BA55D3",
    count: 2,
  },
  {
    id: "9",
    name: "Chi phí điện nước",
    icon: "water",
    color: "#4682B4",
    count: 3,
  },
  { id: "10", name: "Quà", icon: "gift", color: "#FF4500", count: 2 },
  { id: "11", name: "Giáo dục", icon: "school", color: "#FFD700", count: 1 },
];

// Định nghĩa categories mặc định cho THU NHẬP
const DEFAULT_INCOME_CATEGORIES: Category[] = [
  {
    id: "i1",
    name: "Lương",
    icon: "cash-multiple",
    color: "#4CAF50",
    count: 12,
  },
  { id: "i2", name: "Thưởng", icon: "gift", color: "#FF9800", count: 3 },
  { id: "i3", name: "Đầu tư", icon: "chart-line", color: "#2196F3", count: 5 },
  { id: "i4", name: "Kinh doanh", icon: "store", color: "#9C27B0", count: 8 },
  { id: "i5", name: "Freelance", icon: "laptop", color: "#00BCD4", count: 6 },
  { id: "i6", name: "Cho thuê", icon: "home-city", color: "#795548", count: 4 },
  { id: "i7", name: "Lãi suất", icon: "percent", color: "#607D8B", count: 2 },
  { id: "i8", name: "Bán hàng", icon: "sale", color: "#E91E63", count: 7 },
  {
    id: "i9",
    name: "Khác",
    icon: "dots-horizontal",
    color: "#9E9E9E",
    count: 1,
  },
];

const Home: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute<HomeRouteProp>();
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [expenseCategories, setExpenseCategories] = useState<Category[]>(
    DEFAULT_EXPENSE_CATEGORIES
  );
  const [incomeCategories, setIncomeCategories] = useState<Category[]>(
    DEFAULT_INCOME_CATEGORIES
  );

  // Lấy categories hiện tại dựa trên tab đang active
  const currentCategories =
    activeTab === "expense" ? expenseCategories : incomeCategories;
  const totalCount = currentCategories.reduce((sum, cat) => sum + cat.count, 0);

  // Tải danh sách categories từ AsyncStorage khi component mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const storedExpense = await AsyncStorage.getItem("expenseCategories");
        const storedIncome = await AsyncStorage.getItem("incomeCategories");

        if (storedExpense) {
          const parsedExpense = JSON.parse(storedExpense);
          if (Array.isArray(parsedExpense) && parsedExpense.length > 0) {
            setExpenseCategories(parsedExpense);
          } else {
            await AsyncStorage.setItem(
              "expenseCategories",
              JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)
            );
          }
        } else {
          await AsyncStorage.setItem(
            "expenseCategories",
            JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)
          );
        }

        if (storedIncome) {
          const parsedIncome = JSON.parse(storedIncome);
          if (Array.isArray(parsedIncome) && parsedIncome.length > 0) {
            setIncomeCategories(parsedIncome);
          } else {
            await AsyncStorage.setItem(
              "incomeCategories",
              JSON.stringify(DEFAULT_INCOME_CATEGORIES)
            );
          }
        } else {
          await AsyncStorage.setItem(
            "incomeCategories",
            JSON.stringify(DEFAULT_INCOME_CATEGORIES)
          );
        }
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };
    loadCategories();
  }, []);

  // Cập nhật danh sách khi nhận dữ liệu mới từ CategoryManagementScreen
  useEffect(() => {
    if (route.params?.updatedCategories) {
      const updatedCategories = route.params.updatedCategories;
      if (Array.isArray(updatedCategories)) {
        if (activeTab === "expense") {
          setExpenseCategories(updatedCategories);
          AsyncStorage.setItem(
            "expenseCategories",
            JSON.stringify(updatedCategories)
          );
        } else {
          setIncomeCategories(updatedCategories);
          AsyncStorage.setItem(
            "incomeCategories",
            JSON.stringify(updatedCategories)
          );
        }
      }
    }
  }, [route.params?.updatedCategories, activeTab]);

  const handleDeleteCategory = async (id: string) => {
    Alert.alert("Xóa phân loại", "Bạn có chắc muốn xóa phân loại này?", [
      {
        text: "Hủy",
        style: "cancel",
      },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          if (activeTab === "expense") {
            const updatedCategories = expenseCategories.filter(
              (cat) => cat.id !== id
            );
            setExpenseCategories(updatedCategories);
            await AsyncStorage.setItem(
              "expenseCategories",
              JSON.stringify(updatedCategories)
            );
          } else {
            const updatedCategories = incomeCategories.filter(
              (cat) => cat.id !== id
            );
            setIncomeCategories(updatedCategories);
            await AsyncStorage.setItem(
              "incomeCategories",
              JSON.stringify(updatedCategories)
            );
          }
        },
      },
    ]);
  };

  const renderCategoryItem = ({
    item,
    index,
  }: {
    item: Category;
    index: number;
  }) => (
    <View style={[styles.categoryCard, index === 0 && { marginTop: 16 }]}>
      <View style={styles.categoryContent}>
        {/* Icon category với background tròn và shadow */}
        <View
          style={[
            styles.categoryIconContainer,
            { backgroundColor: item.color },
          ]}
        >
          <Icon name={item.icon} size={28} color="#fff" />
        </View>

        {/* Tên category và count */}
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryCount}>{item.count} giao dịch</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <Icon name="pencil-outline" size={20} color="#757575" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteCategory(item.id)}
            activeOpacity={0.7}
          >
            <Icon name="delete-outline" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Drag handle */}
      <TouchableOpacity style={styles.dragHandle} activeOpacity={0.7}>
        <Icon name="drag-horizontal-variant" size={24} color="#BDBDBD" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header với gradient effect */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Trangchu")}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Icon name="arrow-left" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quản lý phân loại</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Tab Container với thiết kế mới */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "expense" && styles.tabActive]}
            onPress={() => setActiveTab("expense")}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Icon
                name="arrow-up-circle"
                size={20}
                color={
                  activeTab === "expense" ? "#fff" : "rgba(255,255,255,0.7)"
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "expense" && styles.tabTextActive,
                ]}
              >
                Chi tiêu
              </Text>
              <View
                style={[
                  styles.countBadge,
                  activeTab === "expense" && styles.countBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    activeTab === "expense" && styles.countTextActive,
                  ]}
                >
                  {expenseCategories.reduce((sum, cat) => sum + cat.count, 0)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "income" && styles.tabActive]}
            onPress={() => setActiveTab("income")}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Icon
                name="arrow-down-circle"
                size={20}
                color={
                  activeTab === "income" ? "#fff" : "rgba(255,255,255,0.7)"
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "income" && styles.tabTextActive,
                ]}
              >
                Thu nhập
              </Text>
              <View
                style={[
                  styles.countBadge,
                  activeTab === "income" && styles.countBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    activeTab === "income" && styles.countTextActive,
                  ]}
                >
                  {incomeCategories.reduce((sum, cat) => sum + cat.count, 0)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Icon name="information-outline" size={18} color="#1E88E5" />
        <Text style={styles.infoText}>Kéo để sắp xếp lại thứ tự phân loại</Text>
      </View>

      {/* List categories */}
      <FlatList
        data={currentCategories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        key={activeTab}
      />

      {/* Nút thêm phân loại mới - Floating */}
      <TouchableOpacity
        style={styles.addButtonFloating}
        onPress={() => navigation.navigate("Nhappl")}
        activeOpacity={0.9}
      >
        <Icon name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Bottom Add Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate("Nhappl")}
          activeOpacity={0.8}
        >
          <Icon name="plus-circle-outline" size={22} color="#1E88E5" />
          <Text style={styles.addButtonText}>Thêm phân loại mới</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    backgroundColor: "#1E88E5",
    paddingTop: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  tabActive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.8)",
  },
  tabTextActive: {
    fontWeight: "700",
    color: "#fff",
  },
  countBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 28,
    alignItems: "center",
  },
  countBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  countTextActive: {
    color: "#fff",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1565C0",
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  categoryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  categoryContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  categoryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 16,
  },
  categoryName: {
    fontSize: 16,
    color: "#212121",
    fontWeight: "600",
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 13,
    color: "#757575",
    fontWeight: "400",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  dragHandle: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  addButton: {
    flexDirection: "row",
    backgroundColor: "#E3F2FD",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E88E5",
    letterSpacing: 0.3,
  },
  addButtonFloating: {
    position: "absolute",
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#1E88E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default Home;

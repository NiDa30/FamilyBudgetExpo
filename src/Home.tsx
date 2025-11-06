// src/Home.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Category, RootStackParamList } from "../App";

// ĐÃ THÊM: DÙNG MÀU THEME
import { useTheme } from "./context/ThemeContext";
import { authInstance as auth } from "./firebaseConfig";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;
type HomeRouteProp = RouteProp<RootStackParamList, "Home">;

// Transaction type definition
interface Transaction {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  description: string;
  date: number;
  payment_method?: string;
  merchant_name?: string;
  location_lat?: number;
  location_lng?: number;
  created_at: number;
  last_modified_at: number; // Changed from updated_at to last_modified_at
  is_synced: number;
  deleted_at?: number;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

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

  // DI CHUYỂN LÊN ĐẦU – TRƯỚC useState
  const { themeColor } = useTheme();

  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [expenseCategories, setExpenseCategories] = useState<Category[]>(
    DEFAULT_EXPENSE_CATEGORIES
  );
  const [incomeCategories, setIncomeCategories] = useState<Category[]>(
    DEFAULT_INCOME_CATEGORIES
  );

  const currentCategories =
    activeTab === "expense" ? expenseCategories : incomeCategories;

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const user = auth.currentUser;
        if (!user?.uid) return;

        // Load from SQLite first
        try {
          const DatabaseService = (await import("./database/databaseService"))
            .default;
          const allCategories = await DatabaseService.getCategoriesByUser(
            user.uid
          );

          const expenseCats = allCategories
            .filter((cat: any) => cat.type === "EXPENSE" || !cat.type)
            .map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              color: cat.color || "#2196F3",
              count: 0, // Count will be calculated separately if needed
            }));

          const incomeCats = allCategories
            .filter((cat: any) => cat.type === "INCOME")
            .map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              color: cat.color || "#2196F3",
              count: 0,
            }));

          // If no expense categories, use defaults
          if (expenseCats.length > 0) {
            setExpenseCategories(expenseCats);
            await AsyncStorage.setItem(
              "expenseCategories",
              JSON.stringify(expenseCats)
            );
          } else {
            setExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
            await AsyncStorage.setItem(
              "expenseCategories",
              JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)
            );
          }

          // If no income categories, use defaults
          if (incomeCats.length > 0) {
            setIncomeCategories(incomeCats);
            await AsyncStorage.setItem(
              "incomeCategories",
              JSON.stringify(incomeCats)
            );
          } else {
            setIncomeCategories(DEFAULT_INCOME_CATEGORIES);
            await AsyncStorage.setItem(
              "incomeCategories",
              JSON.stringify(DEFAULT_INCOME_CATEGORIES)
            );
          }
        } catch (sqliteError) {
          console.warn(
            "Failed to load from SQLite, using AsyncStorage:",
            sqliteError
          );

          // Fallback to AsyncStorage
          const storedExpense = await AsyncStorage.getItem("expenseCategories");
          const storedIncome = await AsyncStorage.getItem("incomeCategories");

          if (storedExpense) {
            const parsedExpense = JSON.parse(storedExpense);
            if (Array.isArray(parsedExpense) && parsedExpense.length > 0) {
              setExpenseCategories(parsedExpense);
            } else {
              setExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
              await AsyncStorage.setItem(
                "expenseCategories",
                JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)
              );
            }
          } else {
            setExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
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
              setIncomeCategories(DEFAULT_INCOME_CATEGORIES);
              await AsyncStorage.setItem(
                "incomeCategories",
                JSON.stringify(DEFAULT_INCOME_CATEGORIES)
              );
            }
          } else {
            setIncomeCategories(DEFAULT_INCOME_CATEGORIES);
            await AsyncStorage.setItem(
              "incomeCategories",
              JSON.stringify(DEFAULT_INCOME_CATEGORIES)
            );
          }
        }
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };
    loadCategories();
  }, []);

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
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            const user = auth.currentUser;
            if (!user?.uid) {
              Alert.alert("Lỗi", "Người dùng chưa đăng nhập");
              return;
            }

            // Update local state
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

            // Delete from SQLite and sync to Firebase
            try {
              const DatabaseService = (
                await import("./database/databaseService")
              ).default;
              await DatabaseService.deleteCategory(id);

              // Sync to Firebase
              const FirebaseService = (
                await import("./service/firebase/FirebaseService")
              ).default;
              await FirebaseService.deleteCategory(id);

              console.log(`✅ Deleted category ${id} from SQLite and Firebase`);
            } catch (syncError) {
              console.warn("Failed to sync category deletion:", syncError);
              // Category is still deleted locally, sync will retry later
            }
          } catch (error) {
            console.error("Error deleting category:", error);
            Alert.alert("Lỗi", "Không thể xóa phân loại");
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
        <View
          style={[
            styles.categoryIconContainer,
            { backgroundColor: item.color },
          ]}
        >
          <Icon name={item.icon} size={28} color="#fff" />
        </View>

        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryCount}>{item.count} giao dịch</Text>
        </View>

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

      <TouchableOpacity style={styles.dragHandle} activeOpacity={0.7}>
        <Icon name="drag-horizontal-variant" size={24} color="#BDBDBD" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header – DÙNG MÀU THEME */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
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

        {/* Tab – DÙNG MÀU THEME */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "expense" && [
                styles.tabActive,
                { backgroundColor: themeColor },
              ],
            ]}
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
            style={[
              styles.tab,
              activeTab === "income" && [
                styles.tabActive,
                { backgroundColor: themeColor },
              ],
            ]}
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

      {/* Info banner – DÙNG MÀU THEME */}
      <View style={[styles.infoBanner, { backgroundColor: `${themeColor}15` }]}>
        <Icon name="information-outline" size={18} color={themeColor} />
        <Text style={[styles.infoText, { color: themeColor }]}>
          Kéo để sắp xếp lại thứ tự phân loại
        </Text>
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

      {/* Nút thêm phân loại mới - Floating – DÙNG MÀU THEME */}
      <TouchableOpacity
        style={[
          styles.addButtonFloating,
          { backgroundColor: themeColor, shadowColor: themeColor },
        ]}
        onPress={() => navigation.navigate("Nhappl")}
        activeOpacity={0.9}
      >
        <Icon name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Bottom Add Button – DÙNG MÀU THEME */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: `${themeColor}15` }]}
          onPress={() => navigation.navigate("Nhappl")}
          activeOpacity={0.8}
        >
          <Icon name="plus-circle-outline" size={22} color={themeColor} />
          <Text style={[styles.addButtonText, { color: themeColor }]}>
            Thêm phân loại mới
          </Text>
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
    // ĐÃ XÓA backgroundColor: '#1E88E5'
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
    // backgroundColor: themeColor (được áp dụng trong component)
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
    // backgroundColor: `${themeColor}15` (được áp dụng trong component)
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "500",
    // color: themeColor (được áp dụng trong component)
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
    // backgroundColor: `${themeColor}15` (được áp dụng trong component)
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
    // color: themeColor (được áp dụng trong component)
  },
  addButtonFloating: {
    position: "absolute",
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    // backgroundColor: themeColor (được áp dụng trong component)
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default Home;

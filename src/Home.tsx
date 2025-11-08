// src/Home.tsx
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
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
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { COLLECTIONS } from "./constants/collections";
import { useTheme } from "./context/ThemeContext";
import { authInstance as auth, dbInstance as db } from "./firebaseConfig";
import CategorySyncService from "./services/categorySyncService";

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

const Home: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute<HomeRouteProp>();

  // DI CHUYỂN LÊN ĐẦU – TRƯỚC useState
  const { themeColor } = useTheme();

  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentCategories =
    activeTab === "expense" ? expenseCategories : incomeCategories;

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const user = auth.currentUser;
        if (!user?.uid) {
          setIsLoading(false);
          return;
        }

        // ✅ BƯỚC 1: ĐẢM BẢO CATEGORIES ĐÃ ĐƯỢC KHỞI TẠO
        try {
          const { ensureCategoriesInitialized } = await import(
            "./database/databaseService"
          );
          await ensureCategoriesInitialized(user.uid);
        } catch (initError) {
          console.warn("Failed to ensure categories initialized:", initError);
        }

        // ✅ BƯỚC 2: LOAD TỪ SQLite (Bao gồm cả default và user categories)
        const DatabaseService = (await import("./database/databaseService"))
          .default;
        const allCategories = await DatabaseService.getCategoriesByUser(
          user.uid
        );

        // ✅ BƯỚC 3: PHÂN LOẠI THEO TYPE VÀ FILTER deleted_at IS NULL
        const expenseCats = allCategories
          .filter(
            (cat: any) =>
              (cat.type === "EXPENSE" || !cat.type) &&
              !cat.deleted_at &&
              !cat.is_hidden
          )
          .map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon || "tag",
            color: cat.color || "#2196F3",
            count: 0, // Count will be calculated separately if needed
          }));

        const incomeCats = allCategories
          .filter(
            (cat: any) =>
              cat.type === "INCOME" && !cat.deleted_at && !cat.is_hidden
          )
          .map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon || "tag",
            color: cat.color || "#2196F3",
            count: 0,
          }));

        setExpenseCategories(expenseCats);
        setIncomeCategories(incomeCats);

        console.log(
          `✅ Loaded ${expenseCats.length} expense and ${incomeCats.length} income categories from SQLite`
        );
      } catch (error) {
        console.error("Error loading categories:", error);
        // Set empty arrays on error
        setExpenseCategories([]);
        setIncomeCategories([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadCategories();
  }, []);

  // ✅ REAL-TIME SYNC: Setup Firebase listeners for categories
  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user?.uid) return;

      console.log("🔄 Home screen focused, setting up real-time listeners...");
      let isActive = true;

      // Setup Firebase real-time listener for categories
      const categoriesQuery = query(
        collection(db, COLLECTIONS.CATEGORIES),
        where("userID", "==", user.uid),
        where("isHidden", "==", false)
      );

      // Debounce timer để tránh sync quá nhiều lần
      let categorySyncTimeout: ReturnType<typeof setTimeout> | null = null;
      let lastCategorySyncTime = 0;
      const CATEGORY_SYNC_DEBOUNCE_MS = 2000; // 2 seconds debounce

      const unsubscribeCategories = onSnapshot(
        categoriesQuery,
        async (snapshot) => {
          if (!isActive) return;

          // Check if there are actual changes
          const changes = snapshot.docChanges();
          if (changes.length === 0) {
            return; // No changes, skip sync
          }

          console.log(
            `📋 Firebase categories updated in Home: ${changes.length} changes detected`
          );

          const now = Date.now();
          // Debounce: skip if synced too recently
          if (now - lastCategorySyncTime < CATEGORY_SYNC_DEBOUNCE_MS) {
            // Clear existing timeout and set a new one
            if (categorySyncTimeout) {
              clearTimeout(categorySyncTimeout);
            }
            categorySyncTimeout = setTimeout(async () => {
              if (isActive) {
                await syncCategoriesFromFirebase(user.uid);
                lastCategorySyncTime = Date.now();
              }
            }, CATEGORY_SYNC_DEBOUNCE_MS);
            return;
          }

          lastCategorySyncTime = now;
          await syncCategoriesFromFirebase(user.uid);
        },
        (error) => {
          console.error(
            "❌ Firebase categories listener error in Home:",
            error
          );
        }
      );

      // Helper function to sync categories from Firebase to SQLite
      const syncCategoriesFromFirebase = async (uid: string) => {
        try {
          console.log(
            "🔄 Syncing categories from Firebase to SQLite in Home..."
          );
          const syncResult = await CategorySyncService.syncFromFirebase(uid);
          console.log(
            `✅ Synced ${syncResult.synced} categories from Firebase to SQLite`
          );

          // Reload categories from SQLite
          const DatabaseService = (await import("./database/databaseService"))
            .default;
          const allCategories = await DatabaseService.getCategoriesByUser(uid);

          const expenseCats = allCategories
            .filter(
              (cat: any) =>
                (cat.type === "EXPENSE" || !cat.type) &&
                !cat.deleted_at &&
                !cat.is_hidden
            )
            .map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              color: cat.color || "#2196F3",
              count: 0,
            }));

          const incomeCats = allCategories
            .filter(
              (cat: any) =>
                cat.type === "INCOME" && !cat.deleted_at && !cat.is_hidden
            )
            .map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              color: cat.color || "#2196F3",
              count: 0,
            }));

          if (isActive) {
            setExpenseCategories(expenseCats);
            setIncomeCategories(incomeCats);
            console.log(
              `✅ Updated UI with ${expenseCats.length} expense and ${incomeCats.length} income categories`
            );
          }
        } catch (error) {
          console.error("❌ Error syncing categories from Firebase:", error);
        }
      };

      // Initial load
      syncCategoriesFromFirebase(user.uid);

      // Return cleanup function
      return () => {
        isActive = false;
        if (categorySyncTimeout) {
          clearTimeout(categorySyncTimeout);
        }
        unsubscribeCategories();
        console.log("🔄 Home screen unfocused, cleaned up listeners");
      };
    }, [])
  );

  // ✅ HÀM MỚI: Xử lý thêm category
  const handleAddCategory = () => {
    // ✅ Chuyển đến màn hình thêm category
    // Nhappl.tsx sẽ tự động xử lý budget group dựa trên route params nếu có
    navigation.navigate("Nhappl" as any);
  };

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

            // ✅ BƯỚC 1: XÓA TRONG SQLite (soft delete với is_synced = 0)
            const DatabaseService = (await import("./database/databaseService"))
              .default;
            await DatabaseService.deleteCategory(id);

            // ✅ BƯỚC 2: CẬP NHẬT UI
            if (activeTab === "expense") {
              setExpenseCategories((prev) =>
                prev.filter((cat) => cat.id !== id)
              );
            } else {
              setIncomeCategories((prev) =>
                prev.filter((cat) => cat.id !== id)
              );
            }

            // ✅ BƯỚC 3: ĐỒNG BỘ LÊN FIREBASE
            // deleteCategory đã set is_synced = 0, nên SyncEngine sẽ tự động đồng bộ
            // Tuy nhiên, để đảm bảo đồng bộ nhanh, schedule sync ngay
            try {
              const SyncEngine = (await import("./service/sync/SyncEngine"))
                .default;
              SyncEngine.scheduleSync(user.uid, 1000); // Sync sau 1 giây
              console.log(`⏰ Scheduled sync for deleted category ${id}`);
            } catch (syncError) {
              console.warn("Failed to schedule sync:", syncError);
              // SyncEngine sẽ tự động retry sau
            }

            console.log(`✅ Deleted category ${id} from SQLite`);
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
                  {expenseCategories.length}
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
                  {incomeCategories.length}
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
          Phân loại hiện có -{" "}
          {activeTab === "expense" ? "Chi tiêu" : "Thu nhập"} (
          {currentCategories.length})
        </Text>
      </View>

      {/* List categories */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang tải danh mục...</Text>
        </View>
      ) : (
        <FlatList
          data={currentCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          key={activeTab}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="folder-outline" size={64} color="#BDBDBD" />
              <Text style={styles.emptyText}>
                Chưa có phân loại nào. Hãy thêm phân loại mới!
              </Text>
            </View>
          }
        />
      )}

      {/* Nút thêm phân loại mới - Floating – DÙNG MÀU THEME */}
      <TouchableOpacity
        style={[
          styles.addButtonFloating,
          { backgroundColor: themeColor, shadowColor: themeColor },
        ]}
        onPress={handleAddCategory}
        activeOpacity={0.9}
      >
        <Icon name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Bottom Add Button – DÙNG MÀU THEME */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: `${themeColor}15` }]}
          onPress={handleAddCategory}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: "#757575",
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#757575",
    marginTop: 16,
    textAlign: "center",
  },
});

export default Home;

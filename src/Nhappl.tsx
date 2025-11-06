import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { CategoryService as DatabaseService } from "./database/databaseService";
import { authInstance as auth } from "./firebaseConfig"; // Sửa import
import SyncEngine from "./service/sync/SyncEngine";

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type?: string;
  budget_group?: string;
  user_id?: string;
  is_system_default?: number;
  createdAt?: any;
};

type CategoryManagementScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Nhappl"
>;

const CategoryManagementScreen = () => {
  const navigation = useNavigation<CategoryManagementScreenNavigationProp>();

  // ✅ SỬA LỖI: Dùng useState để lấy userId
  const [userId, setUserId] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("food-apple");
  const [selectedColor, setSelectedColor] = useState("#FF6347");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const colors = [
    "#FF6347",
    "#FF4500",
    "#FF69B4",
    "#FF1493",
    "#FF8C00",
    "#FFD700",
    "#FFEB3B",
    "#FFA500",
    "#32CD32",
    "#00FF00",
    "#ADFF2F",
    "#7FFF00",
    "#00CED1",
    "#00BFFF",
    "#1E90FF",
    "#4169E1",
    "#0000FF",
    "#8A2BE2",
    "#9370DB",
    "#BA55D3",
    "#4682B4",
    "#5F9EA0",
    "#20B2AA",
    "#3CB371",
    "#2E8B57",
  ];

  const iconList = [
    "food-apple",
    "credit-card",
    "cash-multiple",
    "coffee",
    "account",
    "shopping",
    "car",
    "hospital-box",
    "pill",
    "gamepad-variant",
    "school",
    "piggy-bank",
    "home",
    "gift",
    "phone",
    "laptop",
    "book",
    "music",
  ];

  // ✅ THÊM MỚI: useEffect để lấy userId từ Firebase Auth
  useEffect(() => {
    // Lắng nghe sự thay đổi trạng thái đăng nhập từ Firebase
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Nếu người dùng đã đăng nhập, gán user.uid cho state
        setUserId(user.uid);
        console.log("User đã đăng nhập, ID:", user.uid);
      } else {
        // Nếu người dùng đăng xuất
        setUserId(null);
        console.log("User chưa đăng nhập.");
        // Cân nhắc điều hướng về trang Login nếu cần
        // navigation.replace('Login');
      }
    });

    // Hủy lắng nghe khi component bị gỡ bỏ
    return () => unsubscribe();
  }, []); // Mảng rỗng đảm bảo nó chỉ chạy 1 lần khi component mount

  // useEffect này sẽ tự động chạy khi userId thay đổi (từ null -> ID thật)
  useEffect(() => {
    if (userId) {
      initializeData();
    }
  }, [userId]);

  /**
   * 🚀 KHỞI TẠO DỮ LIỆU - OPTIMIZED
   * 1. Load SQLite trước → Hiển thị UI ngay
   * 2. Sync Firebase sau → Background, không block UI
   */
  const initializeData = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      // ⚡ BƯỚC 1: LOAD TỪ SQLITE TRƯỚC (NHANH - 10-50ms)
      await loadCategoriesFromSQLite();

      setIsLoading(false); // ← UI hiển thị ngay!
      console.log("✅ UI displayed with SQLite data");

      // 🔄 BƯỚC 2: SYNC FIREBASE Ở BACKGROUND (KHÔNG BLOCK UI)
      syncFirebaseInBackground();
    } catch (error) {
      console.error("Failed to initialize data:", error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu");
      setIsLoading(false);
    }
  };

  /**
   * Load categories từ SQLite
   */
  const loadCategoriesFromSQLite = async () => {
    if (!userId) return;

    try {
      const cats = await DatabaseService.getCategoriesByUser(userId);
      setCategories(cats);
      console.log(`💾 Loaded ${cats.length} categories from SQLite`);
    } catch (error) {
      console.error("Failed to load categories from SQLite:", error);
      throw error;
    }
  };

  /**
   * 🔄 SYNC FIREBASE Ở BACKGROUND - KHÔNG BLOCK UI
   */
  const syncFirebaseInBackground = async () => {
    if (!userId) return;

    try {
      setIsSyncing(true);
      console.log("🔄 Background sync started...");

      // Thực hiện full sync (push + pull)
      await SyncEngine.performSync(userId);

      // Sau khi sync xong, reload từ SQLite để có data mới nhất
      const updatedCategories = await DatabaseService.getCategoriesByUser(
        userId
      );

      // CHỈ UPDATE UI NẾU CÓ THAY ĐỔI
      // Dùng state callback để đảm bảo so sánh với state mới nhất
      setCategories((prevCategories) => {
        if (
          JSON.stringify(updatedCategories) !== JSON.stringify(prevCategories)
        ) {
          console.log("🔃 UI updated with synced data");
          return updatedCategories;
        } else {
          console.log("✓ No changes from Firebase");
          return prevCategories;
        }
      });
    } catch (error) {
      console.warn("Background sync failed, using local data:", error);
      // App vẫn hoạt động bình thường với data local
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * ➕ THÊM CATEGORY MỚI - OPTIMISTIC UI
   */
  const handleAddCategory = async () => {
    if (!userId) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng");
      return;
    }

    if (!newCategoryName.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập tên phân loại");
      return;
    }

    const existingCategory = categories.find(
      (cat) => cat.name.toLowerCase() === newCategoryName.toLowerCase()
    );

    if (existingCategory) {
      Alert.alert("Thông báo", "Phân loại này đã tồn tại");
      return;
    }

    const newCategory: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newCategoryName.trim(),
      icon: selectedIcon,
      color: selectedColor,
      type: "EXPENSE",
      budget_group: "Nhu cầu",
      user_id: userId,
      is_system_default: 0,
    };

    try {
      // ⚡ BƯỚC 1: CẬP NHẬT UI NGAY (OPTIMISTIC UPDATE)
      setCategories((prev) => [...prev, newCategory]);
      console.log("🎨 UI updated immediately (optimistic)");

      // 💾 BƯỚC 2: LƯU VÀO SQLITE
      await DatabaseService.createCategory(newCategory);
      console.log("💾 Saved to SQLite");

      // 🔄 BƯỚC 3: SYNC LÊN FIREBASE Ở BACKGROUND
      // Không await - để không block UI
      SyncEngine.scheduleSync(userId, 1000); // Sync sau 1 giây
      console.log("⏰ Firebase sync scheduled");

      // Reset form
      setNewCategoryName("");
      setSelectedIcon("food-apple");
      setSelectedColor("#FF6347");

      Alert.alert("Thành công", "Đã thêm phân loại mới", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      // ❌ NẾU LỖI: ROLLBACK UI
      console.error("Error saving category:", error);

      // Remove category khỏi UI
      setCategories((prev) => prev.filter((cat) => cat.id !== newCategory.id));

      Alert.alert("Lỗi", "Không thể lưu phân loại. Vui lòng thử lại.");
    }
  };

  /**
   * 🔄 MANUAL SYNC - Pull to refresh
   */
  const handleManualSync = async () => {
    if (!userId) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng");
      return;
    }

    try {
      setIsSyncing(true);

      // Full sync: push local changes + pull remote changes
      await SyncEngine.performSync(userId, true);

      // Reload từ SQLite
      await loadCategoriesFromSQLite();

      Alert.alert("Thành công", "Đã đồng bộ dữ liệu");
    } catch (error) {
      Alert.alert("Lỗi", "Không thể đồng bộ. Vui lòng kiểm tra kết nối");
      console.error("Manual sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderIconItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.iconItem,
        selectedIcon === item && styles.selectedIconItem,
      ]}
      onPress={() => setSelectedIcon(item)}
    >
      <Icon
        name={item}
        size={32}
        color={selectedIcon === item ? "#2196F3" : "#666"}
      />
    </TouchableOpacity>
  );

  const renderColorItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.colorItem,
        { backgroundColor: item },
        selectedColor === item && styles.selectedColorItem,
      ]}
      onPress={() => setSelectedColor(item)}
    >
      {selectedColor === item && <Icon name="check" size={16} color="#fff" />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Phân loại quản lý</Text>
          {isSyncing && (
            <View style={styles.syncIndicator}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.syncText}>Đang đồng bộ...</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleManualSync}
            style={styles.syncButton}
            disabled={isSyncing}
          >
            <Icon
              name="cloud-sync"
              size={24}
              color={isSyncing ? "#999" : "#fff"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAddCategory}
            style={styles.checkButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="check" size={28} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.topSection}>
        <View
          style={[
            styles.selectedIconContainer,
            { backgroundColor: selectedColor },
          ]}
        >
          <Icon name={selectedIcon} size={36} color="#fff" />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nhập tên phân loại"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholderTextColor="#BDBDBD"
            maxLength={15}
            editable={!isLoading}
          />
          <Text style={styles.counter}>{newCategoryName.length}/15</Text>
        </View>
      </View>

      {/* ✅ CẬP NHẬT: Luôn hiển thị phần này */}
      <View style={styles.existingCategoriesSection}>
        <Text style={styles.sectionTitle}>
          Phân loại hiện có ({categories.length})
        </Text>

        {/* Chỉ hiển thị ScrollView khi có data */}
        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
          >
            {categories.map((cat) => (
              <View key={cat.id} style={styles.categoryChip}>
                <View
                  style={[styles.categoryIcon, { backgroundColor: cat.color }]}
                >
                  <Icon name={cat.icon} size={20} color="#fff" />
                </View>
                <Text style={styles.categoryName}>{cat.name}</Text>
                {cat.is_system_default === 1 && (
                  <Icon
                    name="star"
                    size={14}
                    color="#FFD700"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          // Hiển thị text này nếu không có category
          <Text style={styles.emptyCategoryText}>Chưa có phân loại nào.</Text>
        )}
      </View>

      <View style={styles.colorSection}>
        <View style={styles.colorIconContainer}>
          <Icon name="palette" size={32} color="#9E9E9E" />
          <Text style={styles.colorLabel}>Chọn màu</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.colorScrollView}
        >
          <FlatList
            data={colors}
            renderItem={renderColorItem}
            keyExtractor={(item) => item}
            horizontal
            scrollEnabled={false}
            contentContainerStyle={styles.colorList}
          />
        </ScrollView>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Chọn biểu tượng</Text>
      <FlatList
        data={iconList}
        renderItem={renderIconItem}
        keyExtractor={(item) => item}
        numColumns={5}
        contentContainerStyle={styles.iconGrid}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    backgroundColor: "#2196F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50, // Điều chỉnh nếu dùng safe-area-view
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  syncText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncButton: {
    padding: 8,
    marginRight: 8,
  },
  checkButton: {
    padding: 8,
  },
  topSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  selectedIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    fontSize: 18,
    color: "#333",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  counter: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 4,
  },
  existingCategoriesSection: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    // paddingLeft: 16, // Đã có trong sectionTitle
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  categoriesScroll: {
    marginTop: 8,
    paddingLeft: 16, // Thêm paddingLeft ở đây
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  categoryIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  categoryName: {
    fontSize: 14,
    color: "#333",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  // ✅ THÊM STYLE NÀY VÀO
  emptyCategoryText: {
    fontSize: 14,
    color: "#999",
    paddingHorizontal: 16, // Giống sectionTitle
    paddingBottom: 12, // Giống sectionTitle
    fontStyle: "italic",
  },
  colorSection: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  colorIconContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  colorLabel: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  colorScrollView: {
    marginTop: 8,
  },
  colorList: {
    gap: 12,
  },
  colorItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  selectedColorItem: {
    borderWidth: 3,
    borderColor: "#2196F3",
  },
  divider: {
    height: 8,
    backgroundColor: "#F5F5F5",
  },
  iconGrid: {
    padding: 16,
  },
  iconItem: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    margin: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  selectedIconItem: {
    backgroundColor: "#E3F2FD",
    borderWidth: 2,
    borderColor: "#2196F3",
  },
});

export default CategoryManagementScreen;

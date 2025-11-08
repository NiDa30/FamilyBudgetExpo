import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
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
import { COLLECTIONS } from "./constants/collections";
import { CategoryService as DatabaseService } from "./database/databaseService";
import { authInstance as auth, dbInstance as db } from "./firebaseConfig";
import SyncEngine from "./service/sync/SyncEngine";

type Category = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type?: "EXPENSE" | "INCOME";
  budget_group?: string;
  user_id?: string;
  is_system_default?: number;
  isSystemDefault?: boolean;
  createdAt?: any;
  updatedAt?: number;
};

type CategoryManagementScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Nhappl"
>;

const CategoryManagementScreen = () => {
  const navigation = useNavigation<CategoryManagementScreenNavigationProp>();
  const route = useRoute<any>(); // ✅ Thêm route để nhận params

  // ✅ SỬA LỖI: Dùng useState để lấy userId
  const [userId, setUserId] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("food-apple");
  const [selectedColor, setSelectedColor] = useState("#FF6347");
  // ✅ Nhận initialBudgetGroup từ route params nếu có
  const initialBudgetGroup = route.params?.initialBudgetGroup || "Chi tiêu";
  const [selectedBudgetGroup, setSelectedBudgetGroup] =
    useState<string>(initialBudgetGroup);
  const [categories, setCategories] = useState<Category[]>([]); // Combined categories (default + user)
  const [defaultCategories, setDefaultCategories] = useState<Category[]>([]); // Default categories (read-only)
  const [userCategories, setUserCategories] = useState<Category[]>([]); // User categories (editable)
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

  // ✅ CẬP NHẬT: Chỉ có 2 nhóm chi phí
  const budgetGroups = ["Chi tiêu", "Thu nhập"];

  // ✅ HELPER: Lấy type từ budget_group
  const getTypeFromBudgetGroup = (
    budgetGroup: string
  ): "EXPENSE" | "INCOME" => {
    return budgetGroup === "Chi tiêu" ? "EXPENSE" : "INCOME";
  };

  // ✅ HELPER: Lấy categories theo budget_group
  const getCategoriesByBudgetGroup = (budgetGroup: string) => {
    return categories.filter((cat) => {
      if (budgetGroup === "Chi tiêu") {
        return (
          cat.budget_group === "Chi tiêu" ||
          (!cat.budget_group && (cat.type === "EXPENSE" || !cat.type))
        );
      } else {
        // Thu nhập
        return (
          cat.budget_group === "Thu nhập" ||
          (!cat.budget_group && cat.type === "INCOME")
        );
      }
    });
  };

  // ✅ Lấy số lượng categories cho mỗi nhóm (từ combined categories)
  const chiTieuCount = categories.filter((cat) => {
    const catBudgetGroup =
      cat.budget_group || (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
    return catBudgetGroup === "Chi tiêu";
  }).length;
  const thuNhapCount = categories.filter((cat) => {
    const catBudgetGroup =
      cat.budget_group || (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
    return catBudgetGroup === "Thu nhập";
  }).length;

  // ✅ Lấy categories hiện tại dựa trên selectedBudgetGroup
  const currentDisplayCategories = categories.filter((cat) => {
    const catBudgetGroup =
      cat.budget_group || (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
    return catBudgetGroup === selectedBudgetGroup;
  });

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

  // ✅ REAL-TIME SYNC: Setup Firebase listeners for categories
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      console.log(
        "🔄 Nhappl screen focused, setting up real-time listeners..."
      );
      let isActive = true;

      // Setup Firebase real-time listener for categories
      const categoriesQuery = query(
        collection(db, COLLECTIONS.CATEGORIES),
        where("userID", "==", userId),
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
            `📋 Firebase categories updated: ${changes.length} changes detected`
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
                await syncFromFirebaseAndUpdate();
                lastCategorySyncTime = Date.now();
              }
            }, CATEGORY_SYNC_DEBOUNCE_MS);
            return;
          }

          lastCategorySyncTime = now;
          await syncFromFirebaseAndUpdate();
        },
        (error) => {
          console.error("❌ Firebase categories listener error:", error);
        }
      );

      // Return cleanup function
      return () => {
        isActive = false;
        if (categorySyncTimeout) {
          clearTimeout(categorySyncTimeout);
        }
        unsubscribeCategories();
        console.log("🔄 Nhappl screen unfocused, cleaned up listeners");
      };
    }, [userId])
  );

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
   * Load categories: Default from Firebase + User from SQLite
   * Flow: Firebase (Default) → SQLite (User) → Combine → Display → Sync User Categories
   */
  const loadCategoriesFromSQLite = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      console.log("📋 Starting to load categories...");

      const CategoryService = (await import("./services/categoryService"))
        .default;

      // ✅ BƯỚC 1: LOAD DEFAULT CATEGORIES FROM FIREBASE (先にデフォルトカテゴリをロード)
      console.log("📋 Step 1: Loading default categories from Firebase...");
      const defaultCatsFromFirebase =
        await CategoryService.loadDefaultCategoriesFromFirebase();
      console.log(
        `📋 Loaded ${defaultCatsFromFirebase.length} default categories from Firebase`
      );

      // ✅ BƯỚC 2: LOAD USER CATEGORIES FROM SQLITE
      console.log("📋 Step 2: Loading user categories from SQLite...");
      const userCatsFromSQLite =
        await CategoryService.loadUserCategoriesFromSQLite(userId);
      console.log(
        `📋 Loaded ${userCatsFromSQLite.length} user categories from SQLite`
      );

      // ✅ BƯỚC 3: COMBINE CATEGORIES (Default + User)
      console.log("📋 Step 3: Combining categories...");
      const combined: Category[] = [];

      // Add user categories first (these override defaults if same name+type)
      userCatsFromSQLite.forEach((cat) => {
        combined.push({
          ...cat,
          isSystemDefault: false,
        });
      });

      // Add default categories that are not in user list
      defaultCatsFromFirebase.forEach((defaultCat) => {
        // Check if this default category is already in user categories (by name + type)
        const existsInUser = userCatsFromSQLite.some(
          (userCat) =>
            userCat.name.toLowerCase().trim() ===
              defaultCat.name.toLowerCase().trim() &&
            userCat.type === defaultCat.type
        );

        if (!existsInUser) {
          combined.push({
            ...defaultCat,
            isSystemDefault: true, // Mark as system default (read-only)
          });
        }
      });

      console.log(
        `📋 Combined ${combined.length} total categories (${defaultCatsFromFirebase.length} default + ${userCatsFromSQLite.length} user)`
      );

      // ✅ BƯỚC 4: FILTER BY SELECTED BUDGET GROUP
      const filteredCats = combined.filter((cat) => {
        const catBudgetGroup =
          cat.budget_group ||
          (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
        return catBudgetGroup === selectedBudgetGroup;
      });

      // Separate default and user categories for UI (for counting)
      const defaultCats = combined.filter((cat) => cat.isSystemDefault);
      const userCats = combined.filter((cat) => !cat.isSystemDefault);

      // ✅ BƯỚC 5: UPDATE UI
      setCategories(filteredCats as Category[]);
      setDefaultCategories(defaultCats);
      setUserCategories(userCats);

      console.log(
        `💾 Displayed ${filteredCats.length} categories for "${selectedBudgetGroup}" (${defaultCats.length} default + ${userCats.length} user total)`
      );

      setIsLoading(false);

      // ✅ BƯỚC 6: SYNC USER CATEGORIES FROM FIREBASE (Background - không block UI)
      // Only sync user categories (CATEGORIES), not default categories (CATEGORIES_DEFAULT)
      syncFromFirebaseAndUpdate();
    } catch (error: any) {
      console.error("❌ Failed to load categories:", error);
      console.error("❌ Error details:", error?.message, error?.stack);
      setIsLoading(false);
      // Don't throw error, just show alert
      Alert.alert(
        "Lỗi",
        `Không thể tải danh mục: ${error?.message || "Unknown error"}`
      );
    }
  };

  /**
   * Sync user categories từ Firebase và cập nhật UI
   * Note: Default categories (CATEGORIES_DEFAULT) are read-only, only sync user categories (CATEGORIES)
   */
  const syncFromFirebaseAndUpdate = async () => {
    if (!userId) return;

    try {
      console.log("🔄 Starting Firebase sync for user categories...");
      const CategoryService = (await import("./services/categoryService"))
        .default;

      // ✅ BƯỚC 1: Sync user categories từ Firebase → SQLite
      const syncResult = await CategoryService.syncFirebaseToSQLite(userId);

      if (syncResult.synced > 0 || syncResult.conflicts > 0) {
        console.log(
          `🔄 Synced ${syncResult.synced} user categories from Firebase, resolved ${syncResult.conflicts} conflicts`
        );

        // ✅ BƯỚC 2: Reload default categories from Firebase (always fresh)
        console.log("📋 Reloading default categories from Firebase...");
        const defaultCatsFromFirebase =
          await CategoryService.loadDefaultCategoriesFromFirebase();
        console.log(
          `📋 Reloaded ${defaultCatsFromFirebase.length} default categories from Firebase`
        );

        // ✅ BƯỚC 3: Reload user categories from SQLite (after sync)
        console.log("📋 Reloading user categories from SQLite...");
        const userCatsFromSQLite =
          await CategoryService.loadUserCategoriesFromSQLite(userId);
        console.log(
          `📋 Reloaded ${userCatsFromSQLite.length} user categories from SQLite`
        );

        // ✅ BƯỚC 4: Combine categories again
        const combined: Category[] = [];

        // Add user categories first
        userCatsFromSQLite.forEach((cat) => {
          combined.push({
            ...cat,
            isSystemDefault: false,
          });
        });

        // Add default categories that are not in user list
        defaultCatsFromFirebase.forEach((defaultCat) => {
          const existsInUser = userCatsFromSQLite.some(
            (userCat) =>
              userCat.name.toLowerCase().trim() ===
                defaultCat.name.toLowerCase().trim() &&
              userCat.type === defaultCat.type
          );

          if (!existsInUser) {
            combined.push({
              ...defaultCat,
              isSystemDefault: true,
            });
          }
        });

        // ✅ BƯỚC 5: Filter by selected budget group
        const filteredCats = combined.filter((cat) => {
          const catBudgetGroup =
            cat.budget_group ||
            (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
          return catBudgetGroup === selectedBudgetGroup;
        });

        // Separate default and user categories
        const defaultCats = combined.filter((cat) => cat.isSystemDefault);
        const userCats = combined.filter((cat) => !cat.isSystemDefault);

        // ✅ BƯỚC 6: Update UI
        setCategories(filteredCats as Category[]);
        setDefaultCategories(defaultCats);
        setUserCategories(userCats);

        console.log(
          `✅ Updated UI with ${filteredCats.length} categories after Firebase sync (${defaultCats.length} default + ${userCats.length} user total)`
        );
      } else {
        console.log("ℹ️ No user categories to sync from Firebase");
      }

      // ✅ BƯỚC 7: Sync unsynced user categories to Firebase
      const syncToFirebaseResult =
        await CategoryService.syncAllUnsyncedCategories(userId);
      if (syncToFirebaseResult.synced > 0) {
        console.log(
          `✅ Synced ${syncToFirebaseResult.synced} user categories to Firebase`
        );
      }
      if (syncToFirebaseResult.failed > 0) {
        console.warn(
          `⚠️ Failed to sync ${syncToFirebaseResult.failed} categories:`,
          syncToFirebaseResult.errors
        );
      }
    } catch (error: any) {
      console.warn("⚠️ Failed to sync from Firebase:", error);
      console.warn("⚠️ Error details:", error?.message, error?.stack);
      // App vẫn hoạt động bình thường với data local
    }
  };

  /**
   * 🔄 SYNC FIREBASE Ở BACKGROUND - KHÔNG BLOCK UI
   * Full sync: Pull from Firebase → Push to Firebase
   */
  const syncFirebaseInBackground = async () => {
    if (!userId) return;

    try {
      setIsSyncing(true);
      console.log("🔄 Background sync started...");

      const CategoryService = (await import("./services/categoryService"))
        .default;

      // Thực hiện full sync (pull + push)
      const pullResult = await CategoryService.syncFirebaseToSQLite(userId);
      const pushResult = await CategoryService.syncSQLiteToFirebase(userId);

      const syncResult = {
        pull: pullResult,
        push: pushResult,
      };

      console.log(
        `✅ Full sync completed: Pulled ${syncResult.pull.synced}, Pushed ${syncResult.push.pushed}`
      );

      // Sau khi sync xong, reload combined categories để có data mới nhất
      const updatedCategories = await CategoryService.getCombinedCategories(
        userId
      );
      const filteredCats = updatedCategories.filter((cat) => {
        const catBudgetGroup =
          cat.budget_group ||
          (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
        return catBudgetGroup === selectedBudgetGroup;
      });

      // Separate default and user categories
      const defaultCats = updatedCategories.filter(
        (cat) => cat.isSystemDefault
      );
      const userCats = updatedCategories.filter((cat) => !cat.isSystemDefault);

      // Update UI với dữ liệu mới nhất
      setCategories(filteredCats as Category[]);
      setDefaultCategories(defaultCats);
      setUserCategories(userCats);
      console.log(
        `🔃 UI updated with ${filteredCats.length} categories after sync`
      );
    } catch (error) {
      console.warn("Background sync failed, using local data:", error);
      // App vẫn hoạt động bình thường với data local
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * ➕ THÊM CATEGORY MỚI - VỚI KIỂM TRA TRÙNG TÊN
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

    const trimmedName = newCategoryName.trim();

    // ✅ Lấy type từ budget_group
    const categoryType = getTypeFromBudgetGroup(selectedBudgetGroup);

    try {
      // ✅ BƯỚC 1: KIỂM TRA TRÙNG TÊN TRONG SQLITE
      const existingCategoryId = await DatabaseService.categoryExistsByName(
        userId,
        trimmedName,
        categoryType
      );

      if (existingCategoryId) {
        Alert.alert(
          "Thông báo",
          `Phân loại "${trimmedName}" (${selectedBudgetGroup}) đã tồn tại trong cơ sở dữ liệu. Vui lòng chọn tên khác.`
        );
        return;
      }

      // ✅ BƯỚC 2: LƯU CATEGORY VÀO SQLITE (Sử dụng saveUserCategory)
      const CategoryService = (await import("./services/categoryService"))
        .default;

      console.log(
        `💾 Saving category: ${trimmedName} (${selectedBudgetGroup})`
      );
      const saveResult = await CategoryService.saveUserCategory(userId, {
        name: trimmedName,
        type: categoryType,
        icon: selectedIcon,
        color: selectedColor,
        budget_group: selectedBudgetGroup,
        isSystemDefault: false, // User-created category
      });

      if (!saveResult.success) {
        Alert.alert("Thông báo", saveResult.message);
        return;
      }

      console.log(`✅ Saved category to SQLite: ${trimmedName}`);

      // ✅ BƯỚC 3: CẬP NHẬT UI (Reload combined categories)
      const updatedCats = await CategoryService.getCombinedCategories(userId);
      const filteredCats = updatedCats.filter((cat) => {
        const catBudgetGroup =
          cat.budget_group ||
          (cat.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
        return catBudgetGroup === selectedBudgetGroup;
      });

      // Separate default and user categories
      const defaultCats = updatedCats.filter((cat) => cat.isSystemDefault);
      const userCats = updatedCats.filter((cat) => !cat.isSystemDefault);

      setCategories(filteredCats as Category[]);
      setDefaultCategories(defaultCats);
      setUserCategories(userCats);
      console.log("🎨 UI updated");

      // ✅ BƯỚC 4: SYNC LÊN FIREBASE NGAY LẬP TỨC (nếu có category được lưu)
      if (saveResult.category) {
        console.log(
          `🔄 Syncing category to Firebase immediately: ${saveResult.category.id}`
        );
        try {
          const syncResult = await CategoryService.syncCategoryToFirebase(
            userId,
            saveResult.category.id
          );
          if (syncResult.synced) {
            console.log(
              `✅ Synced category to Firebase: ${saveResult.category?.name}`
            );
          } else {
            console.warn(`⚠️ Failed to sync category: ${syncResult.message}`);
            // Still show success message, but warn about sync
            Alert.alert(
              "Thành công",
              `Đã thêm phân loại "${trimmedName}". ${syncResult.message}`,
              [{ text: "OK" }]
            );
            return;
          }
        } catch (error: any) {
          console.error("❌ Error syncing category to Firebase:", error);
          Alert.alert(
            "Cảnh báo",
            `Đã thêm phân loại "${trimmedName}" nhưng không thể đồng bộ lên Firebase. Sẽ thử lại sau.`,
            [{ text: "OK" }]
          );
          return;
        }
      }

      // Reset form
      setNewCategoryName("");
      setSelectedIcon("food-apple");
      setSelectedColor("#FF6347");
      setSelectedBudgetGroup("Chi tiêu");

      Alert.alert(
        "Thành công",
        `Đã thêm phân loại "${trimmedName}" và đồng bộ lên Firebase`,
        [
          {
            text: "OK",
            onPress: () => {
              // Reload categories before going back
              loadCategoriesFromSQLite();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      // ❌ NẾU LỖI: XỬ LÝ
      console.error("Error saving category:", error);

      const errorMessage = error?.message || String(error);

      // Kiểm tra nếu lỗi là do trùng tên
      if (
        errorMessage.includes("UNIQUE constraint") ||
        errorMessage.includes("already exists")
      ) {
        Alert.alert(
          "Thông báo",
          `Phân loại "${trimmedName}" đã tồn tại. Vui lòng chọn tên khác.`
        );
      } else {
        Alert.alert("Lỗi", "Không thể lưu phân loại. Vui lòng thử lại.");
      }
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

      {/* ✅ CẬP NHẬT: Budget Group Selection - Chỉ có 2 nhóm với số lượng danh mục */}
      <View style={styles.budgetGroupSection}>
        <Text style={styles.sectionTitle}>Nhóm chi phí</Text>
        <View style={styles.budgetGroupContainer}>
          {budgetGroups.map((group) => {
            const groupCount =
              group === "Chi tiêu" ? chiTieuCount : thuNhapCount;
            return (
              <TouchableOpacity
                key={group}
                style={[
                  styles.budgetGroupButton,
                  selectedBudgetGroup === group &&
                    styles.budgetGroupButtonActive,
                ]}
                onPress={() => setSelectedBudgetGroup(group)}
              >
                <Icon
                  name={group === "Chi tiêu" ? "cash-minus" : "cash-plus"}
                  size={20}
                  color={selectedBudgetGroup === group ? "#fff" : "#666"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.budgetGroupButtonText,
                    selectedBudgetGroup === group &&
                      styles.budgetGroupButtonTextActive,
                  ]}
                >
                  {group}
                </Text>
                <View
                  style={[
                    styles.categoryCountBadge,
                    selectedBudgetGroup === group &&
                      styles.categoryCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryCountBadgeText,
                      selectedBudgetGroup === group &&
                        styles.categoryCountBadgeTextActive,
                    ]}
                  >
                    {groupCount}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ✅ CẬP NHẬT: Hiển thị phân loại theo nhóm đã chọn */}
      <View style={styles.existingCategoriesSection}>
        <Text style={styles.sectionTitle}>
          Phân loại hiện có - {selectedBudgetGroup} (
          {currentDisplayCategories.length})
        </Text>

        {/* ✅ Hiển thị categories theo selectedBudgetGroup */}
        {currentDisplayCategories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
          >
            {currentDisplayCategories.map((cat) => {
              const isDefault =
                cat.is_system_default === 1 || cat.isSystemDefault;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryChip}
                  onPress={async () => {
                    // Handle category selection
                    if (isDefault) {
                      // If default category is selected, add it to user categories
                      if (userId) {
                        const CategoryService = (
                          await import("./services/categoryService")
                        ).default;
                        console.log(
                          `➕ Adding default category to user categories: ${cat.name}`
                        );

                        const result = await CategoryService.saveUserCategory(
                          userId,
                          {
                            id: cat.id,
                            name: cat.name,
                            type: cat.type || "EXPENSE",
                            icon: cat.icon,
                            color: cat.color,
                            budget_group: cat.budget_group,
                            isSystemDefault: true, // Mark as system default
                          }
                        );

                        if (result.success) {
                          console.log(`✅ Added default category: ${cat.name}`);
                          // Sync to Firebase
                          if (result.category) {
                            CategoryService.syncCategoryToFirebase(
                              userId,
                              result.category.id
                            )
                              .then((syncResult) => {
                                if (syncResult.synced) {
                                  console.log(
                                    `✅ Synced default category to Firebase: ${cat.name}`
                                  );
                                } else {
                                  console.warn(
                                    `⚠️ Failed to sync: ${syncResult.message}`
                                  );
                                }
                              })
                              .catch((error) => {
                                console.warn(
                                  "⚠️ Error syncing default category:",
                                  error
                                );
                              });
                          }
                          // Reload categories
                          loadCategoriesFromSQLite();
                          Alert.alert(
                            "Thành công",
                            `Đã thêm danh mục "${cat.name}" vào danh mục của bạn.`
                          );
                        } else {
                          Alert.alert("Thông báo", result.message);
                        }
                      }
                    }
                  }}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: cat.color || "#2196F3" },
                    ]}
                  >
                    <Icon name={cat.icon || "tag"} size={20} color="#fff" />
                  </View>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  {isDefault && (
                    <Icon
                      name="star"
                      size={14}
                      color="#FFD700"
                      style={{ marginLeft: 4 }}
                    />
                  )}
                  {!isDefault && (
                    <TouchableOpacity
                      onPress={async (e) => {
                        e.stopPropagation();
                        // Handle delete user category
                        if (userId) {
                          Alert.alert(
                            "Xóa danh mục",
                            `Bạn có chắc chắn muốn xóa danh mục "${cat.name}"?`,
                            [
                              { text: "Hủy", style: "cancel" },
                              {
                                text: "Xóa",
                                style: "destructive",
                                onPress: async () => {
                                  const CategoryService = (
                                    await import("./services/categoryService")
                                  ).default;
                                  const result =
                                    await CategoryService.deleteCategory(
                                      userId,
                                      cat.id
                                    );
                                  if (result.success) {
                                    Alert.alert("Thành công", result.message);
                                    loadCategoriesFromSQLite();
                                  } else {
                                    Alert.alert("Lỗi", result.message);
                                  }
                                },
                              },
                            ]
                          );
                        }
                      }}
                      style={{ marginLeft: 4 }}
                    >
                      <Icon name="close-circle" size={14} color="#FF6B6B" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.emptyCategoryText}>
            Chưa có phân loại nào cho nhóm {selectedBudgetGroup}.
          </Text>
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

      <View style={styles.iconSection}>
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
  budgetGroupSection: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  budgetGroupContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  budgetGroupButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  budgetGroupButtonActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  budgetGroupButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  budgetGroupButtonTextActive: {
    color: "#fff",
  },
  categoryCountBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  categoryCountBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  categoryCountBadgeTextActive: {
    color: "#fff",
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
  iconSection: {
    backgroundColor: "#fff",
    paddingBottom: 16,
  },
});

export default CategoryManagementScreen;

// src/Nhap.tsx
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react"; // Đã có
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Category, RootStackParamList } from "../App";
import { COLLECTIONS } from "./constants/collections";
import {
  CategoryService,
  TransactionService,
} from "./database/databaseService";
import { authInstance as auth, db } from "./firebaseConfig"; // Đã có
import SyncEngine from "./service/sync/SyncEngine";

type NhapGiaoDichNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Nhap"
>;
type NhapGiaoDichRouteProp = RouteProp<RootStackParamList, "Nhap">;

const NhapGiaoDich = () => {
  const navigation = useNavigation<NhapGiaoDichNavigationProp>();
  const route = useRoute<NhapGiaoDichRouteProp>();

  const [userId, setUserId] = useState<string | null>(null);

  const initialCategory = route.params?.selectedCategory || null;
  const initialTransactionType = route.params?.transactionType || "expense";

  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"expense" | "income">(
    initialTransactionType
  );
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    initialCategory
  );
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ THÊM MỚI: State loading cho danh sách category
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // useEffect lấy userId (Giữ nguyên)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // ✅ HÀM MỚI: Tách riêng logic load từ SQLite (bao gồm default và user categories)
  const loadCategoriesFromSQLite = async (currentUserId: string) => {
    try {
      // ✅ BƯỚC 1: ĐẢM BẢO CATEGORIES ĐÃ ĐƯỢC KHỞI TẠO (bao gồm default categories)
      try {
        const { ensureCategoriesInitialized } = await import(
          "./database/databaseService"
        );
        await ensureCategoriesInitialized(currentUserId);
      } catch (initError) {
        console.warn("Failed to ensure categories initialized:", initError);
      }

      // ✅ BƯỚC 2: LOAD TẤT CẢ CATEGORIES TỪ SQLite (default + user categories)
      const allCategories = await CategoryService.getCategoriesByUser(
        currentUserId
      );

      // ✅ BƯỚC 3: FILTER deleted_at IS NULL VÀ is_hidden = 0
      const expense = allCategories
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
          count: 0, // Required by Category type
        }));

      const income = allCategories
        .filter(
          (cat: any) =>
            cat.type === "INCOME" && !cat.deleted_at && !cat.is_hidden
        )
        .map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || "tag",
          color: cat.color || "#2196F3",
          count: 0, // Required by Category type
        }));

      console.log(
        `💾 Loaded ${expense.length} expense & ${income.length} income from SQLite (including default categories)`
      );
      return { expense, income };
    } catch (error) {
      console.error("Error loading categories from SQLite:", error);
      return { expense: [], income: [] }; // Trả về rỗng nếu lỗi
    }
  };

  // ✅ HELPER FUNCTION: Sync categories from Firebase to SQLite và update UI
  const handleCategorySyncFromFirebase = useCallback(
    async (currentUserId: string, isActiveFlag: boolean) => {
      try {
        console.log("🔄 Syncing categories from Firebase to SQLite...");

        // Sync Firebase → SQLite
        await SyncEngine.pullRemoteChanges(currentUserId);

        // Reload từ SQLite sau khi sync
        const syncedData = await loadCategoriesFromSQLite(currentUserId);

        if (isActiveFlag) {
          setExpenseCategories(syncedData.expense);
          setIncomeCategories(syncedData.income);

          // Cập nhật selectedCategory nếu nó không còn tồn tại
          setSelectedCategory((currentSelected) => {
            if (currentSelected) {
              const allCats = [...syncedData.expense, ...syncedData.income];
              const categoryExists = allCats.some(
                (c) => c.id === currentSelected.id
              );
              if (!categoryExists) {
                return activeTab === "expense"
                  ? syncedData.expense[0] || null
                  : syncedData.income[0] || null;
              }
            }
            return currentSelected;
          });

          console.log("🔃 UI updated with synced category data from Firebase");
        }
      } catch (error) {
        console.warn("Failed to sync categories from Firebase:", error);
      }
    },
    [activeTab]
  );

  // ✅ CẬP NHẬT: useFocusEffect với logic "Load -> Sync -> Reload"
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      let isActive = true; // Cờ để tránh cập nhật state nếu component đã unmount

      console.log("Screen focused: Initializing categories...");
      setIsLoadingCategories(true);

      // ✅ BƯỚC 1: Load từ SQLite (Nhanh) - Bao gồm default và user categories
      loadCategoriesFromSQLite(userId).then((localData) => {
        if (isActive) {
          setExpenseCategories(localData.expense);
          setIncomeCategories(localData.income);

          // Cập nhật selectedCategory nếu nó không còn tồn tại
          setSelectedCategory((currentSelected) => {
            if (currentSelected) {
              const allCats = [...localData.expense, ...localData.income];
              const categoryExists = allCats.some(
                (c) => c.id === currentSelected.id
              );
              if (!categoryExists) {
                return activeTab === "expense"
                  ? localData.expense[0] || null
                  : localData.income[0] || null;
              }
            } else if (!initialCategory) {
              // Nếu chưa chọn, gán mặc định
              return activeTab === "expense"
                ? localData.expense[0] || null
                : localData.income[0] || null;
            }
            return currentSelected;
          });

          setIsLoadingCategories(false);
        }
      });

      // ✅ BƯỚC 2: SETUP FIREBASE REALTIME LISTENER (để đồng bộ với các màn hình khác)
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
          // Check if there are actual changes
          const changes = snapshot.docChanges();
          if (changes.length === 0) {
            return; // No changes, skip sync
          }

          const now = Date.now();
          // Debounce: skip if synced too recently
          if (now - lastCategorySyncTime < CATEGORY_SYNC_DEBOUNCE_MS) {
            // Clear existing timeout and set a new one
            if (categorySyncTimeout) {
              clearTimeout(categorySyncTimeout);
            }
            categorySyncTimeout = setTimeout(async () => {
              await handleCategorySyncFromFirebase(userId, isActive);
              lastCategorySyncTime = Date.now();
            }, CATEGORY_SYNC_DEBOUNCE_MS);
            return;
          }

          lastCategorySyncTime = now;
          await handleCategorySyncFromFirebase(userId, isActive);
        },
        (error) => {
          console.error("Firebase categories listener error:", error);
          if (isActive) {
            setIsLoadingCategories(false);
          }
        }
      );

      // ✅ BƯỚC 3: Background sync (chỉ push local changes lên Firebase)
      // Không cần full sync vì đã có realtime listener
      SyncEngine.pushLocalChanges(userId).catch((syncError) => {
        console.warn("Failed to push local changes:", syncError);
      });

      // Return cleanup function
      return () => {
        isActive = false;
        if (categorySyncTimeout) {
          clearTimeout(categorySyncTimeout);
        }
        unsubscribeCategories();
      };
    }, [userId, handleCategorySyncFromFirebase]) // Chỉ chạy lại khi userId hoặc handleCategorySyncFromFirebase thay đổi
  );

  // ... (Tất cả các hàm khác: formatDate, formatTime, handleNumberPress, handleSave, v.v.
  //     đều giữ nguyên, không cần thay đổi)
  // ...
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (time: Date): string => {
    const hours = time.getHours().toString().padStart(2, "0");
    const minutes = time.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatAmount = (value: string): string => {
    if (value === "0") return "0";
    const cleanValue = value.replace(/,/g, "");
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleNumberPress = (num: string) => {
    if (amount === "0") {
      setAmount(num);
    } else {
      setAmount(amount + num);
    }
  };

  const handleOperatorPress = (op: string) => {
    setAmount(amount + op);
  };

  const handleCalculate = () => {
    try {
      const cleanAmount = amount.replace(/,/g, "");
      const result = eval(cleanAmount);
      setAmount(result.toString());
    } catch (error) {
      Alert.alert("Lỗi", "Phép tính không hợp lệ");
      setAmount("0");
    }
  };

  const handleBackspace = () => {
    if (amount.length > 1) {
      setAmount(amount.slice(0, -1));
    } else {
      setAmount("0");
    }
  };

  const handleClear = () => {
    setAmount("0");
  };

  const handleSave = async () => {
    if (!selectedCategory) {
      Alert.alert("Lỗi", "Vui lòng chọn danh mục");
      return;
    }

    if (amount === "0" || amount === "") {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền");
      return;
    }

    if (!userId) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng");
      return;
    }

    try {
      setIsSaving(true);

      const cleanAmount = amount.replace(/,/g, "");
      const finalAmount = parseFloat(eval(cleanAmount));

      const transactionDateTime = new Date(date);
      transactionDateTime.setHours(time.getHours());
      transactionDateTime.setMinutes(time.getMinutes());

      const transactionData = {
        id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        category_id: selectedCategory.id,
        amount: finalAmount,
        type: activeTab.toUpperCase(),
        date: transactionDateTime.getTime(),
        description: note,
        payment_method: "CASH",
        merchant_name: "",
      };

      await TransactionService.createTransaction(transactionData);
      console.log("✅ Transaction saved to SQLite");

      try {
        await SyncEngine.performSync(userId, true);
        console.log("✅ Transaction synced to Firebase");
      } catch (err: any) {
        console.error("⚠️ Sync failed, will retry later:", err);
      }

      setAmount("0");
      setNote("");
      setDate(new Date());
      setTime(new Date());

      Alert.alert("Thành công", "Giao dịch đã được lưu", [
        {
          text: "Thêm tiếp",
          style: "cancel",
        },
        {
          text: "Xong",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error("Error saving transaction:", error);
      Alert.alert(
        "Lỗi",
        "Không thể lưu giao dịch: " + (error as Error).message
      );
    } finally {
      setIsSaving(false);
    }
  };

  const currentCategories =
    activeTab === "expense" ? expenseCategories : incomeCategories;

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => {
        setSelectedCategory(item);
        setShowCategoryModal(false);
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.color }]}>
        <Icon name={item.icon} size={26} color="#fff" />
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  // ... (Phần return JSX từ <View style={styles.container}>
  //     cho đến <View style={styles.modalHeader}> giữ nguyên)
  // ...
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { backgroundColor: selectedCategory?.color || "#1E88E5" },
        ]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {activeTab === "expense" ? "Thêm chi tiêu" : "Thêm thu nhập"}
          </Text>

          <TouchableOpacity style={styles.moreButton} activeOpacity={0.8}>
            <Icon name="dots-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.categoryButton}
          onPress={() => setShowCategoryModal(true)}
          activeOpacity={0.8}
        >
          {selectedCategory ? ( // ✅ CẬP NHẬT: Thêm kiểm tra
            <>
              <View style={styles.selectedCategoryIconWrapper}>
                <View
                  style={[
                    styles.selectedCategoryIcon,
                    { backgroundColor: selectedCategory.color },
                  ]}
                >
                  <Icon name={selectedCategory.icon} size={36} color="#fff" />
                </View>
              </View>
              <Text style={styles.selectedCategoryName}>
                {selectedCategory.name}
              </Text>
              <Icon
                name="chevron-down"
                size={20}
                color="rgba(255,255,255,0.8)"
              />
            </>
          ) : (
            // ✅ CẬP NHẬT: Hiển thị text "Đang tải..."
            <Text style={styles.selectedCategoryName}>
              Đang tải danh mục...
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.amountContainer}>
          <Text style={styles.currencySymbol}>₫</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.amountText}>{formatAmount(amount)}</Text>
          </ScrollView>
        </View>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.formCard}>
          <TouchableOpacity
            style={styles.formRow}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.formIconWrapper}>
              <Icon name="calendar" size={20} color="#1E88E5" />
            </View>
            <View style={styles.formContent}>
              <Text style={styles.formLabel}>Ngày</Text>
              <Text style={styles.formValue}>{formatDate(date)}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#BDBDBD" />
          </TouchableOpacity>

          <View style={styles.formDivider} />

          <TouchableOpacity
            style={styles.formRow}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.formIconWrapper}>
              <Icon name="clock-outline" size={20} color="#1E88E5" />
            </View>
            <View style={styles.formContent}>
              <Text style={styles.formLabel}>Thời gian</Text>
              <Text style={styles.formValue}>{formatTime(time)}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#BDBDBD" />
          </TouchableOpacity>

          <View style={styles.formDivider} />

          <View style={styles.formRow}>
            <View style={styles.formIconWrapper}>
              <Icon name="note-text-outline" size={20} color="#1E88E5" />
            </View>
            <View style={styles.formContent}>
              <Text style={styles.formLabel}>Ghi chú</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Thêm ghi chú..."
                value={note}
                onChangeText={setNote}
                placeholderTextColor="#BDBDBD"
              />
            </View>
          </View>
        </View>

        <View style={styles.quickNotesSection}>
          <Text style={styles.quickNotesTitle}>Ghi chú nhanh</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickNotesContainer}
          >
            {["Ăn sáng", "Ăn trưa", "Ăn tối", "Cafe", "Xăng xe"].map(
              (quickNote) => (
                <TouchableOpacity
                  key={quickNote}
                  style={styles.quickNoteChip}
                  onPress={() => setNote(quickNote)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickNoteText}>{quickNote}</Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        </View>
      </View>

      <View style={styles.calculator}>
        <View style={styles.calculatorRow}>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("7")}
          >
            <Text style={styles.calcButtonText}>7</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("8")}
          >
            <Text style={styles.calcButtonText}>8</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("9")}
          >
            <Text style={styles.calcButtonText}>9</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButtonOperator}
            onPress={() => handleOperatorPress("/")}
          >
            <Icon name="division" size={24} color="#1E88E5" />
          </TouchableOpacity>
        </View>

        <View style={styles.calculatorRow}>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("4")}
          >
            <Text style={styles.calcButtonText}>4</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("5")}
          >
            <Text style={styles.calcButtonText}>5</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("6")}
          >
            <Text style={styles.calcButtonText}>6</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButtonOperator}
            onPress={() => handleOperatorPress("*")}
          >
            <Icon name="close" size={24} color="#1E88E5" />
          </TouchableOpacity>
        </View>

        <View style={styles.calculatorRow}>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("1")}
          >
            <Text style={styles.calcButtonText}>1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("2")}
          >
            <Text style={styles.calcButtonText}>2</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("3")}
          >
            <Text style={styles.calcButtonText}>3</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButtonOperator}
            onPress={() => handleOperatorPress("-")}
          >
            <Icon name="minus" size={24} color="#1E88E5" />
          </TouchableOpacity>
        </View>

        <View style={styles.calculatorRow}>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress("0")}
          >
            <Text style={styles.calcButtonText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButton}
            onPress={() => handleNumberPress(".")}
          >
            <Text style={styles.calcButtonText}>.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.calcButton} onPress={handleBackspace}>
            <Icon name="backspace-outline" size={24} color="#757575" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.calcButtonOperator}
            onPress={() => handleOperatorPress("+")}
          >
            <Icon name="plus" size={24} color="#1E88E5" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.saveButton,
          { backgroundColor: selectedCategory?.color || "#1E88E5" },
        ]}
        onPress={handleSave}
        disabled={isSaving}
        activeOpacity={0.8}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Icon name="check" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Lưu</Text>
          </>
        )}
      </TouchableOpacity>

      {/* ... Modal ... */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {/* ✅ CẬP NHẬT: Tab để chuyển đổi giữa Chi tiêu và Thu nhập với số lượng danh mục */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={[
                  styles.modalTab,
                  activeTab === "expense" && styles.modalTabActive,
                ]}
                onPress={() => {
                  setActiveTab("expense");
                  setSelectedCategory(expenseCategories[0] || null);
                }}
              >
                <Icon
                  name="arrow-up"
                  size={16}
                  color={activeTab === "expense" ? "#E53935" : "#9E9E9E"}
                />
                <Text
                  style={[
                    styles.modalTabText,
                    activeTab === "expense" && styles.modalTabTextActive,
                  ]}
                >
                  Chi tiêu
                </Text>
                <View style={styles.categoryCountBadge}>
                  <Text style={styles.categoryCountText}>
                    {expenseCategories.length}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <TouchableOpacity
                style={[
                  styles.modalTab,
                  activeTab === "income" && styles.modalTabActive,
                ]}
                onPress={() => {
                  setActiveTab("income");
                  setSelectedCategory(incomeCategories[0] || null);
                }}
              >
                <Icon
                  name="arrow-down"
                  size={16}
                  color={activeTab === "income" ? "#43A047" : "#9E9E9E"}
                />
                <Text
                  style={[
                    styles.modalTabText,
                    activeTab === "income" && styles.modalTabTextActive,
                  ]}
                >
                  Thu nhập
                </Text>
                <View style={styles.categoryCountBadge}>
                  <Text style={styles.categoryCountText}>
                    {incomeCategories.length}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* ✅ CẬP NHẬT: Thêm ActivityIndicator khi đang load */}
            {isLoadingCategories ? (
              <ActivityIndicator
                size="large"
                color="#1E88E5"
                style={{ marginVertical: 40 }}
              />
            ) : (
              <FlatList
                data={currentCategories}
                renderItem={renderCategoryItem}
                keyExtractor={(item) => item.id}
                numColumns={4}
                contentContainerStyle={styles.categoryGrid}
                ListEmptyComponent={
                  <View style={styles.emptyCategoryContainer}>
                    <Text style={styles.emptyCategoryText}>
                      Chưa có danh mục{" "}
                      {activeTab === "expense" ? "chi tiêu" : "thu nhập"}
                    </Text>
                  </View>
                }
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ... DateTimePicker ... (Giữ nguyên) */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setDate(selectedDate);
            }
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={time}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) {
              setTime(selectedTime);
            }
          }}
        />
      )}
    </View>
  );
};

// ... (Toàn bộ phần styles giữ nguyên y hệt)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: { paddingTop: 50, paddingBottom: 20 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#fff" },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignSelf: "center",
    marginBottom: 20,
    gap: 8,
  },
  selectedCategoryIconWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCategoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedCategoryName: { fontSize: 16, fontWeight: "600", color: "#fff" },
  amountContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    minHeight: 60,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.9)",
    marginRight: 8,
  },
  amountText: {
    fontSize: 48,
    fontWeight: "300",
    color: "#fff",
    letterSpacing: -1,
  },
  formContainer: { flex: 1, marginTop: -16 },
  formCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  formIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  formContent: { flex: 1 },
  formLabel: {
    fontSize: 13,
    color: "#757575",
    marginBottom: 4,
    fontWeight: "500",
  },
  formValue: { fontSize: 16, color: "#212121", fontWeight: "600" },
  formDivider: { height: 1, backgroundColor: "#F5F5F5", marginLeft: 68 },
  noteInput: { fontSize: 16, color: "#212121", fontWeight: "500", padding: 0 },
  quickNotesSection: { paddingHorizontal: 16, marginBottom: 16 },
  quickNotesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#424242",
    marginBottom: 12,
  },
  quickNotesContainer: { flexDirection: "row", gap: 8 },
  quickNoteChip: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginRight: 8,
  },
  quickNoteText: { fontSize: 13, color: "#424242", fontWeight: "500" },
  calculator: {
    backgroundColor: "#fff",
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  calculatorRow: { flexDirection: "row", marginBottom: 8, gap: 8 },
  calcButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  calcButtonOperator: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  calcButtonText: { fontSize: 28, color: "#212121", fontWeight: "400" },
  saveButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    gap: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  modalTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  modalTabActive: { backgroundColor: "#F5F5F5" },
  modalTabText: { fontSize: 14, color: "#9E9E9E", fontWeight: "500" },
  modalTabTextActive: { color: "#212121", fontWeight: "700" },
  modalDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 8,
  },
  categoryCountBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  categoryGrid: { padding: 16 },
  emptyCategoryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyCategoryText: {
    fontSize: 14,
    color: "#9E9E9E",
    textAlign: "center",
  },
  categoryItem: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryName: {
    fontSize: 12,
    color: "#424242",
    textAlign: "center",
    fontWeight: "500",
  },
});

export default NhapGiaoDich;

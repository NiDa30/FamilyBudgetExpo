import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  CameraView,
  PermissionStatus,
  useCameraPermissions,
} from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { CategoryRepository } from "./database/repositories";
import { Category, Transaction, TransactionType } from "./domain/types";
import { auth, db } from "./firebaseConfig";
import SyncEngine from "./service/sync/SyncEngine";
import { TransactionService } from "./service/transactions";

type QuethoadonNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Quethoadon"
>;

interface ExpenseItem {
  name: string;
  quantity: number;
  amount: number;
}

interface ExpenseData {
  store: string;
  address: string;
  phone: string;
  date: string;
  time: string;
  total: number;
  tax: number;
  discount: number;
  items: ExpenseItem[];
  method: string;
  createdAt: string;
  rawText?: string;
}

const Quethoadon = () => {
  const navigation = useNavigation<QuethoadonNavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();

  const [photo, setPhoto] = useState<string | null>(null);
  const [expensesData, setExpensesData] = useState<ExpenseData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"camera" | "result">("camera");
  const cameraRef = useRef<CameraView>(null);

  // ✅ NEW STATES: Category selection and editing
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState<ExpenseItem>({
    name: "",
    quantity: 1,
    amount: 0,
  });

  // ✅ HELPER FUNCTION: Load categories from SQLite or Firebase (fallback)
  const loadCategoriesFromSQLiteOrFirebase = async (
    userId: string
  ): Promise<Category[]> => {
    try {
      if (!userId) {
        console.warn(
          "loadCategoriesFromSQLiteOrFirebase: userId is null or undefined"
        );
        return [];
      }

      // Try SQLite first
      console.log("📥 Attempting to load categories from SQLite...");
      let sqliteCategories: Category[] = [];
      try {
        sqliteCategories = await CategoryRepository.listByUser(userId);
        console.log(
          `📊 SQLite returned ${sqliteCategories?.length || 0} categories`
        );
      } catch (sqliteError) {
        console.warn("Failed to load from SQLite:", sqliteError);
        sqliteCategories = [];
      }

      if (sqliteCategories && sqliteCategories.length > 0) {
        // Debug: Log category types
        console.log(
          "📋 SQLite categories with types:",
          sqliteCategories.map((c) => ({
            name: c.name,
            type: c.type,
            hasType: !!c.type,
          }))
        );

        // Ensure all categories have a type (default to EXPENSE if missing)
        const categoriesWithType = sqliteCategories.map((cat) => ({
          ...cat,
          type: cat.type || "EXPENSE", // Default to EXPENSE if type is missing
        }));

        console.log(
          `✅ Loaded ${categoriesWithType.length} categories from SQLite`
        );
        return categoriesWithType;
      }

      // If SQLite is empty or failed, try Firebase
      console.log("⚠️ SQLite empty or failed, loading from Firebase...");
      let firebaseCategories: any[] = [];
      try {
        const FirebaseService = (
          await import("./service/firebase/FirebaseService")
        ).default;
        firebaseCategories = await FirebaseService.getCategories(userId);
        console.log(
          `📊 Firebase returned ${firebaseCategories?.length || 0} categories`
        );
      } catch (firebaseError) {
        console.warn("Failed to load from Firebase:", firebaseError);
        firebaseCategories = [];
      }

      if (firebaseCategories && firebaseCategories.length > 0) {
        console.log(
          `✅ Loaded ${firebaseCategories.length} categories from Firebase`
        );

        // Map Firebase categories to Category type
        const mappedCategories: Category[] = firebaseCategories.map(
          (cat: any) => {
            const categoryType = cat.type || "EXPENSE"; // Ensure type is set
            console.log(
              `📝 Mapping category: ${cat.name}, type: ${categoryType}, original type: ${cat.type}`
            );
            return {
              id: cat.id || cat.categoryID,
              userId: cat.userID || userId,
              name: cat.name,
              type: categoryType, // Ensure type is always set
              icon: cat.icon,
              color: cat.color,
              isSystemDefault: cat.isSystemDefault || false,
              displayOrder: cat.displayOrder || 0,
              isHidden: cat.isHidden || false,
              createdAt: cat.createdAt
                ? new Date(cat.createdAt).toISOString()
                : new Date().toISOString(),
            };
          }
        );

        console.log(
          "📋 Mapped categories with types:",
          mappedCategories.map((c) => ({ name: c.name, type: c.type }))
        );

        // Try to save to SQLite for next time
        try {
          const databaseServiceModule = await import(
            "./database/databaseService"
          );
          const databaseService =
            databaseServiceModule.default ||
            databaseServiceModule.DatabaseService;

          for (const category of mappedCategories) {
            try {
              await databaseService.createCategory({
                id: category.id,
                user_id: category.userId || userId,
                name: category.name,
                type: category.type || "EXPENSE", // Ensure type is set
                icon: category.icon || "tag",
                color: category.color || "#2196F3",
                is_system_default: category.isSystemDefault ? 1 : 0,
                display_order: category.displayOrder || 0,
                is_hidden: category.isHidden ? 1 : 0,
              });
            } catch (saveError) {
              console.warn(
                `Failed to save category ${category.id} to SQLite:`,
                saveError
              );
            }
          }
          console.log("✅ Saved Firebase categories to SQLite");
        } catch (saveError) {
          console.warn("Failed to save categories to SQLite:", saveError);
        }

        return mappedCategories;
      }

      // ✅ No categories found in SQLite or Firebase - Initialize default categories
      console.log(
        "⚠️ No categories found in SQLite or Firebase, initializing default categories..."
      );
      try {
        const { ensureCategoriesInitialized } = await import(
          "./database/databaseService"
        );
        await ensureCategoriesInitialized(userId);

        // Reload categories after initialization
        const initializedCategories = await CategoryRepository.listByUser(
          userId
        );
        if (initializedCategories && initializedCategories.length > 0) {
          console.log(
            `✅ Initialized ${initializedCategories.length} default categories`
          );
          const categoriesWithType = initializedCategories.map((cat) => ({
            ...cat,
            type: cat.type || "EXPENSE",
          }));
          return categoriesWithType;
        }
      } catch (initError) {
        console.error("Failed to initialize categories:", initError);
      }

      console.log("⚠️ No categories found after initialization attempt");
      return [];
    } catch (error) {
      console.error("Error loading categories:", error);
      return [];
    }
  };

  // ✅ ENHANCED CATEGORY LOADING WITH SQLITE AND FIREBASE SYNC
  useEffect(() => {
    const loadCategories = async () => {
      const user = auth.currentUser;
      if (!user || !user.uid) return;

      try {
        // ⚡ BƯỚC 0: ENSURE CATEGORIES ARE INITIALIZED
        try {
          const { ensureCategoriesInitialized } = await import(
            "./database/databaseService"
          );
          await ensureCategoriesInitialized(user.uid);
        } catch (initError) {
          console.warn("Failed to ensure categories initialized:", initError);
        }

        // ⚡ BƯỚC 1: LOAD TỪ SQLITE HOẶC FIREBASE (FALLBACK)
        const userCategories = await loadCategoriesFromSQLiteOrFirebase(
          user.uid
        );
        console.log(`💾 Loaded ${userCategories.length} categories total`);
        console.log(
          "📋 Initial categories:",
          userCategories.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            icon: c.icon,
            color: c.color,
          }))
        );

        // Filter EXPENSE categories for debugging
        const expenseCategories = userCategories.filter((cat) => {
          const hasType = !!cat.type;
          const isExpense = cat.type === "EXPENSE";
          if (!hasType) {
            console.warn(`⚠️ Category "${cat.name}" has no type field`);
          }
          return isExpense;
        });
        console.log(
          `💰 Found ${expenseCategories.length} EXPENSE categories out of ${userCategories.length} total`
        );
        console.log(
          "💰 EXPENSE categories:",
          expenseCategories.map((c) => ({ name: c.name, type: c.type }))
        );
        console.log(
          "📋 All categories:",
          userCategories.map((c) => ({
            name: c.name,
            type: c.type || "MISSING",
          }))
        );

        setCategories(userCategories);

        // 🔄 BƯỚC 2: SETUP FIREBASE REALTIME LISTENER
        const categoriesQuery = query(
          collection(db, "CATEGORIES"),
          where("userID", "==", user.uid)
        );

        const unsubscribe = onSnapshot(
          categoriesQuery,
          async (snapshot) => {
            const firebaseCategories = snapshot.docs.map((doc) => {
              const data = doc.data();
              const categoryType = data.type || "EXPENSE"; // Ensure type is set
              return {
                id: doc.id,
                userId: data.userID || user.uid,
                name: data.name,
                type: categoryType, // Ensure type is always set
                icon: data.icon,
                color: data.color,
                isSystemDefault: data.isSystemDefault || false,
                displayOrder: data.displayOrder,
                isHidden: data.isHidden || false,
                createdAt: data.createdAt?.toMillis?.()
                  ? new Date(data.createdAt.toMillis()).toISOString()
                  : data.createdAt || new Date().toISOString(),
              } as Category;
            });

            // 🔄 BƯỚC 3: SYNC FIREBASE → SQLITE IN BACKGROUND
            if (firebaseCategories.length > 0) {
              try {
                // Import databaseService to save categories
                const databaseServiceModule = await import(
                  "./database/databaseService"
                );
                const databaseService =
                  databaseServiceModule.default ||
                  databaseServiceModule.DatabaseService;

                // Get current SQLite categories for comparison
                let currentSQLiteCategories =
                  await CategoryRepository.listByUser(user.uid);

                for (const category of firebaseCategories) {
                  try {
                    // Check if category exists in SQLite (check both current list and already synced in this batch)
                    const exists = currentSQLiteCategories.some(
                      (c) => c.id === category.id
                    );

                    if (!exists) {
                      // Save new category to SQLite
                      await databaseService.createCategory({
                        id: category.id,
                        user_id: category.userId || user.uid,
                        name: category.name,
                        type: category.type || "EXPENSE", // Ensure type is set
                        icon: category.icon || "tag",
                        color: category.color || "#2196F3",
                        is_system_default: category.isSystemDefault ? 1 : 0,
                        display_order: category.displayOrder || 0,
                        is_hidden: category.isHidden ? 1 : 0,
                      });

                      // ✅ UPDATE STATE: Add to currentSQLiteCategories to prevent duplicate syncs
                      currentSQLiteCategories.push({
                        id: category.id,
                        name: category.name,
                        type: category.type || "EXPENSE",
                        icon: category.icon || "tag",
                        color: category.color || "#2196F3",
                      } as any);

                      console.log(
                        `✅ Saved category to SQLite: ${category.name} (type: ${category.type})`
                      );
                    }
                  } catch (catError: any) {
                    // Suppress duplicate error logs for UNIQUE constraint errors
                    const errorMessage = catError?.message || String(catError);
                    if (!errorMessage.includes("UNIQUE constraint")) {
                      console.warn(
                        `Failed to save category ${category.id} to SQLite:`,
                        catError
                      );
                    }
                  }
                }

                // 🔄 BƯỚC 4: RELOAD FROM SQLITE AFTER SYNC
                const updatedCategories = await CategoryRepository.listByUser(
                  user.uid
                );

                // CHỈ UPDATE UI NẾU CÓ THAY ĐỔI
                setCategories((prevCategories) => {
                  if (
                    JSON.stringify(updatedCategories) !==
                    JSON.stringify(prevCategories)
                  ) {
                    console.log(
                      `🔄 Updated ${updatedCategories.length} categories from Firebase sync`
                    );
                    return updatedCategories;
                  } else {
                    console.log("✓ No category changes from Firebase");
                    return prevCategories;
                  }
                });

                // Trigger full sync to ensure everything is synchronized
                SyncEngine.scheduleSync(user.uid, 1000);
                console.log("✅ Categories synced to SQLite");
              } catch (error) {
                console.warn("Background sync failed:", error);
              }
            } else {
              // If Firebase has no categories, still update UI with SQLite data
              const sqliteCategories = await CategoryRepository.listByUser(
                user.uid
              );
              setCategories(sqliteCategories);
            }
          },
          (error) => {
            console.error("Firebase categories listener error:", error);
            // On error, keep using SQLite data
            CategoryRepository.listByUser(user.uid)
              .then((sqliteCategories) => {
                setCategories(sqliteCategories);
              })
              .catch((err) => {
                console.error("Failed to reload from SQLite:", err);
              });
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error("Error loading categories:", error);
        // Try to load from SQLite as fallback
        try {
          const fallbackCategories = await CategoryRepository.listByUser(
            user.uid
          );
          setCategories(fallbackCategories);
        } catch (fallbackError) {
          console.error(
            "Failed to load categories from SQLite:",
            fallbackError
          );
        }
      }
    };

    loadCategories();
  }, []);

  // ✅ SETUP REALTIME SYNC FOR TRANSACTIONS (for cross-screen updates)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen to user's transactions for real-time updates
    const transactionsQuery = query(
      collection(db, `users/${user.uid}/transactions`),
      where("isDeleted", "==", false)
    );

    const unsubscribeTransactions = onSnapshot(
      transactionsQuery,
      async (snapshot) => {
        // When transactions are updated in Firebase, sync to SQLite
        const changes = snapshot.docChanges();
        if (changes.length > 0) {
          console.log(
            "🔄 Transaction updates detected in Firebase:",
            changes.length
          );
          try {
            // Trigger sync to update SQLite
            await SyncEngine.performSync(user.uid, true);
            console.log("✅ SQLite synced with Firebase updates");
          } catch (error) {
            console.warn("Failed to sync transaction updates:", error);
          }
        }
      },
      (error) => {
        console.warn("Transaction listener error:", error);
      }
    );

    return () => unsubscribeTransactions();
  }, []);

  // ✅ PERMISSION CHECK
  if (permission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chuẩn bị camera...</Text>
      </View>
    );
  }

  if (!permission || permission.status !== PermissionStatus.GRANTED) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="camera-off" size={80} color="#f44336" />
        <Text style={styles.errorTitle}>Cần quyền Camera</Text>
        <Text style={styles.errorText}>
          Để quét hóa đơn, hãy cấp quyền truy cập camera
        </Text>
        <TouchableOpacity
          style={styles.grantButton}
          onPress={requestPermission}
        >
          <Text style={styles.grantButtonText}>CẤP QUYỀN CAMERA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ OCR FUNCTION (CẢI TIẾN)
  const performOCR = async (imageUri: string): Promise<string> => {
    try {
      console.log("Đang xử lý OCR cho:", imageUri);

      const response = await fetch(imageUri);
      const blob = await response.blob();

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log("Đã convert ảnh thành Base64");

      const OCR_API_KEY = "K85684861288957";

      const formData = new FormData();
      formData.append("base64Image", base64);
      formData.append("isOverlayRequired", "false");
      formData.append("detectOrientation", "true");
      formData.append("scale", "true");
      formData.append("OCREngine", "2"); // Tốt hơn cho tiếng Việt

      const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        headers: { apikey: OCR_API_KEY },
        body: formData,
      });

      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        console.error("OCR.space Error:", errorText);
        throw new Error(`OCR API error: ${ocrResponse.status}`);
      }

      const ocrData = await ocrResponse.json();

      if (ocrData.IsErroredOnProcessing) {
        console.error("OCR Processing Error:", ocrData.ErrorMessage);
        return "";
      }

      const detectedText = ocrData.ParsedResults?.[0]?.ParsedText || "";
      console.log("OCR Text:", detectedText);
      return detectedText;
    } catch (error: any) {
      console.error("OCR Error:", error);
      return "";
    }
  };

  // ✅ HÀM MỚI: Dọn dẹp text OCR bị "rác"
  const cleanReceipt = (rawText: string): string => {
    const lines = rawText.split("\n");

    // Tìm dòng bắt đầu của hóa đơn
    const startKeywords = ["siêu thị", "hóa đơn", "cửa hàng", "mart", "coop"];
    let startIndex = lines.findIndex(
      (line) =>
        line.length < 50 && // Tránh các dòng log dài
        startKeywords.some((k) => line.toLowerCase().includes(k))
    );
    // Nếu không tìm thấy, thử tìm dòng có 3+ chữ IN HOA
    if (startIndex === -1) {
      startIndex = lines.findIndex((line) =>
        /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]{3,50}$/.test(
          line.trim()
        )
      );
    }
    if (startIndex === -1) startIndex = 0; // Fallback

    // Tìm dòng kết thúc của hóa đơn
    const endKeywords = ["cảm ơn", "thank you", "hẹn gặp lại", "quý khách"];
    let endIndex = -1;
    for (let i = lines.length - 1; i >= startIndex; i--) {
      if (endKeywords.some((k) => lines[i].toLowerCase().includes(k))) {
        endIndex = i;
        break;
      }
    }
    if (endIndex === -1) endIndex = lines.length - 1; // Fallback

    // Cắt và trả về text đã làm sạch
    return lines.slice(startIndex, endIndex + 1).join("\n");
  };

  // ✅ SỬA LỖI: Hàm helper để parse số (cải tiến)
  const parseAmount = (amount: string): number => {
    if (!amount) return 0;

    // Xóa chữ "đ", "d", khoảng trắng
    let cleaned = amount.replace(/[đd\s]/gi, "").trim();

    // Xử lý format Việt Nam: 1.000.000 hoặc 1,000,000
    // Nếu có nhiều dấu chấm hoặc phẩy, coi đó là dấu phân cách hàng nghìn
    const dotCount = (cleaned.match(/\./g) || []).length;
    const commaCount = (cleaned.match(/,/g) || []).length;

    if (dotCount > 1) {
      // Format: 1.000.000 - xóa tất cả dấu chấm
      cleaned = cleaned.replace(/\./g, "");
    } else if (commaCount > 1) {
      // Format: 1,000,000 - xóa tất cả dấu phẩy
      cleaned = cleaned.replace(/,/g, "");
    } else if (dotCount === 1 && commaCount === 0) {
      // Có thể là 1000.50 (thập phân) hoặc 1.000 (nghìn)
      // Nếu sau dấu chấm có 3 số thì là phân cách nghìn, ngược lại là thập phân
      const parts = cleaned.split(".");
      if (parts[1] && parts[1].length === 3) {
        cleaned = cleaned.replace(".", "");
      } else {
        cleaned = cleaned.replace(".", ".");
      }
    } else if (commaCount === 1 && dotCount === 0) {
      // Có thể là 1000,50 (thập phân) hoặc 1,000 (nghìn)
      const parts = cleaned.split(",");
      if (parts[1] && parts[1].length === 3) {
        cleaned = cleaned.replace(",", "");
      } else {
        cleaned = cleaned.replace(",", ".");
      }
    } else if (dotCount === 1 && commaCount === 1) {
      // Format: 1.000,50 (Châu Âu) - xóa dấu chấm, đổi phẩy thành chấm
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // ✅ EXTRACT FUNCTIONS (CẢI TIẾN)
  const extractStore = (text: string): string => {
    const storePatterns = [
      /(?:cửa hàng|shop|store|siêu thị|mart|coop|mini|co\.?op)[:\s]*([^\n]{3,30})/i,
      /^([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]{3,30})/m,
    ];

    for (const pattern of storePatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    const firstLine = text.split("\n")[0];
    if (
      firstLine &&
      firstLine.length > 3 &&
      /[A-ZÀÁẠẢÃÂẦẤẬẨẪ]/.test(firstLine)
    ) {
      return firstLine.trim();
    }

    return "SIÊU THỊ";
  };

  const extractAddress = (text: string): string => {
    const match = text.match(/(?:địa chỉ|address|đc)[:\s]*([^\n]{10,80})/i);
    return match ? match[1].trim() : "TP.HCM";
  };

  const extractPhone = (text: string): string => {
    const match = text.match(
      /(?:tel|phone|điện thoại|đt|sđt)[:\s]*([\d\s\-\.]{8,15})/i
    );
    return match ? match[1].replace(/\s/g, "") : "Không có";
  };

  const extractDate = (text: string): string => {
    const patterns = [
      /(?:ngày|date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
      /(\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1];
    }
    return new Date().toLocaleDateString("vi-VN");
  };

  const extractTime = (text: string): string => {
    const match = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    return match
      ? match[1]
      : new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  const extractTotal = (text: string): number => {
    const lines = text.split("\n");
    const keywords = ["thành tiền", "thanh toán", "payment"];
    const priceRegex = /^([\d,.]+(đ|d)?)$/;

    // 1. Thử regex cùng dòng
    const regex = /(?:thành tiền|thanh toán|payment)[:\s]*([0-9,.đ]+)/i;
    const match = text.match(regex);
    if (match) {
      const num = parseAmount(match[1]);
      if (num > 0) return num;
    }

    // 2. Thử logic khác dòng (cột)
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (keywords.some((k) => lineLower.includes(k))) {
        // Kiểm tra 3 dòng tiếp theo
        for (let j = 1; j <= 3 && i + j < lines.length; j++) {
          if (priceRegex.test(lines[i + j])) {
            const num = parseAmount(lines[i + j]);
            if (num > 0) return num;
          }
        }
      }
    }

    // 3. Fallback: Lấy "TỔNG"
    const subtotalKeywords = ["tổng", "total", "sum", "cộng"];
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (subtotalKeywords.some((k) => lineLower.includes(k))) {
        for (let j = 1; j <= 3 && i + j < lines.length; j++) {
          if (priceRegex.test(lines[i + j])) {
            const num = parseAmount(lines[i + j]);
            if (num > 0) return num;
          }
        }
      }
    }
    return 0;
  };

  // ✅ HÀM CẬP NHẬT: Xử lý giá trị dạng cột
  const extractTax = (text: string): number => {
    const lines = text.split("\n");
    const keywords = ["vat", "thuế", "tax"];
    const priceRegex = /^([\d,.]+(đ|d)?)$/;

    // 1. Thử regex cùng dòng
    const regex = /(?:vat|thuế|tax)\s*\(?\d*%?\)?[:\s]*([0-9,.đ]+)/i;
    const match = text.match(regex);
    if (match) {
      const num = parseAmount(match[1]);
      return num; // Trả về 0 nếu tax = 0
    }

    // 2. Thử logic khác dòng (cột)
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (keywords.some((k) => lineLower.includes(k))) {
        // Kiểm tra 3 dòng tiếp theo
        for (let j = 1; j <= 3 && i + j < lines.length; j++) {
          if (priceRegex.test(lines[i + j])) {
            const num = parseAmount(lines[i + j]);
            return num;
          }
        }
      }
    }
    return 0;
  };

  // ✅ HÀM XỬ LÝ ITEM (Giữ nguyên từ lần trước)
  const extractItemsAdvanced = (text: string): ExpenseItem[] => {
    const items: ExpenseItem[] = [];
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const summaryKeywords = [
      "tổng",
      "vat",
      "thuế",
      "thành tiền",
      "thanh toán",
      "cộng",
      "total",
      "sum",
      "payment",
    ];
    const priceRegex = /^([\d,.]+)$/; // Chỉ khớp với dòng CHỈ chứa số, dấu phẩy, dấu chấm
    const nameRegex =
      /^[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s\-\/]{3,50}$/i; // Chấp nhận chữ, khoảng trắng, - và /

    const itemNames: string[] = [];
    const itemPrices: number[] = [];

    // 1. Thu thập tên
    for (const line of lines) {
      if (summaryKeywords.some((k) => line.toLowerCase().startsWith(k))) {
        break;
      }
      if (nameRegex.test(line) && !line.toLowerCase().includes("hóa đơn")) {
        itemNames.push(line);
      }
    }

    // 2. Thu thập giá
    for (const line of lines) {
      if (priceRegex.test(line)) {
        const amount = parseAmount(line);
        if (amount >= 1000) {
          // Lọc ra các số nhỏ (như số lượng)
          itemPrices.push(amount);
        }
      }
    }

    // 3. Ghép cặp
    const count = Math.min(itemNames.length, itemPrices.length);
    for (let i = 0; i < count; i++) {
      items.push({
        name: itemNames[i],
        quantity: 1,
        amount: itemPrices[i],
      });
    }
    return items;
  };

  // ✅ SỬA LỖI: Hàm extractDiscount cũng dùng parseAmount đã sửa
  const extractDiscount = (text: string): number => {
    const match = text.match(/(?:giảm giá|discount|km)[:\s]*([0-9,.đ]+)/i);
    if (match) {
      return parseAmount(match[1]);
    }
    return 0;
  };

  // ✅ HÀM PARSE CHÍNH (Cập nhật để dùng hàm clean)
  const parseReceipt = (text: string): ExpenseData => {
    const originalRawText = text;
    // BƯỚC 1: LÀM SẠCH TEXT TRƯỚC
    const cleanedText = cleanReceipt(text);

    // BƯỚC 2: Chạy các hàm extract trên text SẠCH
    const items = extractItemsAdvanced(cleanedText);
    const total = extractTotal(cleanedText); // Hàm đã cập nhật
    const tax = extractTax(cleanedText); // Hàm đã cập nhật
    const discount = extractDiscount(cleanedText);

    let calculatedTotal = 0;
    if (items.length > 0) {
      calculatedTotal = items.reduce((s, i) => s + i.amount, 0);
    }

    // Logic quyết định total:
    // 1. Ưu tiên "Thành tiền" (biến total)
    // 2. Nếu không có, thử tính tổng item + thuế
    // 3. Nếu vẫn không có, lấy tổng item
    // 4. Nếu "Thành Tiền" (total) nhỏ hơn "Tổng" (calculatedTotal), thì "Thành Tiền" là đúng

    let finalTotal = total;

    if (finalTotal === 0) {
      // Nếu không tìm thấy "Thành tiền"
      if (calculatedTotal > 0 && tax > 0 && calculatedTotal > tax) {
        finalTotal = calculatedTotal + tax - discount; // Tổng = tổng item + thuế - giảm giá
      } else {
        finalTotal = calculatedTotal - discount; // Tổng = tổng item - giảm giá
      }
    }
    // Xử lý trường hợp `extractTotal` lấy nhầm "TỔNG" (129,000) thay vì "THÀNH TIỀN" (140,700)
    // Nếu `total` (129k) + `tax` (11.7k) gần bằng `calculatedTotal` (lúc này sai)
    // Logic này hơi phức tạp, tạm thời ưu tiên `extractTotal`

    return {
      store: extractStore(cleanedText),
      address: extractAddress(cleanedText),
      phone: extractPhone(cleanedText),
      date: extractDate(cleanedText),
      time: extractTime(cleanedText),
      total: finalTotal > 0 ? finalTotal : calculatedTotal - discount,
      tax,
      discount: discount,
      items:
        items.length > 0
          ? items
          : [{ name: "Mua sắm", quantity: 1, amount: finalTotal || 0 }],
      method: "Tiền mặt",
      createdAt: new Date().toISOString(),
      rawText: originalRawText, // Luôn lưu text gốc
    };
  };

  // ✅ TAKE PHOTO
  const takePhoto = async () => {
    setLoading(true);
    try {
      if (!cameraRef.current) throw new Error("Camera chưa sẵn sàng.");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: false,
      });
      if (!photo?.uri) throw new Error("Không thể lưu ảnh.");

      setPhoto(photo.uri);

      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const ocrText = await performOCR(compressed.uri);
      const data = parseReceipt(ocrText);

      setExpensesData(data);
      setStep("result");
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể xử lý ảnh.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPLOAD IMAGE
  const uploadImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const imageUri = result.assets[0].uri;
      setPhoto(imageUri);
      setLoading(true);

      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const ocrText = await performOCR(compressed.uri);
      const data = parseReceipt(ocrText);

      setExpensesData(data);
      setStep("result");
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể xử lý ảnh.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Helper: Parse date string from OCR to ISO format
  const parseDateToISO = (dateStr: string): string => {
    try {
      // Try parsing formats: DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, YYYY-MM-DD
      const formats = [
        /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/, // DD/MM/YYYY or DD-MM-YYYY
        /(\d{2,4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY/MM/DD or YYYY-MM-DD
      ];

      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          let day: number, month: number, year: number;

          // Check if first part is year (4 digits) or day (1-2 digits)
          if (match[1].length >= 4) {
            // Format: YYYY/MM/DD
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10);
            day = parseInt(match[3], 10);
          } else {
            // Format: DD/MM/YYYY
            day = parseInt(match[1], 10);
            month = parseInt(match[2], 10);
            year = parseInt(match[3], 10);
            // Handle 2-digit years
            if (year < 100) {
              year = year < 50 ? 2000 + year : 1900 + year;
            }
          }

          // Validate date
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            return date.toISOString();
          }
        }
      }
    } catch (error) {
      console.warn("Error parsing date:", error);
    }

    // Fallback to current date
    return new Date().toISOString();
  };

  // ✅ ENHANCED SAVE FUNCTION WITH REAL-TIME SYNC AND CATEGORY SELECTION
  const saveExpenseToFirebase = async (data: ExpenseData) => {
    try {
      const user = auth.currentUser;
      if (!user || !user.uid) {
        throw new Error("Bạn chưa đăng nhập hoặc user ID không hợp lệ");
      }

      const userId = user.uid; // Ensure userId is set

      // Use selected category or find default
      let categoryId: string | null = selectedCategoryId;

      if (!categoryId) {
        // Find a suitable default category for receipts
        const shoppingCategory = categories.find(
          (cat) =>
            cat.type === "EXPENSE" &&
            (cat.name.toLowerCase().includes("mua sắm") ||
              cat.name.toLowerCase().includes("shopping"))
        );
        const otherExpenseCategory = categories.find(
          (cat) =>
            cat.type === "EXPENSE" &&
            (cat.name.toLowerCase().includes("chi tiêu khác") ||
              cat.name.toLowerCase().includes("other"))
        );
        const defaultExpenseCategory = categories.find(
          (cat) => cat.type === "EXPENSE"
        );

        categoryId =
          shoppingCategory?.id ||
          otherExpenseCategory?.id ||
          defaultExpenseCategory?.id ||
          null;
      }

      // Parse date from OCR result or use current date
      const transactionDate = data.date
        ? parseDateToISO(data.date)
        : new Date().toISOString();

      // Generate UUID for transaction
      const transactionId = `txn_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const now = new Date().toISOString();

      // Create description with items summary
      const itemsSummary =
        data.items.length > 0
          ? data.items
              .map((item) => `${item.name} (x${item.quantity})`)
              .join(", ")
          : `Hóa đơn từ ${data.store}`;

      // Create Transaction object matching domain types - ENSURE userId is set
      const transaction: Transaction = {
        id: transactionId,
        userId: userId, // Explicitly set userId
        categoryId: categoryId,
        amount: data.total,
        type: "EXPENSE" as TransactionType,
        date: transactionDate,
        description: itemsSummary,
        merchantName: data.store,
        merchantLocation: data.address,
        paymentMethod: data.method,
        createdAt: now,
        isSynced: false,
        lastModifiedAt: now,
        isDeleted: false,
      };

      // Validate transaction before saving
      if (!transaction.userId) {
        throw new Error("Transaction userId is missing");
      }

      // Step 1: Save to SQLite first (offline-first approach)
      await TransactionService.create(transaction);
      console.log("✅ Transaction saved to SQLite:", transactionId);

      // Step 2: Trigger immediate sync to Firebase
      try {
        await SyncEngine.performSync(userId, true);
        console.log("✅ Transaction synced to Firebase:", transactionId);
      } catch (syncError) {
        console.warn(
          "⚠️ Background sync failed, but transaction saved locally:",
          syncError
        );
        // Transaction is still saved locally and will sync later
      }

      // Step 3: Setup real-time listener for this transaction to confirm sync
      const transactionDocRef = doc(
        db,
        `users/${userId}/transactions/${transactionId}`
      );
      const unsubscribe = onSnapshot(
        transactionDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            console.log("✅ Transaction confirmed in Firebase:", transactionId);
            // Update local SQLite to mark as synced
            TransactionService.update(transactionId, { isSynced: true }, userId)
              .then(() => {
                console.log("✅ Local transaction marked as synced");
                unsubscribe(); // Stop listening once confirmed
              })
              .catch((err) => {
                console.warn("Failed to update sync status:", err);
              });
          }
        },
        (error) => {
          console.warn("Real-time listener error:", error);
        }
      );

      return true;
    } catch (error: any) {
      console.error("❌ Lỗi lưu giao dịch:", error);
      throw error;
    }
  };

  // ✅ RETRY & DELETE
  const handleRetry = () => {
    setPhoto(null);
    setExpensesData(null);
    setEditMode(false);
    setStep("camera");
  };

  // ✅ ENHANCED EDIT FUNCTIONS
  const deleteItem = (index: number) => {
    if (!expensesData) return;
    const newItems = expensesData.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((s, i) => s + i.amount * i.quantity, 0);
    setExpensesData({ ...expensesData, items: newItems, total: newTotal });
  };

  const addItem = () => {
    if (!expensesData || !newItem.name.trim() || newItem.amount <= 0) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin");
      return;
    }
    const newItems = [...expensesData.items, { ...newItem }];
    const newTotal = newItems.reduce((s, i) => s + i.amount * i.quantity, 0);
    setExpensesData({ ...expensesData, items: newItems, total: newTotal });
    setNewItem({ name: "", quantity: 1, amount: 0 });
    setShowAddItemModal(false);
  };

  const updateItem = (index: number, updatedItem: ExpenseItem) => {
    if (!expensesData) return;
    const newItems = [...expensesData.items];
    newItems[index] = updatedItem;
    const newTotal = newItems.reduce((s, i) => s + i.amount * i.quantity, 0);
    setExpensesData({ ...expensesData, items: newItems, total: newTotal });
    setEditingItemIndex(null);
  };

  const editItem = (index: number) => {
    if (!expensesData) return;
    setEditingItemIndex(index);
    setNewItem(expensesData.items[index]);
    setShowAddItemModal(true);
  };

  // ✅ ENHANCED SAVE HANDLER WITH REAL-TIME SYNC AND NOTIFICATION
  const handleSaveExpense = async () => {
    if (!expensesData) return;

    const user = auth.currentUser;
    if (!user || !user.uid) {
      Alert.alert("Lỗi", "Bạn chưa đăng nhập");
      return;
    }

    // Load categories from SQLite if not loaded or empty
    let availableCategories = categories;
    if (categories.length === 0) {
      try {
        console.log("📥 Loading categories from SQLite or Firebase...");
        availableCategories = await loadCategoriesFromSQLiteOrFirebase(
          user.uid
        );
        setCategories(availableCategories);
        console.log(`✅ Loaded ${availableCategories.length} categories`);
      } catch (error) {
        console.error("Failed to load categories:", error);
        Alert.alert("Lỗi", "Không thể tải danh mục. Vui lòng thử lại.");
        return;
      }
    }

    // Check if category is selected
    if (!selectedCategoryId) {
      // Ensure we have the latest categories (SQLite or Firebase fallback)
      const latestCategories =
        availableCategories.length > 0
          ? availableCategories
          : await loadCategoriesFromSQLiteOrFirebase(user.uid).catch(() => []);

      if (latestCategories.length === 0) {
        Alert.alert(
          "Thông báo",
          "Bạn chưa có danh mục nào. Vui lòng tạo danh mục trước khi lưu giao dịch.",
          [{ text: "OK" }]
        );
        return;
      }

      // Update categories state before showing modal
      if (
        latestCategories.length > 0 &&
        JSON.stringify(latestCategories) !== JSON.stringify(categories)
      ) {
        setCategories(latestCategories);
      }

      // Show category selection modal immediately
      setShowCategoryModal(true);
      return;
    }

    setLoading(true);
    try {
      await saveExpenseToFirebase(expensesData);

      // Success notification
      Alert.alert(
        "Thành công",
        "Đã lưu vào ví và đồng bộ lên Firebase!\n\nDữ liệu sẽ tự động cập nhật trên tất cả các màn hình.",
        [
          {
            text: "OK",
            onPress: () => {
              // Reset state
              setPhoto(null);
              setExpensesData(null);
              setEditMode(false);
              setSelectedCategoryId(null);
              // Navigate back to home screen to see updated data
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Lỗi",
        error.message || "Không thể lưu dữ liệu. Vui lòng thử lại.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ CAMERA VIEW (Overlay tách riêng)
  if (step === "camera") {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.fullCamera} facing="back" />

        {/* Overlay riêng biệt */}
        <View style={styles.fullScanOverlay} pointerEvents="none">
          <View style={styles.largeScanFrame} />
          <Text style={styles.largeOverlayText}>
            Đặt hóa đơn vào khung hình
          </Text>
          <View style={styles.arrowContainer}>
            <Text style={styles.arrowText}>↓</Text>
            <Text style={styles.arrowText}>↓</Text>
          </View>
        </View>

        <View style={styles.fullButtonSection}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={24} color="#212121" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Quét hóa đơn</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.largeStartButton,
                loading && styles.startButtonDisabled,
              ]}
              onPress={takePhoto}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.largeButtonText}>ĐANG XỬ LÝ...</Text>
                </>
              ) : (
                <>
                  <Icon name="camera" size={28} color="#fff" />
                  <Text style={styles.largeButtonText}>CHỤP NGAY</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={uploadImage}
              disabled={loading}
            >
              <Icon name="image" size={28} color="#fff" />
              <Text style={styles.largeButtonText}>TẢI ẢNH LÊN</Text>
            </TouchableOpacity>

            <View style={styles.tipContainer}>
              <Icon name="information" size={16} color="#666" />
              <Text style={styles.tipText}>
                Đảm bảo hóa đơn rõ ràng và đủ sáng
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ✅ RESULT VIEW
  if (step === "result" && expensesData) {
    return (
      <View style={styles.container}>
        {photo && <Image source={{ uri: photo }} style={styles.resultImage} />}

        <ScrollView style={styles.resultSection}>
          {/* Store Information - Editable */}
          <View style={styles.storeCard}>
            <View style={styles.storeRow}>
              <Icon name="store" size={20} color="#1976D2" />
              {editMode ? (
                <TextInput
                  style={styles.editableText}
                  value={expensesData.store}
                  onChangeText={(text) =>
                    setExpensesData({ ...expensesData, store: text })
                  }
                  placeholder="Tên cửa hàng"
                />
              ) : (
                <Text style={styles.storeName}>{expensesData.store}</Text>
              )}
            </View>
            <View style={styles.storeRow}>
              <Icon name="map-marker" size={16} color="#666" />
              {editMode ? (
                <TextInput
                  style={styles.editableText}
                  value={expensesData.address}
                  onChangeText={(text) =>
                    setExpensesData({ ...expensesData, address: text })
                  }
                  placeholder="Địa chỉ"
                />
              ) : (
                <Text style={styles.storeAddress}>{expensesData.address}</Text>
              )}
            </View>
          </View>

          {/* Expense Information - Editable */}
          <View style={styles.expenseCard}>
            {editMode ? (
              <>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>Ngày:</Text>
                  <TextInput
                    style={styles.editableText}
                    value={expensesData.date}
                    onChangeText={(text) =>
                      setExpensesData({ ...expensesData, date: text })
                    }
                    placeholder="DD/MM/YYYY"
                  />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>Giờ:</Text>
                  <TextInput
                    style={styles.editableText}
                    value={expensesData.time}
                    onChangeText={(text) =>
                      setExpensesData({ ...expensesData, time: text })
                    }
                    placeholder="HH:MM"
                  />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>Tổng tiền:</Text>
                  <TextInput
                    style={styles.editableText}
                    value={expensesData.total.toString()}
                    onChangeText={(text) => {
                      const num = parseFloat(text) || 0;
                      setExpensesData({ ...expensesData, total: num });
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>
                  {expensesData.date} - {expensesData.time}
                </Text>
                <Text style={styles.cardTotal}>
                  {expensesData.total.toLocaleString()} VNĐ
                </Text>
                {expensesData.tax > 0 && (
                  <Text style={styles.cardSubtext}>
                    (Bao gồm VAT: {expensesData.tax.toLocaleString()}đ)
                  </Text>
                )}
              </>
            )}
          </View>

          {/* Category Selection */}
          <View style={styles.categoryCard}>
            <Text style={styles.categoryLabel}>Danh mục:</Text>
            <TouchableOpacity
              style={styles.categoryButton}
              onPress={async () => {
                // Load categories before showing modal (SQLite or Firebase fallback)
                const user = auth.currentUser;
                if (user && user.uid) {
                  try {
                    console.log(
                      "🔘 Category button pressed, loading categories..."
                    );

                    // Ensure categories are initialized first
                    try {
                      const { ensureCategoriesInitialized } = await import(
                        "./database/databaseService"
                      );
                      await ensureCategoriesInitialized(user.uid);
                    } catch (initError) {
                      console.warn(
                        "Failed to ensure categories initialized:",
                        initError
                      );
                    }

                    const latestCategories =
                      await loadCategoriesFromSQLiteOrFirebase(user.uid);
                    console.log(
                      `📋 Loaded ${latestCategories.length} categories`
                    );
                    console.log(
                      "📋 Categories:",
                      latestCategories.map((c) => ({
                        name: c.name,
                        type: c.type,
                      }))
                    );
                    setCategories(latestCategories);
                    setShowCategoryModal(true);
                  } catch (error) {
                    console.error("Failed to load categories:", error);
                    setShowCategoryModal(true); // Still show modal even if load fails
                  }
                } else {
                  setShowCategoryModal(true);
                }
              }}
            >
              <Text style={styles.categoryButtonText}>
                {selectedCategoryId
                  ? categories.find((c) => c.id === selectedCategoryId)?.name ||
                    "Chọn danh mục"
                  : "Chọn danh mục"}
              </Text>
              <Icon name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Items List */}
          {expensesData.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>• {item.name}</Text>
                <Text style={styles.itemQty}>(x{item.quantity})</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemPrice}>
                  {(item.amount * item.quantity).toLocaleString()} VNĐ
                </Text>
                {editMode && (
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={styles.editItemBtn}
                      onPress={() => editItem(index)}
                    >
                      <Icon name="pencil" size={16} color="#2196F3" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteItem(index)}
                    >
                      <Icon
                        name="trash-can-outline"
                        size={16}
                        color="#f44336"
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* Add Item Button in Edit Mode */}
          {editMode && (
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => {
                setEditingItemIndex(null);
                setNewItem({ name: "", quantity: 1, amount: 0 });
                setShowAddItemModal(true);
              }}
            >
              <Icon name="plus-circle" size={20} color="#4CAF50" />
              <Text style={styles.addItemText}>Thêm mục</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.actionButtons}>
          {!editMode ? (
            <>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditMode(true)}
              >
                <Text style={styles.editButtonText}>CHỈNH SỬA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveExpense}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveButtonText}>ĐANG LƯU...</Text>
                  </>
                ) : (
                  <Text style={styles.saveButtonText}>LƯU VÀO VÍ</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={() => {
                  setEditMode(false);
                  // Reset to original data if needed
                }}
              >
                <Text style={styles.cancelEditButtonText}>HỦY</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  loading && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveExpense}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveButtonText}>ĐANG LƯU...</Text>
                  </>
                ) : (
                  <Text style={styles.saveButtonText}>LƯU VÀO VÍ</Text>
                )}
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            disabled={loading}
          >
            <Text style={styles.retryButtonText}>CHỤP LẠI</Text>
          </TouchableOpacity>
        </View>

        {/* Category Selection Modal */}
        <Modal
          visible={showCategoryModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCategoryModal(false)}
          onShow={async () => {
            // Load latest categories from SQLite or Firebase when modal opens
            const user = auth.currentUser;
            if (user && user.uid) {
              try {
                // Ensure categories are initialized first
                try {
                  const { ensureCategoriesInitialized } = await import(
                    "./database/databaseService"
                  );
                  await ensureCategoriesInitialized(user.uid);
                } catch (initError) {
                  console.warn(
                    "Failed to ensure categories initialized:",
                    initError
                  );
                }

                const latestCategories =
                  await loadCategoriesFromSQLiteOrFirebase(user.uid);
                console.log(
                  `🔄 Modal opened: Loaded ${latestCategories.length} categories`
                );
                console.log(
                  "📋 Categories data:",
                  JSON.stringify(latestCategories, null, 2)
                );

                // Filter EXPENSE categories
                const expenseCategories = latestCategories.filter(
                  (cat) => cat.type === "EXPENSE"
                );
                console.log(
                  `💰 Found ${expenseCategories.length} EXPENSE categories`
                );
                console.log(
                  "💰 EXPENSE categories:",
                  expenseCategories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                  }))
                );

                if (latestCategories.length > 0) {
                  setCategories(latestCategories);
                } else {
                  // If no categories, try to reload
                  console.warn("No categories found, attempting reload...");
                }
              } catch (error) {
                console.warn("Failed to reload categories:", error);
              }
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chọn danh mục</Text>
                <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              {(() => {
                // Ensure all categories have a type before filtering
                const categoriesWithType = categories.map((cat) => ({
                  ...cat,
                  type: cat.type || "EXPENSE", // Default to EXPENSE if missing
                }));

                const expenseCategories = categoriesWithType.filter(
                  (cat) => cat.type === "EXPENSE"
                );
                console.log(
                  `🔍 Modal render: ${expenseCategories.length} EXPENSE categories to display out of ${categories.length} total`
                );
                console.log("🔍 Current categories state:", categories.length);
                console.log(
                  "🔍 Categories types:",
                  categories.map((c) => ({
                    name: c.name,
                    type: c.type || "MISSING",
                  }))
                );

                if (expenseCategories.length === 0) {
                  return (
                    <View style={styles.emptyCategoryContainer}>
                      <Icon
                        name="folder-alert-outline"
                        size={64}
                        color="#BDBDBD"
                      />
                      <Text style={styles.emptyCategoryText}>
                        Chưa có danh mục chi tiêu nào
                      </Text>
                      <Text style={styles.emptyCategorySubtext}>
                        Tổng số danh mục: {categories.length}
                        {categories.length > 0 && (
                          <>
                            {`\nDanh mục có sẵn: ${categories
                              .map((c) => c.name)
                              .join(", ")}`}
                            {`\nLoại danh mục: ${categories
                              .map((c) => c.type || "MISSING")
                              .join(", ")}`}
                          </>
                        )}
                      </Text>
                      <TouchableOpacity
                        style={styles.createCategoryButton}
                        onPress={() => {
                          setShowCategoryModal(false);
                          navigation.navigate("Nhappl");
                        }}
                      >
                        <Icon name="plus-circle" size={20} color="#2196F3" />
                        <Text style={styles.createCategoryButtonText}>
                          Tạo danh mục mới
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <FlatList
                    data={expenseCategories}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.categoryOption,
                          selectedCategoryId === item.id &&
                            styles.categoryOptionSelected,
                        ]}
                        onPress={() => {
                          console.log(
                            `✅ Selected category: ${item.name} (${item.id})`
                          );
                          setSelectedCategoryId(item.id);
                          setShowCategoryModal(false);
                        }}
                      >
                        <View
                          style={[
                            styles.categoryIcon,
                            { backgroundColor: item.color || "#2196F3" },
                          ]}
                        >
                          <Icon
                            name={item.icon || "tag"}
                            size={20}
                            color="#fff"
                          />
                        </View>
                        <Text style={styles.categoryOptionText}>
                          {item.name}
                        </Text>
                        {selectedCategoryId === item.id && (
                          <Icon name="check" size={20} color="#4CAF50" />
                        )}
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyCategoryContainer}>
                        <Text style={styles.emptyCategoryText}>
                          Không có danh mục nào
                        </Text>
                      </View>
                    }
                  />
                );
              })()}
            </View>
          </View>
        </Modal>

        {/* Add/Edit Item Modal */}
        <Modal
          visible={showAddItemModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowAddItemModal(false);
            setEditingItemIndex(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingItemIndex !== null ? "Chỉnh sửa mục" : "Thêm mục mới"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddItemModal(false);
                    setEditingItemIndex(null);
                  }}
                >
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Tên mục</Text>
                  <TextInput
                    style={styles.input}
                    value={newItem.name}
                    onChangeText={(text) =>
                      setNewItem({ ...newItem, name: text })
                    }
                    placeholder="Nhập tên mục"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Số lượng</Text>
                  <TextInput
                    style={styles.input}
                    value={newItem.quantity.toString()}
                    onChangeText={(text) =>
                      setNewItem({ ...newItem, quantity: parseInt(text) || 1 })
                    }
                    keyboardType="numeric"
                    placeholder="1"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Giá tiền (VNĐ)</Text>
                  <TextInput
                    style={styles.input}
                    value={newItem.amount.toString()}
                    onChangeText={(text) =>
                      setNewItem({ ...newItem, amount: parseFloat(text) || 0 })
                    }
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={() => {
                    if (editingItemIndex !== null) {
                      updateItem(editingItemIndex, newItem);
                    } else {
                      addItem();
                    }
                  }}
                >
                  <Text style={styles.modalSaveButtonText}>
                    {editingItemIndex !== null ? "Cập nhật" : "Thêm"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return null;
};
// ✅ STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  loadingText: { marginTop: 10, fontSize: 16, color: "#666" },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#f44336",
    marginTop: 20,
  },
  errorText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 10,
  },
  grantButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  grantButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  backButton: { paddingHorizontal: 30, paddingVertical: 15, marginTop: 10 },
  backButtonText: { color: "#2196F3", fontSize: 16 },
  fullCamera: { flex: 1 },
  fullScanOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  largeScanFrame: {
    width: "85%",
    height: "50%",
    borderWidth: 3,
    borderColor: "#00FF00",
    backgroundColor: "rgba(0,255,0,0.1)",
    borderRadius: 16,
  },
  largeOverlayText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 20,
    textAlign: "center",
  },
  arrowContainer: { marginTop: 15, alignItems: "center" },
  arrowText: { color: "#fff", fontSize: 14, marginVertical: 2 },
  fullButtonSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: { fontSize: 20, fontWeight: "600", color: "#212121" },
  buttonContainer: { paddingHorizontal: 20 },
  largeStartButton: {
    backgroundColor: "#2196F3",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  uploadButton: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  startButtonDisabled: { opacity: 0.6 },
  largeButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tipText: { color: "#666", fontSize: 12, marginLeft: 5 },
  resultImage: { flex: 0.35, width: "100%" },
  resultSection: { flex: 0.65, backgroundColor: "#fff" },
  storeCard: {
    backgroundColor: "#E8F5E8",
    padding: 15,
    borderRadius: 12,
    margin: 15,
  },
  storeRow: { flexDirection: "row", alignItems: "center", marginVertical: 3 },
  storeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E7D32",
    marginLeft: 8,
  },
  storeAddress: { fontSize: 12, color: "#666", marginLeft: 8 },
  editableText: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: "#212121",
    backgroundColor: "#fff",
    marginLeft: 8,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1976D2",
    width: 80,
  },
  expenseCard: {
    backgroundColor: "#E3F2FD",
    padding: 15,
    borderRadius: 12,
    margin: 15,
  },
  cardTitle: { fontSize: 14, color: "#1976D2", marginBottom: 5 },
  cardTotal: { fontSize: 22, fontWeight: "bold", color: "#D32F2F" },
  cardSubtext: { fontSize: 12, color: "#666", marginTop: 5 },
  itemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginHorizontal: 15,
    marginBottom: 8,
  },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 14, color: "#212121" },
  itemQty: { fontSize: 12, color: "#666" },
  itemPrice: { fontWeight: "600", color: "#1976D2", marginLeft: 10 },
  deleteBtn: { padding: 4 },
  actionButtons: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  editButton: {
    flex: 1,
    backgroundColor: "#FF9800",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 10,
    flexDirection: "row",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  editButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  retryButton: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    alignItems: "center",
  },
  retryButtonText: { color: "#2196F3", fontSize: 14, fontWeight: "500" },
  categoryCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    margin: 15,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 10,
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  categoryButtonText: {
    fontSize: 15,
    color: "#212121",
    flex: 1,
  },
  itemRight: {
    alignItems: "flex-end",
    marginLeft: 10,
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  editItemBtn: {
    padding: 4,
  },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    marginHorizontal: 15,
    marginBottom: 8,
    gap: 8,
  },
  addItemText: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelEditButton: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 10,
  },
  cancelEditButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#212121",
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  categoryOptionSelected: {
    backgroundColor: "#E3F2FD",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryOptionText: {
    flex: 1,
    fontSize: 15,
    color: "#212121",
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#212121",
    backgroundColor: "#fff",
  },
  modalSaveButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  modalSaveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyCategoryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyCategoryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#757575",
    marginTop: 16,
    textAlign: "center",
  },
  emptyCategorySubtext: {
    fontSize: 14,
    color: "#9E9E9E",
    marginTop: 8,
    textAlign: "center",
  },
  createCategoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E3F2FD",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  createCategoryButtonText: {
    color: "#2196F3",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default Quethoadon;

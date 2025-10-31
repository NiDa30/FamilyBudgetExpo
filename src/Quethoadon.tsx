import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import {
  CameraView,
  useCameraPermissions,
  PermissionStatus,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { collection, addDoc } from "firebase/firestore";
import { authInstance as auth, dbInstance as db } from "./firebaseConfig";
import * as ImageManipulator from "expo-image-manipulator";

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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  // ✅ SỬA LỖI: SAVE TO FIREBASE (thêm async/await xử lý lỗi)
  const saveExpenseToFirebase = async (data: ExpenseData) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Bạn chưa đăng nhập");

      await addDoc(collection(db, "expenses"), {
        userId: user.uid,
        ...data,
        timestamp: new Date(),
      });

      return true;
    } catch (error: any) {
      console.error("Lỗi lưu Firebase:", error);
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

  const deleteItem = (index: number) => {
    if (!expensesData) return;
    const newItems = expensesData.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((s, i) => s + i.amount, 0);
    setExpensesData({ ...expensesData, items: newItems, total: newTotal });
  };

  // ✅ SỬA LỖI: Thêm handler cho nút lưu với try-catch
  const handleSaveExpense = async () => {
    if (!expensesData) return;

    try {
      await saveExpenseToFirebase(expensesData);
      Alert.alert("Thành công", "Đã lưu vào ví!", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Lỗi",
        error.message || "Không thể lưu dữ liệu. Vui lòng thử lại.",
        [{ text: "OK" }]
      );
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
          <View style={styles.storeCard}>
            <View style={styles.storeRow}>
              <Icon name="store" size={20} color="#1976D2" />
              <Text style={styles.storeName}>{expensesData.store}</Text>
            </View>
            <View style={styles.storeRow}>
              <Icon name="map-marker" size={16} color="#666" />
              <Text style={styles.storeAddress}>{expensesData.address}</Text>
            </View>
          </View>

          <View style={styles.expenseCard}>
            <Text style={styles.cardTitle}>
              {" "}
              {expensesData.date} - {expensesData.time}
            </Text>
            <Text style={styles.cardTotal}>
              {" "}
              {expensesData.total.toLocaleString()} VNĐ
            </Text>
            {expensesData.tax > 0 && (
              <Text style={styles.cardSubtext}>
                (Bao gồm VAT: {expensesData.tax.toLocaleString()}đ)
              </Text>
            )}
          </View>

          {expensesData.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>• {item.name}</Text>
                <Text style={styles.itemQty}>(x{item.quantity})</Text>
              </View>
              <Text style={styles.itemPrice}>
                {item.amount.toLocaleString()} VNĐ
              </Text>
              {editMode && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteItem(index)}
                >
                  <Icon name="trash-can-outline" size={16} color="#f44336" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.actionButtons}>
          {!editMode ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditMode(true)}
            >
              <Text style={styles.editButtonText}>CHỈNH SỬA</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveExpense}
            >
              <Text style={styles.saveButtonText}>LƯU VÀO VÍ</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>CHỤP LẠI</Text>
          </TouchableOpacity>
        </View>
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
  },
  editButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  retryButton: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    alignItems: "center",
  },
  retryButtonText: { color: "#2196F3", fontSize: 14, fontWeight: "500" },
});

export default Quethoadon;

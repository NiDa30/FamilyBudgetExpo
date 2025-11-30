// firebaseConfig.ts - ✅ Đã fix
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// ✅ CÁCH 2: Sử dụng process.env với prefix EXPO_PUBLIC_ (Không cần import @env)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ✅ Debug: In ra để kiểm tra config (XÓA sau khi test xong)
console.log("🔥 Firebase Config:", {
  apiKey: firebaseConfig.apiKey ? "✅ Có" : "❌ Thiếu",
  authDomain: firebaseConfig.authDomain ? "✅ Có" : "❌ Thiếu",
  projectId: firebaseConfig.projectId ? "✅ Có" : "❌ Thiếu",
});

// ✅ Chỉ khởi tạo nếu chưa có app nào
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Khởi tạo Auth với AsyncStorage persistence để lưu trữ trạng thái đăng nhập
let authInstance;
try {
  // Thử khởi tạo với persistence trước
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (error: any) {
  // Nếu auth đã được khởi tạo, sử dụng getAuth
  if (error.code === "auth/already-initialized") {
    authInstance = getAuth(app);
  } else {
    // Nếu có lỗi khác, vẫn thử getAuth
    console.warn("Firebase Auth initialization warning:", error.message);
    authInstance = getAuth(app);
  }
}

const dbInstance = getFirestore(app);
const storageInstance = getStorage(app);

// Xuất ra để dùng ở các file khác
export { authInstance, dbInstance, storageInstance };
// Export với tên ngắn để tương thích với code cũ
export { authInstance as auth, dbInstance as db, storageInstance as storage };
export default app;

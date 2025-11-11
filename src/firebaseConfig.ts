// firebaseConfig.ts - ✅ Đã fix
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ✅ CÁCH 2: Sử dụng process.env với prefix EXPO_PUBLIC_ (Không cần import @env)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// ✅ Debug: In ra để kiểm tra config (XÓA sau khi test xong)
console.log("🔥 Firebase Config:", {
  apiKey: firebaseConfig.apiKey ? "✅ Có" : "❌ Thiếu",
  authDomain: firebaseConfig.authDomain ? "✅ Có" : "❌ Thiếu",
  projectId: firebaseConfig.projectId ? "✅ Có" : "❌ Thiếu",
});

// ✅ Chỉ khởi tạo nếu chưa có app nào
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Khởi tạo dịch vụ
const authInstance = getAuth(app);
const dbInstance = getFirestore(app);
const storageInstance = getStorage(app);

// Xuất ra để dùng ở các file khác
export { authInstance, dbInstance, storageInstance };
// Export với tên ngắn để tương thích với code cũ
export { authInstance as auth, dbInstance as db, storageInstance as storage };
export default app;

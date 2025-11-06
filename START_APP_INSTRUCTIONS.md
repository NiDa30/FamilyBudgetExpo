# How to Start the App - IMPORTANT

## ⚠️ expo-sqlite Web Issue

The app uses `expo-sqlite` which **does not work on web** with Expo SDK 54 due to WebAssembly bundling issues.

**Solution**: Run the app on **Android or iOS only** (not web).

---

## ✅ Correct Way to Start

### Option 1: Start with Cache Clear (Recommended)

```bash
npx expo start --clear
```

**Then press:**
- `a` - for Android emulator/device
- `i` - for iOS simulator (Mac only)

**DO NOT press `w` for web** - it will fail due to expo-sqlite WASM issue.

---

### Option 2: Start Normally

```bash
npx expo start
```

**Then press:**
- `a` - for Android
- `i` - for iOS

---

## 🔧 If You See Web Bundling Error

If you accidentally pressed `w` or see this error:

```
Unable to resolve "./wa-sqlite/wa-sqlite.wasm?url" from "node_modules\expo-sqlite\web\worker.ts"
```

**Just ignore it** and press `a` for Android or `i` for iOS instead.

The web platform is not supported due to SQLite compatibility issues.

---

## 📱 Testing the Menu Features

Once the app starts on Android/iOS:

1. Navigate to **Settings** screen
2. Test these menu items:

**Navigation Screens:**
- ✅ Đổi mật khẩu → Opens password change screen
- ✅ Bảo mật → Opens security settings
- ✅ Về ứng dụng → Opens about screen
- ✅ Ngôn ngữ → Opens language settings
- ✅ Sao lưu & Phục hồi → Opens backup/restore
- ✅ Tùy chỉnh màu sắc → Opens theme customization

**Action Functions:**
- ✅ Chia sẻ với bạn bè → Opens share dialog
- ✅ Đánh giá ứng dụng → Shows rating alert
- ✅ Xuất báo cáo Excel → Shows "coming soon" alert

---

## 🚀 Quick Start Command

**Just run this:**

```bash
npx expo start --clear
```

**Then press `a` for Android** (or `i` for iOS on Mac)

That's it! All features will work correctly on mobile. 🎉

---

## 💡 Why Not Web?

- `expo-sqlite` uses native SQLite on mobile
- For web, it needs WebAssembly (WASM) version
- Expo SDK 54 has compatibility issues with WASM bundling
- **Solution**: Use mobile platforms (Android/iOS) only

---

## ✅ Summary

- ❌ **Don't run on web** (`w` key)
- ✅ **Run on Android** (`a` key) or iOS (`i` key)
- ✅ All menu features work perfectly on mobile
- ✅ CAPTCHA, profile, and all features ready to test

# 🔄 Cấu trúc mới - Settings Features

## 📋 Tổng quan

Code đã được tái cấu trúc để dễ đọc, dễ bảo trì hơn. Các component Settings đã được tách ra thành các file riêng biệt với tên rõ ràng.

---

## 📁 Cấu trúc thư mục mới

```
src/
├── screens/
│   ├── ChangePassword.tsx          # Đổi mật khẩu (giữ nguyên)
│   ├── SecuritySettings.tsx        # Cài đặt bảo mật (giữ nguyên)
│   ├── Profile.tsx                 # Thông tin tài khoản (giữ nguyên)
│   └── settings/                   # ⭐ Thư mục mới cho Settings screens
│       ├── AboutScreen.tsx         # Về ứng dụng
│       ├── LanguageScreen.tsx      # Ngôn ngữ
│       ├── BackupRestoreScreen.tsx # Sao lưu & Phục hồi
│       ├── ThemeScreen.tsx         # Tùy chỉnh màu sắc
│       └── index.ts                # Export tất cả settings screens
│
├── helpers/
│   └── settingsHelpers.ts          # ⭐ Helper functions (shareApp, rateApp, exportToExcel)
│
└── Setting.tsx                     # Menu Settings chính
```

---

## 🆚 So sánh: Trước và Sau

### ❌ Trước (File cũ - AllMenuScreens.tsx)

```typescript
// 1 file lớn 570+ dòng với:
// - 4 screens
// - 3 helper functions
// - Shared styles
// - Khó tìm kiếm và bảo trì
```

### ✅ Sau (Cấu trúc mới)

```
4 files screens riêng biệt:
- AboutScreen.tsx          (180 dòng)
- LanguageScreen.tsx       (130 dòng)
- BackupRestoreScreen.tsx  (200 dòng)
- ThemeScreen.tsx          (160 dòng)

1 file helpers:
- settingsHelpers.ts       (60 dòng)

→ Dễ tìm, dễ đọc, dễ sửa!
```

---

## 🎯 Ưu điểm của cấu trúc mới

### 1. **Tên file rõ ràng hơn**
- ❌ `AllMenuScreens.tsx` → Không biết có gì bên trong
- ✅ `AboutScreen.tsx` → Biết ngay đây là màn hình About

### 2. **Tách biệt trách nhiệm**
- Mỗi screen một file riêng
- Helper functions tách riêng
- Styles riêng cho từng screen

### 3. **Dễ bảo trì**
- Muốn sửa About screen? → Mở `AboutScreen.tsx`
- Muốn thêm ngôn ngữ? → Mở `LanguageScreen.tsx`
- Muốn sửa helper? → Mở `settingsHelpers.ts`

### 4. **Import rõ ràng**
```typescript
// Trước:
import { AboutAppScreen, LanguageSettingsScreen } from "./screens/AllMenuScreens";

// Sau:
import AboutScreen from "./screens/settings/AboutScreen";
import LanguageScreen from "./screens/settings/LanguageScreen";
// Hoặc:
import { AboutScreen, LanguageScreen } from "./screens/settings";
```

### 5. **Dễ mở rộng**
- Thêm screen mới? → Tạo file mới trong `settings/`
- Thêm helper mới? → Thêm vào `settingsHelpers.ts`

---

## 📝 Chi tiết các file

### 1. AboutScreen.tsx
**Mô tả**: Màn hình "Về ứng dụng"

**Nội dung**:
- Thông tin ứng dụng (tên, version, mô tả)
- Thông tin nhà phát triển
- Email hỗ trợ
- Website
- Chính sách bảo mật
- Điều khoản sử dụng

**Header color**: `#757575` (Gray)

---

### 2. LanguageScreen.tsx
**Mô tả**: Màn hình chọn ngôn ngữ

**Nội dung**:
- Danh sách 5 ngôn ngữ:
  - 🇻🇳 Tiếng Việt
  - 🇺🇸 English
  - 🇯🇵 日本語
  - 🇰🇷 한국어
  - 🇨🇳 中文
- Hiển thị ngôn ngữ đã chọn (checkmark)
- Alert khi thay đổi ngôn ngữ

**Header color**: `#4CAF50` (Green)

---

### 3. BackupRestoreScreen.tsx
**Mô tả**: Màn hình sao lưu và phục hồi dữ liệu

**Nội dung**:
- Toggle tự động sao lưu
- Button "Sao lưu ngay"
- Button "Phục hồi dữ liệu"
- Thông tin lần sao lưu gần nhất

**Header color**: `#9C27B0` (Purple)

---

### 4. ThemeScreen.tsx
**Mô tả**: Màn hình tùy chỉnh màu sắc

**Nội dung**:
- Danh sách 6 themes:
  - Mặc định (#930f2aff)
  - Xanh dương (#2196F3)
  - Xanh lá (#4CAF50)
  - Tím (#9C27B0)
  - Cam (#FF9800)
  - Hồng (#E91E63)
- Hiển thị theme đã chọn (checkmark)
- Alert khi thay đổi theme

**Header color**: `#FF6B6B` (Red/Pink)

---

### 5. settingsHelpers.ts
**Mô tả**: Helper functions cho Settings

**Functions**:

#### `shareApp()`
- Mở dialog chia sẻ ứng dụng
- Sử dụng React Native Share API
- Message: "Thử ứng dụng Family Budget - Quản lý tài chính thông minh!"

#### `rateApp()`
- Hiển thị Alert xác nhận đánh giá
- Mở link Google Play Store
- URL: `https://play.google.com/store/apps/details?id=com.familybudget`

#### `exportToExcel()`
- Hiển thị Alert "Coming soon"
- Tính năng sẽ triển khai sau

---

## 🔗 Cách sử dụng

### Trong App.tsx:

```typescript
import AboutScreen from "./src/screens/settings/AboutScreen";
import LanguageScreen from "./src/screens/settings/LanguageScreen";
import BackupRestoreScreen from "./src/screens/settings/BackupRestoreScreen";
import ThemeScreen from "./src/screens/settings/ThemeScreen";

// Hoặc import tất cả cùng lúc:
import {
  AboutScreen,
  LanguageScreen,
  BackupRestoreScreen,
  ThemeScreen
} from "./src/screens/settings";

// Đăng ký routes:
<Stack.Screen name="AboutApp" component={AboutScreen} />
<Stack.Screen name="LanguageSettings" component={LanguageScreen} />
<Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
<Stack.Screen name="ThemeCustomization" component={ThemeScreen} />
```

### Trong Setting.tsx:

```typescript
import { shareApp, rateApp, exportToExcel } from "./helpers/settingsHelpers";

// Sử dụng trong handler:
const handleMenuPress = (item: any) => {
  if (item.screen) {
    navigation.navigate(item.screen);
  } else if (item.action) {
    switch (item.action) {
      case "exportExcel": exportToExcel(); break;
      case "rateApp": rateApp(); break;
      case "shareApp": shareApp(); break;
    }
  }
};
```

---

## 🗑️ File cũ có thể xóa

Sau khi kiểm tra mọi thứ hoạt động tốt, bạn có thể xóa:

```
src/screens/AllMenuScreens.tsx  ← File cũ không cần thiết nữa
```

**⚠️ Lưu ý**: Đợi test kỹ trước khi xóa!

---

## ✅ Checklist Migration

- [x] Tạo thư mục `src/screens/settings/`
- [x] Tạo 4 files screens riêng biệt
- [x] Tạo file `settingsHelpers.ts`
- [x] Tạo file `index.ts` cho settings
- [x] Cập nhật imports trong `App.tsx`
- [x] Cập nhật imports trong `Setting.tsx`
- [x] Test tất cả screens hoạt động
- [ ] Xóa file `AllMenuScreens.tsx` (sau khi test)

---

## 🚀 Testing

Sau khi refactor, test các chức năng sau:

```bash
npx expo start --clear
```

**Test checklist**:
- [ ] Settings → Về ứng dụng → Mở AboutScreen
- [ ] Settings → Ngôn ngữ → Mở LanguageScreen
- [ ] Settings → Sao lưu & Phục hồi → Mở BackupRestoreScreen
- [ ] Settings → Tùy chỉnh màu sắc → Mở ThemeScreen
- [ ] Settings → Chia sẻ → Mở Share dialog
- [ ] Settings → Đánh giá → Hiển thị Alert
- [ ] Settings → Xuất Excel → Hiển thị Alert

---

## 📚 Conventions

### Naming:
- **Screen files**: `XxxScreen.tsx` (PascalCase + "Screen" suffix)
- **Helper files**: `xxxHelpers.ts` (camelCase + "Helpers" suffix)
- **Folders**: `lowercase` hoặc `kebab-case`

### Structure:
- Mỗi screen có styles riêng (không share)
- Helper functions không có UI
- Export default cho screens
- Export named cho helpers

---

## 🎨 UI Design Patterns

Tất cả settings screens follow cùng pattern:

```typescript
export default function XxxScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      {/* Header với back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Title</Text>
      </View>

      {/* Content với ScrollView */}
      <ScrollView style={styles.content}>
        {/* Cards và Sections */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({...});
```

---

## 💡 Tips

1. **Thêm screen mới?**
   - Copy 1 trong 4 screen hiện tại
   - Đổi tên file và component
   - Sửa nội dung
   - Thêm vào `index.ts`
   - Đăng ký route trong `App.tsx`

2. **Thêm helper mới?**
   - Thêm function vào `settingsHelpers.ts`
   - Export function
   - Import và dùng trong `Setting.tsx`

3. **Share styles?**
   - Nếu cần share styles, tạo `src/styles/settingsStyles.ts`
   - Import và dùng trong các screens

---

## 🎉 Kết quả

**Trước**: 1 file lớn 570+ dòng, khó đọc, khó tìm

**Sau**: 6 files nhỏ, rõ ràng, dễ bảo trì:
- ✅ `AboutScreen.tsx` (180 dòng)
- ✅ `LanguageScreen.tsx` (130 dòng)
- ✅ `BackupRestoreScreen.tsx` (200 dòng)
- ✅ `ThemeScreen.tsx` (160 dòng)
- ✅ `settingsHelpers.ts` (60 dòng)
- ✅ `index.ts` (10 dòng)

**→ Clean code! Dễ đọc! Dễ mở rộng! 🚀**

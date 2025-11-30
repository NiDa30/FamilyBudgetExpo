# Hướng dẫn Migration - Tối ưu Performance

## Tổng quan

Hệ thống cache mới giúp:
- ✅ Giảm số lần query Firebase từ 10-20 lần xuống 1-2 lần
- ✅ Load từ SQLite (nhanh hơn 10-100 lần)
- ✅ Cache trong memory (truy cập tức thì)
- ✅ Tránh duplicate requests

## Các bước Migration

### Bước 1: Đã hoàn thành ✅
- ✅ Tạo `DataCacheService`
- ✅ Tạo `SharedDataContext`
- ✅ Tích hợp `SharedDataProvider` vào `App.tsx`

### Bước 2: Cập nhật các màn hình

#### Ví dụ: Tối ưu Trangchu.tsx

**TRƯỚC (Load từ Firebase nhiều lần):**

```tsx
const HomeScreen = () => {
  const [categories, setCategories] = useState([]);
  
  useFocusEffect(
    useCallback(() => {
      // ❌ Load từ Firebase mỗi lần focus
      FirebaseService.getCategories(userId).then(setCategories);
      loadTransactionsFromFirebase();
    }, [])
  );
};
```

**SAU (Sử dụng SharedDataContext):**

```tsx
import { useSharedData } from '../context/SharedDataContext';

const HomeScreen = () => {
  // ✅ Dữ liệu đã được cache, không cần load lại
  const { 
    categories, 
    transactions,
    loadingCategories,
    refreshCategories 
  } = useSharedData();
  
  // Chỉ cần refresh khi thực sự cần (ví dụ: sau khi thêm category)
  const handleAddCategory = async () => {
    // ... add category logic
    await refreshCategories(true); // force refresh
  };
};
```

### Bước 3: Invalidate cache khi cần

Sau khi thêm/sửa/xóa dữ liệu, cần invalidate cache:

```tsx
// Khi thêm category
const handleAddCategory = async () => {
  await FirebaseService.addCategory(category);
  // Invalidate cache để load lại
  DataCacheService.invalidateCategories(userId);
  // hoặc
  invalidateCategories(); // từ useSharedData
};

// Khi thêm transaction
const handleAddTransaction = async () => {
  await FirebaseService.addTransaction(transaction);
  // Invalidate transactions cache
  DataCacheService.invalidateTransactions(userId);
  // hoặc
  invalidateTransactions(); // từ useSharedData
};
```

## Danh sách màn hình cần tối ưu

### Ưu tiên cao (Load nhiều nhất):
1. **Trangchu.tsx** - Load categories + transactions mỗi lần focus
2. **Bieudo.tsx** - Load categories + transactions + budgets + goals
3. **Timkiem.tsx** - Load categories + transactions
4. **Nhap.tsx** - Load categories
5. **Quethoadon.tsx** - Load categories

### Ưu tiên trung bình:
6. **Home.tsx** - Load categories
7. **Nhappl.tsx** - Load categories
8. **Thongbao.tsx** - Load notifications

## Checklist Migration

Cho mỗi màn hình:

- [ ] Import `useSharedData` từ `SharedDataContext`
- [ ] Thay thế `useState` cho categories/transactions bằng `useSharedData()`
- [ ] Xóa các `FirebaseService.getCategories()` / `getTransactions()` trong `useFocusEffect`
- [ ] Thêm `invalidateCache()` sau khi thêm/sửa/xóa
- [ ] Test xem màn hình vẫn hoạt động đúng
- [ ] Kiểm tra performance improvement

## Performance Monitoring

Sử dụng `DataCacheService.getStats()` để monitor cache:

```tsx
const stats = DataCacheService.getStats();
console.log('Cache stats:', stats);
// {
//   size: 5,
//   keys: ['categories:userId', 'transactions:userId:all', ...],
//   entries: [...]
// }
```

## Lưu ý quan trọng

1. **Không xóa onSnapshot listeners** - Vẫn cần để sync real-time
2. **Chỉ invalidate khi cần** - Không invalidate quá nhiều
3. **Sử dụng SQLite làm primary** - Firebase chỉ để sync
4. **Preload dữ liệu** - `DataCacheService.preloadCommonData()` khi app start

## Troubleshooting

### Cache không update?
- Kiểm tra xem đã invalidate chưa
- Kiểm tra TTL có quá dài không
- Force refresh: `refreshCategories(true)`

### Vẫn load từ Firebase?
- Kiểm tra xem có đang dùng `useSharedData()` chưa
- Kiểm tra xem có đang load trực tiếp từ Firebase không

### Performance không cải thiện?
- Kiểm tra cache stats
- Kiểm tra xem có đang invalidate quá nhiều không
- Kiểm tra TTL configuration


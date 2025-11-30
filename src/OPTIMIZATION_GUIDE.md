# Hướng dẫn Tối ưu Đọc/Ghi - DataCacheService & SharedDataContext

## Vấn đề

Mỗi màn hình đang load dữ liệu từ Firebase nhiều lần, làm chậm app:
- Mỗi màn hình tự load categories, transactions từ Firebase
- Không có cache chung, dữ liệu bị load lại nhiều lần
- onSnapshot listeners được setup nhiều lần cho cùng collection

## Giải pháp

### 1. DataCacheService
- Cache dữ liệu trong memory với TTL (Time To Live)
- Load từ SQLite trước (nhanh hơn Firebase)
- Tránh duplicate requests (nếu đang load thì chờ kết quả)
- Invalidate cache khi cần

### 2. SharedDataContext
- Chia sẻ dữ liệu giữa các component
- Tự động refresh khi cache thay đổi
- Preload dữ liệu thường dùng

## Cách sử dụng

### Bước 1: Wrap App với SharedDataProvider

```tsx
// Trong file entry point (App.tsx hoặc index.tsx)
import { SharedDataProvider } from './context/SharedDataContext';

function App() {
  return (
    <SharedDataProvider>
      {/* Your app components */}
    </SharedDataProvider>
  );
}
```

### Bước 2: Sử dụng trong Component

#### Cách 1: Sử dụng SharedDataContext (Khuyến nghị)

```tsx
import { useSharedData } from '../context/SharedDataContext';

const MyComponent = () => {
  const { 
    categories, 
    transactions, 
    loadingCategories,
    refreshCategories,
    invalidateCategories 
  } = useSharedData();

  // Dữ liệu đã được cache và chia sẻ
  // Không cần load lại từ Firebase
  
  return (
    <View>
      {loadingCategories ? (
        <Text>Loading...</Text>
      ) : (
        categories.map(cat => <Text key={cat.id}>{cat.name}</Text>)
      )}
    </View>
  );
};
```

#### Cách 2: Sử dụng DataCacheService trực tiếp

```tsx
import DataCacheService from '../service/cache/DataCacheService';
import { useEffect, useState } from 'react';

const MyComponent = () => {
  const [categories, setCategories] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (user?.uid) {
      // Load từ cache hoặc SQLite
      DataCacheService.getCategories(user.uid)
        .then(setCategories);
    }
  }, [user?.uid]);

  return (
    <View>
      {categories.map(cat => <Text key={cat.id}>{cat.name}</Text>)}
    </View>
  );
};
```

### Bước 3: Invalidate cache khi cần

```tsx
// Khi thêm/sửa/xóa category
const handleAddCategory = async () => {
  // ... add category logic
  
  // Invalidate cache để load lại
  DataCacheService.invalidateCategories(userId);
  // hoặc
  invalidateCategories(); // từ useSharedData
};

// Khi thêm transaction
const handleAddTransaction = async () => {
  // ... add transaction logic
  
  // Invalidate transactions cache
  DataCacheService.invalidateTransactions(userId);
};
```

## Tối ưu các màn hình hiện tại

### Trước (Load từ Firebase nhiều lần):

```tsx
useFocusEffect(
  useCallback(() => {
    // Load từ Firebase mỗi lần focus
    FirebaseService.getCategories(userId).then(setCategories);
    FirebaseService.getTransactions(userId).then(setTransactions);
  }, [])
);
```

### Sau (Sử dụng cache):

```tsx
const { categories, transactions } = useSharedData();
// Dữ liệu đã có sẵn, không cần load lại
```

## Cache Configuration

TTL (Time To Live) mặc định:
- Categories: 5 phút
- Transactions: 2 phút
- Budgets: 5 phút
- Goals: 5 phút
- User: 10 phút

Có thể tùy chỉnh trong `DataCacheService.config`.

## Best Practices

1. **Luôn sử dụng SharedDataContext** cho dữ liệu chung (categories, transactions)
2. **Invalidate cache** sau khi thêm/sửa/xóa dữ liệu
3. **Không load trực tiếp từ Firebase** nếu có thể dùng cache
4. **Preload dữ liệu** khi app khởi động
5. **Sử dụng SQLite** làm primary data source, Firebase chỉ để sync

## Migration Checklist

- [ ] Wrap App với SharedDataProvider
- [ ] Thay thế FirebaseService.getCategories() → useSharedData().categories
- [ ] Thay thế FirebaseService.getTransactions() → useSharedData().transactions
- [ ] Thêm invalidate cache sau khi thêm/sửa/xóa
- [ ] Xóa các onSnapshot listeners trùng lặp
- [ ] Test performance improvement

## Performance Benefits

- ✅ Giảm số lần query Firebase từ ~10-20 lần xuống 1-2 lần
- ✅ Load từ SQLite nhanh hơn Firebase 10-100 lần
- ✅ Cache trong memory giúp truy cập tức thì
- ✅ Tránh duplicate requests
- ✅ Tự động refresh khi cache thay đổi


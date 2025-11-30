// src/examples/OptimizedComponentExample.tsx
// Ví dụ cách sử dụng SharedDataContext để tối ưu performance

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedData } from '../context/SharedDataContext';

/**
 * VÍ DỤ: Component tối ưu sử dụng SharedDataContext
 * 
 * TRƯỚC (Load từ Firebase nhiều lần):
 * - Mỗi component tự load categories từ Firebase
 * - Load lại mỗi khi focus screen
 * - Không có cache, chậm và tốn bandwidth
 * 
 * SAU (Sử dụng SharedDataContext):
 * - Dữ liệu được cache và chia sẻ
 * - Chỉ load 1 lần, các component khác dùng chung
 * - Tự động refresh khi cần
 */
const OptimizedComponentExample = () => {
  // ✅ Sử dụng SharedDataContext - dữ liệu đã được cache
  const {
    categories,
    transactions,
    loadingCategories,
    loadingTransactions,
    refreshCategories,
    invalidateCategories,
  } = useSharedData();

  // ❌ KHÔNG CẦN load từ Firebase nữa:
  // useEffect(() => {
  //   FirebaseService.getCategories(userId).then(setCategories);
  // }, []);

  return (
    <View style={styles.container}>
      {loadingCategories ? (
        <Text>Loading categories...</Text>
      ) : (
        <View>
          <Text>Categories ({categories.length}):</Text>
          {categories.map(cat => (
            <Text key={cat.id}>{cat.name}</Text>
          ))}
        </View>
      )}

      {loadingTransactions ? (
        <Text>Loading transactions...</Text>
      ) : (
        <View>
          <Text>Transactions ({transactions.length}):</Text>
        </View>
      )}

      {/* Khi thêm/sửa/xóa category, chỉ cần invalidate cache */}
      {/* invalidateCategories(); */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

export default OptimizedComponentExample;


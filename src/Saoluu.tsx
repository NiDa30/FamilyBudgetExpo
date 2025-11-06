// src/Saoluu.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ĐÃ THÊM: DÙNG MÀU THEME
import { useTheme } from './context/ThemeContext';

const Saoluu = () => {
  const navigation = useNavigation();

  // LẤY MÀU THEME
  const { themeColor } = useTheme();

  return (
    <SafeAreaView style={styles.container}>
      {/* StatusBar – DÙNG MÀU THEME */}
      <StatusBar backgroundColor={themeColor} barStyle="light-content" />

      {/* Header – DÙNG MÀU THEME */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Google Drive</Text>
      </View>

      {/* Nội dung */}
      <View style={styles.body}>
        <Text style={styles.description}>
          Google Drive là một dịch vụ lưu trữ trực tuyến miễn phí.{' '}
          <Text style={styles.bold}>
            Bạn có thể sao lưu dữ liệu vào Google Drive và chỉ lưu 1 bản dữ liệu sao lưu mới nhất.
          </Text>
          {'\n\n'}
          Bạn có thể khôi phục dữ liệu trong Google Drive bất cứ lúc nào và bất cứ nơi nào. Quá trình khôi phục sẽ xóa dữ liệu tại nơi lưu và thay thế bằng dữ liệu sao lưu.
        </Text>

        {/* Nút KẾT NỐI – DÙNG MÀU THEME */}
        <TouchableOpacity 
          style={[styles.connectButton, { backgroundColor: themeColor, shadowColor: themeColor }]}
        >
          <Text style={styles.connectButtonText}>KẾT NỐI</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    // ĐÃ XÓA backgroundColor: '#4285F4'
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  backIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  body: {
    flex: 1,
    padding: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 40,
  },
  bold: {
    fontWeight: 'bold',
    color: '#000',
  },
  connectButton: {
    // backgroundColor: themeColor (được áp dụng trong component)
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default Saoluu;
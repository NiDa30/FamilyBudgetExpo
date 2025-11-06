// src/Thongbao.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

// ĐÃ THÊM: DÙNG MÀU THEME
import { useTheme } from './context/ThemeContext';

type ThongbaoNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Thongbao'>;

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
}

const Thongbao = () => {
  const navigation = useNavigation<ThongbaoNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  // LẤY MÀU THEME
  const { themeColor } = useTheme();

  // Dữ liệu giả lập
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Giao dịch thành công',
      message: 'Bạn đã ghi nhận thu nhập +500.000đ từ "Lương tháng"',
      time: '2 phút trước',
      type: 'success',
      read: false,
    },
    {
      id: '2',
      title: 'Cảnh báo chi tiêu',
      message: 'Bạn đã chi 1.200.000đ cho "Ăn uống" – vượt 20% ngân sách',
      time: '1 giờ trước',
      type: 'warning',
      read: false,
    },
    {
      id: '3',
      title: 'Sao lưu tự động',
      message: 'Dữ liệu đã được sao lưu thành công lúc 08:00',
      time: 'Hôm nay, 08:05',
      type: 'info',
      read: true,
    },
    {
      id: '4',
      title: 'Cập nhật mới',
      message: 'Phiên bản 1.0.1 đã sẵn sàng! Cập nhật ngay để trải nghiệm tốt hơn.',
      time: 'Hôm qua, 14:30',
      type: 'info',
      read: true,
    },
    {
      id: '5',
      title: 'Lỗi đồng bộ',
      message: 'Không thể đồng bộ dữ liệu. Vui lòng kiểm tra kết nối mạng.',
      time: '2 ngày trước',
      type: 'error',
      read: true,
    },
  ]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      Alert.alert('Cập nhật', 'Đã làm mới danh sách thông báo');
    }, 1000);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif => (notif.id === id ? { ...notif, read: true } : notif))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    Alert.alert('Thành công', 'Đã đánh dấu tất cả là đã đọc');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return 'check-circle';
      case 'warning': return 'alert';
      case 'error': return 'close-circle';
      default: return 'information';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'error': return '#F44336';
      default: return themeColor; // DÙNG THEME CHO INFO
    }
  };

  return (
    <View style={styles.container}>
      {/* Header – DÙNG MÀU THEME */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <TouchableOpacity onPress={markAllAsRead} style={styles.readAllButton}>
          <Text style={styles.readAllText}>Đánh dấu tất cả</Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách thông báo */}
      <ScrollView
        style={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColor} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="bell-off" size={60} color="#BDBDBD" />
            <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
          </View>
        ) : (
          notifications.map((notif) => (
            <TouchableOpacity
              key={notif.id}
              style={[
                styles.notificationItem,
                !notif.read && [styles.unread, { borderLeftColor: themeColor }]
              ]}
              onPress={() => markAsRead(notif.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: getColor(notif.type) + '20' }]}>
                <Icon name={getIcon(notif.type)} size={24} color={getColor(notif.type)} />
              </View>
              <View style={styles.content}>
                <View style={styles.headerRow}>
                  <Text style={[styles.title, !notif.read && styles.unreadText]}>
                    {notif.title}
                  </Text>
                  <Text style={styles.time}>{notif.time}</Text>
                </View>
                <Text style={[styles.message, !notif.read && styles.unreadText]}>
                  {notif.message}
                </Text>
              </View>
              {!notif.read && <View style={[styles.unreadDot, { backgroundColor: themeColor }]} />}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    // ĐÃ XÓA backgroundColor: '#1E88E5'
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: 16,
  },
  readAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  readAllText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    position: 'relative',
  },
  unread: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    // borderLeftColor: themeColor (được áp dụng trong component)
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  unreadText: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    // backgroundColor: themeColor (được áp dụng trong component)
    position: 'absolute',
    top: 16,
    right: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    marginTop: 16,
  },
});

export default Thongbao;
// src/Thongbao.tsx - Thông báo với tích hợp ngân sách và mục tiêu
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useTheme } from './context/ThemeContext';
import BudgetNotificationService, { BudgetNotification } from './service/notifications/BudgetNotificationService';
import { auth } from './firebaseConfig';

type ThongbaoNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Thongbao'>;

type FilterType = 'all' | 'budget_warning' | 'budget_exceeded' | 'goal_progress' | 'goal_achieved' | 'goal_reminder' | 'large_expense';

const Thongbao = () => {
  const navigation = useNavigation<ThongbaoNavigationProp>();
  const { themeColor } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<BudgetNotification[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedNotification, setSelectedNotification] = useState<BudgetNotification | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      const allNotifications = await BudgetNotificationService.getNotifications(user.uid);
      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Lỗi', 'Không thể tải thông báo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      // Bắt đầu theo dõi tự động
      BudgetNotificationService.startMonitoring(60); // Kiểm tra mỗi 60 phút

      return () => {
        BudgetNotificationService.stopMonitoring();
      };
    }, [loadNotifications])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    // Kiểm tra và tạo thông báo mới
    await BudgetNotificationService.checkAndCreateNotifications();
    await loadNotifications();
  };

  const markAsRead = async (id: string) => {
    try {
      await BudgetNotificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(notif => (notif.id === id ? { ...notif, isRead: true } : notif))
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      await BudgetNotificationService.markAllAsRead(user.uid);
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
      Alert.alert('Thành công', 'Đã đánh dấu tất cả là đã đọc');
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Lỗi', 'Không thể đánh dấu tất cả');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await BudgetNotificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(notif => notif.id !== id));
      Alert.alert('Thành công', 'Đã xóa thông báo');
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Lỗi', 'Không thể xóa thông báo');
    }
  };

  const deleteAllNotifications = async () => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn xóa tất cả thông báo?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user?.uid) return;

              await BudgetNotificationService.deleteAllNotifications(user.uid);
              setNotifications([]);
              Alert.alert('Thành công', 'Đã xóa tất cả thông báo');
            } catch (error) {
              console.error('Error deleting all notifications:', error);
              Alert.alert('Lỗi', 'Không thể xóa tất cả thông báo');
            }
          },
        },
      ]
    );
  };

  const deleteReadNotifications = async () => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn xóa tất cả thông báo đã đọc?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user?.uid) return;

              await BudgetNotificationService.deleteReadNotifications(user.uid);
              await loadNotifications();
              Alert.alert('Thành công', 'Đã xóa tất cả thông báo đã đọc');
            } catch (error) {
              console.error('Error deleting read notifications:', error);
              Alert.alert('Lỗi', 'Không thể xóa thông báo đã đọc');
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = async (notif: BudgetNotification) => {
    await markAsRead(notif.id);

    // Nếu là thông báo vượt ngân sách, hiển thị phân tích
    if ((notif.type === 'budget_warning' || notif.type === 'budget_exceeded') && notif.metadata?.categoryId) {
      setSelectedNotification(notif);
      setShowAnalysisModal(true);
      setAnalyzing(true);
      setAnalysisText('');

      try {
        const user = auth.currentUser;
        if (user?.uid) {
          const analysis = await BudgetNotificationService.analyzeBudgetExceeded(
            notif.metadata.categoryId,
            user.uid
          );
          setAnalysisText(analysis);
        }
      } catch (error) {
        console.error('Error analyzing:', error);
        setAnalysisText('Không thể phân tích nguyên nhân.');
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const getIcon = (type: BudgetNotification['type']) => {
    switch (type) {
      case 'budget_warning':
      case 'budget_exceeded':
        return 'alert-circle';
      case 'goal_progress':
      case 'goal_achieved':
        return 'target';
      case 'goal_reminder':
        return 'bell-alert';
      case 'large_expense':
        return 'cash-multiple';
      default:
        return 'information';
    }
  };

  const getColor = (type: BudgetNotification['type'], priority: BudgetNotification['priority']) => {
    if (priority === 'critical') return '#F44336';
    if (priority === 'high') return '#FF9800';
    if (priority === 'medium') return '#FFC107';
    if (priority === 'low') return '#4CAF50';

    switch (type) {
      case 'budget_exceeded':
        return '#F44336';
      case 'budget_warning':
        return '#FF9800';
      case 'goal_achieved':
        return '#4CAF50';
      case 'goal_progress':
      case 'goal_reminder':
        return themeColor;
      case 'large_expense':
        return '#FF9800';
      default:
        return themeColor;
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('NotificationSettings' as never)} style={styles.settingsButton}>
            <Icon name="cog-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Actions Bar */}
      <View style={styles.actionsBar}>
        <TouchableOpacity onPress={markAllAsRead} style={styles.actionButton}>
          <Icon name="check-all" size={20} color={themeColor} />
          <Text style={[styles.actionText, { color: themeColor }]}>Đánh dấu tất cả</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={deleteReadNotifications} style={styles.actionButton}>
          <Icon name="delete-sweep" size={20} color="#F44336" />
          <Text style={[styles.actionText, { color: '#F44336' }]}>Xóa đã đọc</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={deleteAllNotifications} style={styles.actionButton}>
          <Icon name="delete" size={20} color="#F44336" />
          <Text style={[styles.actionText, { color: '#F44336' }]}>Xóa tất cả</Text>
        </TouchableOpacity>
      </View>

      {/* Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {(['all', 'budget_warning', 'budget_exceeded', 'goal_progress', 'goal_achieved', 'large_expense'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && [styles.filterButtonActive, { backgroundColor: themeColor }],
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f === 'all' ? 'Tất cả' :
               f === 'budget_warning' ? 'Cảnh báo' :
               f === 'budget_exceeded' ? 'Vượt ngân sách' :
               f === 'goal_progress' ? 'Tiến độ' :
               f === 'goal_achieved' ? 'Đạt mục tiêu' :
               'Chi tiêu lớn'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Danh sách thông báo */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.loadingText}>Đang tải thông báo...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColor} />
          }
        >
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="bell-off" size={60} color="#BDBDBD" />
              <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
            </View>
          ) : (
            filteredNotifications.map((notif) => {
              const color = getColor(notif.type, notif.priority);
              return (
                <TouchableOpacity
                  key={notif.id}
                  style={[
                    styles.notificationItem,
                    !notif.isRead && [styles.unread, { borderLeftColor: color }],
                  ]}
                  onPress={() => handleNotificationPress(notif)}
                  onLongPress={() => {
                    Alert.alert(
                      notif.title,
                      'Bạn muốn làm gì?',
                      [
                        { text: 'Hủy', style: 'cancel' },
                        {
                          text: 'Xóa',
                          style: 'destructive',
                          onPress: () => deleteNotification(notif.id),
                        },
                        {
                          text: notif.isRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc',
                          onPress: () => markAsRead(notif.id),
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                    <Icon name={getIcon(notif.type)} size={24} color={color} />
                  </View>
                  <View style={styles.content}>
                    <View style={styles.headerRow}>
                      <Text style={[styles.title, !notif.isRead && styles.unreadText]}>
                        {notif.title}
                      </Text>
                      <Text style={styles.time}>{formatTime(notif.createdAt)}</Text>
                    </View>
                    <Text style={[styles.message, !notif.isRead && styles.unreadText]}>
                      {notif.message}
                    </Text>
                    {notif.metadata && (
                      <View style={styles.metadata}>
                        {notif.metadata.percentage !== undefined && (
                          <React.Fragment>
                            <View style={styles.progressBar}>
                              <View
                                style={[
                                  styles.progressFill,
                                  {
                                    width: `${Math.min(notif.metadata.percentage || 0, 100)}%`,
                                    backgroundColor: color,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.progressText}>
                              {notif.metadata.percentage.toFixed(1)}%
                            </Text>
                          </React.Fragment>
                        )}
                      </View>
                    )}
                  </View>
                  {!notif.isRead && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal phân tích nguyên nhân */}
      <Modal
        visible={showAnalysisModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAnalysisModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Phân tích nguyên nhân</Text>
              <TouchableOpacity
                onPress={() => setShowAnalysisModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {analyzing ? (
                <View style={styles.analyzingContainer}>
                  <ActivityIndicator size="large" color={themeColor} />
                  <Text style={styles.analyzingText}>Đang phân tích...</Text>
                </View>
              ) : (
                <Text style={styles.analysisText}>{analysisText || 'Không có dữ liệu để phân tích.'}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  settingsButton: {
    padding: 4,
    marginLeft: 8,
  },
  actionsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  actionText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#1E88E5',
  },
  filterText: {
    fontSize: 13,
    color: '#757575',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#757575',
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
    marginTop: 4,
  },
  unreadText: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    top: 16,
    right: 16,
  },
  metadata: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#757575',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  analyzingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#757575',
  },
  analysisText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 22,
  },
});

export default Thongbao;

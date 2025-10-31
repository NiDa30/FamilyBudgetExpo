import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

type MenuScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Setting'>;

const { width, height } = Dimensions.get('window');

const MenuScreen = () => {
  const navigation = useNavigation<MenuScreenNavigationProp>();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const vipFeatures = [
    { id: '1', icon: 'palette', label: 'Tùy chỉnh màu sắc', iconBg: '#FF6B6B', color: '#FF6B6B' },
    { id: '2', icon: 'file-excel', label: 'Xuất báo cáo Excel', iconBg: '#4ECDC4', color: '#4ECDC4' },
    { id: '3', icon: 'weather-night', label: 'Chế độ tối', iconBg: '#95E1D3', color: '#95E1D3' },
    { id: '4', icon: 'cloud-sync', label: 'Đồng bộ đám mây', iconBg: '#FFD93D', color: '#FFD93D' },
  ];

  const generalItems = [
    { id: '5', icon: 'view-grid-outline', label: 'Quản lý phân loại', iconBg: '#E3F2FD', color: '#1E88E5', screen: 'Home' },
    { id: '6', icon: 'database', label: 'Sao lưu & Phục hồi', iconBg: '#F3E5F5', color: '#9C27B0' },
    { id: '7', icon: 'bell-outline', label: 'Thông báo', iconBg: '#FFF3E0', color: '#FF9800' },
    { id: '8', icon: 'translate', label: 'Ngôn ngữ', iconBg: '#E8F5E9', color: '#4CAF50' },
  ];

  const accountItems = [
    { id: '9', icon: 'lock-reset', label: 'Đổi mật khẩu', iconBg: '#FCE4EC', color: '#E91E63' },
    { id: '10', icon: 'shield-check', label: 'Bảo mật', iconBg: '#E0F2F1', color: '#009688' },
    { id: '11', icon: 'account-circle', label: 'Thông tin tài khoản', iconBg: '#EDE7F6', color: '#673AB7' },
  ];

  const otherItems = [
    { id: '12', icon: 'star-outline', label: 'Đánh giá ứng dụng', iconBg: '#FFF9C4', color: '#FBC02D' },
    { id: '13', icon: 'share-variant', label: 'Chia sẻ với bạn bè', iconBg: '#E1F5FE', color: '#03A9F4' },
    { id: '14', icon: 'information-outline', label: 'Về ứng dụng', iconBg: '#F5F5F5', color: '#757575' },
  ];

  const handleMenuPress = (item: any) => {
    if (item.screen) {
      navigation.navigate(item.screen);
      handleClose();
    } else {
      console.log('Menu pressed:', item.label);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const handleLogout = () => {
    // Navigate to login screen
    navigation.navigate('Login');
  };

  const renderMenuItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={() => handleMenuPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: item.iconBg }]}>
        <Icon name={item.icon} size={22} color={item.color} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      <Icon name="chevron-right" size={20} color="#BDBDBD" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.drawerContainer} onStartShouldSetResponder={() => true}>
          {/* Header with Profile */}
          <View style={styles.drawerHeader}>
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />
            
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.8}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Icon name="account" size={40} color="#fff" />
                </View>
                <View style={styles.vipBadge}>
                  <Icon name="crown" size={12} color="#FFD700" />
                </View>
              </View>
              <Text style={styles.userName}>Nguyễn Văn A</Text>
              <Text style={styles.userEmail}>user@example.com</Text>
              
              <TouchableOpacity style={styles.editProfileButton} activeOpacity={0.8}>
                <Icon name="pencil" size={14} color="#1E88E5" />
                <Text style={styles.editProfileText}>Chỉnh sửa</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.drawerContent}
            showsVerticalScrollIndicator={false}
          >
            {/* VIP Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="crown" size={18} color="#FFD700" />
                <Text style={styles.sectionTitle}>Tính năng VIP</Text>
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumText}>PRO</Text>
                </View>
              </View>
              <View style={styles.vipCard}>
                <Text style={styles.vipTitle}>Nâng cấp lên Premium</Text>
                <Text style={styles.vipDescription}>
                  Trải nghiệm đầy đủ tính năng cao cấp
                </Text>
                <TouchableOpacity style={styles.upgradeButton} activeOpacity={0.9}>
                  <Icon name="arrow-up-circle" size={20} color="#fff" />
                  <Text style={styles.upgradeButtonText}>Nâng cấp ngay</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.vipFeaturesGrid}>
                {vipFeatures.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.vipFeatureItem}
                    onPress={() => handleMenuPress(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.vipIconContainer, { backgroundColor: item.iconBg }]}>
                      <Icon name={item.icon} size={24} color={item.color} />
                    </View>
                    <Text style={styles.vipFeatureLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* General Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cài đặt chung</Text>
              {generalItems.map(renderMenuItem)}
            </View>

            {/* Account Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tài khoản</Text>
              {accountItems.map(renderMenuItem)}
            </View>

            {/* Other */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Khác</Text>
              {otherItems.map(renderMenuItem)}
            </View>

            {/* Logout */}
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Icon name="logout" size={22} color="#F44336" />
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </TouchableOpacity>

            {/* Version Info */}
            <View style={styles.footer}>
              <Text style={styles.versionText}>Phiên bản 1.0.0</Text>
              <Text style={styles.copyrightText}>© 2025 Money Manager</Text>
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
  },
  drawerContainer: {
    width: width * 0.85,
    height: height,
    backgroundColor: '#FAFAFA',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  drawerHeader: {
    height: 220,
    backgroundColor: '#1E88E5',
    position: 'relative',
    overflow: 'hidden',
    paddingTop: 40,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -30,
    right: -30,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: 20,
    left: -20,
  },
  closeButton: {
    position: 'absolute',
    top: 45,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  vipBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E88E5',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  editProfileText: {
    fontSize: 13,
    color: '#1E88E5',
    fontWeight: '600',
  },
  drawerContent: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  section: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#757575',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  premiumBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  vipCard: {
    backgroundColor: '#667eea',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  vipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  vipDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  vipFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  vipFeatureItem: {
    width: (width * 0.85 - 60) / 2,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  vipIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  vipFeatureLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: '#212121',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F44336',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: '#BDBDBD',
  },
});

export default MenuScreen;
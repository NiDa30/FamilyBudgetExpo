// src/Thongtintaikhoan.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useTheme } from './context/ThemeContext';
import { auth } from './firebaseConfig';
import { AuthService } from './service/auth/auth';
import FirebaseService from './service/firebase/FirebaseService';
import { signOut } from 'firebase/auth';

type ThongtintaikhoanNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Thongtintaikhoan'>;

interface UserInfo {
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  photoURL?: string;
}

const Thongtintaikhoan = () => {
  const navigation = useNavigation<ThongtintaikhoanNavigationProp>();
  const { themeColor } = useTheme();

  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    name: '',
    email: '',
    phone: '',
    joinDate: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Lấy thông tin người dùng từ Firebase
  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Lỗi', 'Bạn chưa đăng nhập');
        navigation.navigate('Login');
        return;
      }

      // Lấy thông tin từ Auth
      const authData = {
        name: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || undefined,
      };

      // Lấy thông tin từ Firestore
      let firestoreData: any = {};
      try {
        const userDoc = await FirebaseService.getUser(user.uid);
        if (userDoc) {
          firestoreData = {
            phone: userDoc.phone || userDoc.phoneNumber || '',
            joinDate: userDoc.createdAt
              ? new Date(userDoc.createdAt.toMillis?.() || userDoc.createdAt).toLocaleDateString('vi-VN')
              : user.metadata.creationTime
              ? new Date(user.metadata.creationTime).toLocaleDateString('vi-VN')
              : '',
          };
        }
      } catch (error) {
        console.log('Không tìm thấy thông tin trong Firestore, sử dụng thông tin mặc định');
        firestoreData = {
          phone: '',
          joinDate: user.metadata.creationTime
            ? new Date(user.metadata.creationTime).toLocaleDateString('vi-VN')
            : '',
        };
      }

      setUserInfo({
        ...authData,
        ...firestoreData,
      });
      setEditName(authData.name);
      setEditPhone(firestoreData.phone || '');
    } catch (error) {
      console.error('Lỗi khi tải thông tin người dùng:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên');
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Lỗi', 'Bạn chưa đăng nhập');
        return;
      }

      // Cập nhật Auth profile
      await AuthService.updateUserProfile({
        displayName: editName.trim(),
      });

      // Cập nhật Firestore
      await FirebaseService.updateUser(user.uid, {
        name: editName.trim(),
        phone: editPhone.trim(),
      });

      setUserInfo({
        ...userInfo,
        name: editName.trim(),
        phone: editPhone.trim(),
      });
      setIsEditing(false);
      Alert.alert('Thành công', 'Đã cập nhật thông tin');
    } catch (error: any) {
      console.error('Lỗi khi cập nhật:', error);
      Alert.alert('Lỗi', error.message || 'Không thể cập nhật thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              navigation.navigate('Login');
            } catch (error) {
              Alert.alert('Lỗi', 'Không thể đăng xuất');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: themeColor }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin tài khoản</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header – DÙNG MÀU THEME */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin tài khoản</Text>
        {!isEditing && (
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            style={styles.editButton}
          >
            <Icon name="pencil" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar & Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: userInfo.photoURL || 'https://via.placeholder.com/120',
              }}
              style={styles.avatar}
            />
            {/* Nút camera – DÙNG MÀU THEME */}
            <TouchableOpacity style={[styles.editAvatarButton, { backgroundColor: themeColor }]}>
              <Icon name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Tên"
                placeholderTextColor="#999"
              />
            </View>
          ) : (
            <Text style={styles.userName}>{userInfo.name || 'Chưa có tên'}</Text>
          )}
          <View style={styles.statusBadge}>
            {/* Bạn có thể thêm icon VIP ở đây nếu cần */}
          </View>
        </View>

        {/* Thông tin chi tiết */}
        <View style={styles.infoCard}>
          <View style={styles.infoItem}>
            <Icon name="email-outline" size={20} color="#666" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{userInfo.email}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Icon name="phone-outline" size={20} color="#666" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Số điện thoại</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Số điện thoại"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.infoValue}>{userInfo.phone || 'Chưa cập nhật'}</Text>
              )}
            </View>
          </View>

          <View style={styles.infoItem}>
            <Icon name="calendar-check" size={20} color="#666" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Ngày tham gia</Text>
              <Text style={styles.infoValue}>{userInfo.joinDate || 'Chưa có'}</Text>
            </View>
          </View>
        </View>

        {/* Nút lưu khi đang chỉnh sửa */}
        {isEditing && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: themeColor }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Lưu</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsEditing(false);
                setEditName(userInfo.name);
                setEditPhone(userInfo.phone);
              }}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Menu hành động */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <Icon name="logout" size={22} color="#F44336" />
              <Text style={[styles.menuLabel, { color: '#F44336' }]}>
                Đăng xuất
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color="#BDBDBD" />
          </TouchableOpacity>
        </View>
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
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  editButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  scrollContent: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#1E88E5',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 6,
  },
  editForm: {
    width: '80%',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFB300',
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoText: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#212121',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  menuSection: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 15,
    color: '#212121',
    fontWeight: '500',
  },
});

export default Thongtintaikhoan;
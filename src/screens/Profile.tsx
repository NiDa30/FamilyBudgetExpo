import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { AuthService } from '../service/auth/auth';
import { auth } from '../firebaseConfig';

export default function ProfileScreen() {
  const user = auth.currentUser;
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSaveProfile = async () => {
    try {
      setLoading(true);
      await AuthService.updateUserProfile({ displayName, photoURL });
      Alert.alert('Thành công', 'Cập nhật hồ sơ thành công');
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể cập nhật hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const onChangePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Lỗi', 'Mật khẩu mới tối thiểu 8 ký tự');
      return;
    }
    try {
      setLoading(true);
      await AuthService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Thành công', 'Đổi mật khẩu thành công');
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const onDeleteAccount = async () => {
    Alert.alert('Xóa tài khoản', 'Hành động không thể hoàn tác. Bạn có chắc?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive', onPress: async () => {
          try {
            setLoading(true);
            if (!user?.uid) throw new Error('Không xác định được người dùng');
            await AuthService.deleteAccountAndData(user.uid);
          } catch (e: any) {
            Alert.alert('Lỗi', e.message || 'Không thể xóa tài khoản');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Hồ sơ</Text>

      {!!photoURL && (
        <Image source={{ uri: photoURL }} style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 12 }} />
      )}

      <Text>Họ tên hiển thị</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Nhập họ tên"
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}
      />

      <Text>Ảnh đại diện (URL)</Text>
      <TextInput
        value={photoURL}
        onChangeText={setPhotoURL}
        placeholder="https://..."
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20 }}
      />

      <TouchableOpacity onPress={onSaveProfile} style={{ backgroundColor: '#0ea5e9', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 24 }}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Lưu hồ sơ</Text>}
      </TouchableOpacity>

      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Đổi mật khẩu</Text>
      <Text>Mật khẩu hiện tại</Text>
      <TextInput
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="********"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}
      />
      <Text>Mật khẩu mới</Text>
      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="********"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20 }}
      />
      <TouchableOpacity onPress={onChangePassword} style={{ backgroundColor: '#10b981', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 24 }}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Đổi mật khẩu</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onDeleteAccount} style={{ backgroundColor: '#ef4444', padding: 14, borderRadius: 8, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Xóa tài khoản</Text>
      </TouchableOpacity>
    </View>
  );
}



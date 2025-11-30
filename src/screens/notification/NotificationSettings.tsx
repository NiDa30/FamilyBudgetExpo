// src/screens/notification/NotificationSettings.tsx - Cài đặt loại thông báo
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../App';
import { useTheme } from '../../context/ThemeContext';
import NotificationService, { NotificationSettings } from '../../service/notifications/NotificationService';

type NotificationSettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'NotificationSettings'>;

const NotificationSettingsScreen = () => {
  const navigation = useNavigation<NotificationSettingsNavigationProp>();
  const { themeColor } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    budgetAlerts: true,
    largeExpenseAlerts: true,
    goalReminders: true,
    backupReminders: true,
    pushNotifications: true,
    emailNotifications: false,
    smsNotifications: false,
    customThresholds: {
      budgetWarningPercent: 80,
      largeExpensePercent: 10,
      largeExpenseAmount: 1000000,
    },
  });

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const currentSettings = NotificationService.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
      Alert.alert('Lỗi', 'Không thể tải cài đặt thông báo');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const updateSetting = async (key: keyof NotificationSettings, value: any) => {
    try {
      setSaving(true);
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await NotificationService.updateSettings({ [key]: value });
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật cài đặt');
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const updateThreshold = async (key: keyof NotificationSettings['customThresholds'], value: number) => {
    try {
      setSaving(true);
      const newThresholds = { ...settings.customThresholds, [key]: value };
      const newSettings = { ...settings, customThresholds: newThresholds };
      setSettings(newSettings);
      await NotificationService.updateSettings({ customThresholds: newThresholds });
    } catch (error) {
      console.error('Error updating threshold:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật ngưỡng');
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const SettingItem = ({ 
    title, 
    description, 
    value, 
    onValueChange, 
    icon 
  }: { 
    title: string; 
    description?: string; 
    value: boolean; 
    onValueChange: (value: boolean) => void; 
    icon: string;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={24} color={themeColor} style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E0E0E0', true: themeColor + '80' }}
        thumbColor={value ? themeColor : '#f4f3f4'}
      />
    </View>
  );

  const ThresholdItem = ({
    title,
    description,
    value,
    unit,
    onValueChange,
    icon,
  }: {
    title: string;
    description?: string;
    value: number;
    unit: string;
    onValueChange: (value: number) => void;
    icon: string;
  }) => (
    <View style={styles.thresholdItem}>
      <View style={styles.thresholdLeft}>
        <Icon name={icon} size={24} color={themeColor} style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
      </View>
      <View style={styles.thresholdControls}>
        <TouchableOpacity
          style={[styles.thresholdButton, { backgroundColor: themeColor }]}
          onPress={() => onValueChange(Math.max(0, value - (value >= 100 ? 10 : 5)))}
        >
          <Icon name="minus" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.thresholdValue}>
          <Text style={styles.thresholdText}>{value}{unit}</Text>
        </View>
        <TouchableOpacity
          style={[styles.thresholdButton, { backgroundColor: themeColor }]}
          onPress={() => onValueChange(value + (value >= 100 ? 10 : 5))}
        >
          <Icon name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={themeColor} />
        <Text style={styles.loadingText}>Đang tải cài đặt...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt thông báo</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollContent}>
        {/* Thông báo Ngân sách */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông báo Ngân sách</Text>
          
          <SettingItem
            title="Cảnh báo ngân sách"
            description="Nhận thông báo khi chi tiêu gần đạt ngân sách"
            value={settings.budgetAlerts}
            onValueChange={(value) => updateSetting('budgetAlerts', value)}
            icon="alert-circle"
          />

          <ThresholdItem
            title="Ngưỡng cảnh báo"
            description="Phần trăm chi tiêu để kích hoạt cảnh báo"
            value={settings.customThresholds.budgetWarningPercent}
            unit="%"
            onValueChange={(value) => updateThreshold('budgetWarningPercent', value)}
            icon="percent"
          />
        </View>

        {/* Thông báo Mục tiêu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông báo Mục tiêu</Text>
          
          <SettingItem
            title="Nhắc nhở mục tiêu"
            description="Nhận thông báo về tiến độ mục tiêu"
            value={settings.goalReminders}
            onValueChange={(value) => updateSetting('goalReminders', value)}
            icon="target"
          />
        </View>

        {/* Thông báo Chi tiêu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông báo Chi tiêu</Text>
          
          <SettingItem
            title="Chi tiêu lớn"
            description="Nhận thông báo khi có chi tiêu lớn"
            value={settings.largeExpenseAlerts}
            onValueChange={(value) => updateSetting('largeExpenseAlerts', value)}
            icon="cash-multiple"
          />

          <ThresholdItem
            title="Ngưỡng chi tiêu lớn"
            description="Số tiền tối thiểu để được coi là chi tiêu lớn"
            value={settings.customThresholds.largeExpenseAmount}
            unit=" ₫"
            onValueChange={(value) => updateThreshold('largeExpenseAmount', value)}
            icon="currency-usd"
          />
        </View>

        {/* Thông báo Hệ thống */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông báo Hệ thống</Text>
          
          <SettingItem
            title="Nhắc nhở sao lưu"
            description="Nhận thông báo nhắc nhở sao lưu dữ liệu"
            value={settings.backupReminders}
            onValueChange={(value) => updateSetting('backupReminders', value)}
            icon="backup-restore"
          />
        </View>

        {/* Kênh Thông báo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kênh Thông báo</Text>
          
          <SettingItem
            title="Thông báo đẩy (Push)"
            description="Nhận thông báo qua ứng dụng"
            value={settings.pushNotifications}
            onValueChange={(value) => updateSetting('pushNotifications', value)}
            icon="bell"
          />

          <SettingItem
            title="Thông báo Email"
            description="Nhận thông báo qua email"
            value={settings.emailNotifications}
            onValueChange={(value) => updateSetting('emailNotifications', value)}
            icon="email"
          />

          <SettingItem
            title="Thông báo SMS"
            description="Nhận thông báo qua tin nhắn"
            value={settings.smsNotifications}
            onValueChange={(value) => updateSetting('smsNotifications', value)}
            icon="message-text"
          />
        </View>

        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color={themeColor} />
            <Text style={styles.savingText}>Đang lưu...</Text>
          </View>
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
    width: 32,
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#757575',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
  },
  thresholdItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  thresholdLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  thresholdControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 36,
  },
  thresholdButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thresholdValue: {
    minWidth: 80,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  thresholdText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#757575',
  },
});

export default NotificationSettingsScreen;


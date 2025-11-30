// src/Saoluu.tsx - Sao lưu và Khôi phục dữ liệu
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useTheme } from "./context/ThemeContext";
import { auth } from "./firebaseConfig";
import databaseService from "./database/databaseService";
import * as Crypto from "expo-crypto";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
  getMetadata,
} from "firebase/storage";
import { storage } from "./firebaseConfig";
import syncEngine from "./service/sync/SyncEngine";

interface BackupInfo {
  id: string;
  timestamp: number;
  size: number;
  version: string;
  encrypted: boolean;
  description?: string;
}

const Saoluu = () => {
  const navigation = useNavigation();
  const { themeColor } = useTheme();

  const [loading, setLoading] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");
  const [lastBackup, setLastBackup] = useState<BackupInfo | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupInfo[]>([]);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupDescription, setBackupDescription] = useState("");
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(100 * 1024 * 1024); // 100MB default

  // Load settings on mount
  useEffect(() => {
    loadBackupSettings();
    loadBackupHistory();
    checkStorageUsage();
  }, []);

  // Auto backup scheduler
  useEffect(() => {
    if (!autoBackupEnabled) return;

    const scheduleAutoBackup = (): ReturnType<typeof setTimeout> => {
      const now = new Date();
      let nextBackupTime: Date;

      switch (backupFrequency) {
        case "daily":
          nextBackupTime = new Date(now);
          nextBackupTime.setHours(2, 0, 0, 0); // 2:00 AM
          if (nextBackupTime <= now) {
            nextBackupTime.setDate(nextBackupTime.getDate() + 1);
          }
          break;
        case "weekly":
          nextBackupTime = new Date(now);
          nextBackupTime.setDate(now.getDate() + (7 - now.getDay()));
          nextBackupTime.setHours(2, 0, 0, 0);
          break;
        case "monthly":
          nextBackupTime = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            1,
            2,
            0,
            0
          );
          break;
      }

      const timeUntilBackup = nextBackupTime.getTime() - now.getTime();
      console.log(
        `⏰ Next auto backup scheduled in ${Math.round(
          timeUntilBackup / 1000 / 60
        )} minutes`
      );

      // Schedule backup
      return setTimeout(() => {
        performBackup("auto");
      }, timeUntilBackup);
    };

    const timeoutId = scheduleAutoBackup();
    return () => clearTimeout(timeoutId);
  }, [autoBackupEnabled, backupFrequency]);

  const loadBackupSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem("backupSettings");
      if (settings) {
        const parsed = JSON.parse(settings);
        setAutoBackupEnabled(parsed.autoBackupEnabled || false);
        setBackupFrequency(parsed.backupFrequency || "daily");
      }
    } catch (error) {
      console.error("Error loading backup settings:", error);
    }
  };

  const saveBackupSettings = async () => {
    try {
      await AsyncStorage.setItem(
        "backupSettings",
        JSON.stringify({
          autoBackupEnabled,
          backupFrequency,
        })
      );
    } catch (error) {
      console.error("Error saving backup settings:", error);
    }
  };

  const loadBackupHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Load backup list from Firebase Storage (as per guide requirement)
      const storageRef = ref(storage, `backups/${user.uid}`);
      const listResult = await listAll(storageRef);

      const backupList: BackupInfo[] = [];

      // Get metadata for each backup file
      for (const item of listResult.items) {
        try {
          const metadata = await getMetadata(item);
          const fileName = item.name;

          // Extract timestamp from filename (format: backup_userId_timestamp.json)
          const timestampMatch = fileName.match(/_(\d+)\.json$/);
          const timestamp = timestampMatch
            ? parseInt(timestampMatch[1])
            : metadata.timeCreated
            ? new Date(metadata.timeCreated).getTime()
            : Date.now();

          backupList.push({
            id: fileName,
            timestamp: timestamp,
            size: metadata.size || 0,
            version: "1.0.0",
            encrypted: true,
            description: metadata.customMetadata?.description || undefined,
          });
        } catch (error) {
          console.warn(`Error loading metadata for ${item.name}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      backupList.sort((a, b) => b.timestamp - a.timestamp);

      setBackupHistory(backupList);
      if (backupList.length > 0) {
        setLastBackup(backupList[0]); // Most recent backup
      }

      // Also save to AsyncStorage for offline access
      await AsyncStorage.setItem("backupHistory", JSON.stringify(backupList));
    } catch (error) {
      console.error("Error loading backup history:", error);
      // Fallback to AsyncStorage if Firebase fails
      try {
        const history = await AsyncStorage.getItem("backupHistory");
        if (history) {
          const parsed = JSON.parse(history);
          setBackupHistory(parsed);
          if (parsed.length > 0) {
            setLastBackup(parsed[0]);
          }
        }
      } catch (fallbackError) {
        console.error(
          "Error loading backup history from AsyncStorage:",
          fallbackError
        );
      }
    }
  };

  const checkStorageUsage = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Check Firebase Storage usage
      const storageRef = ref(storage, `backups/${user.uid}`);
      const listResult = await listAll(storageRef);

      let totalSize = 0;
      for (const item of listResult.items) {
        try {
          const url = await getDownloadURL(item);
          const response = await fetch(url, { method: "HEAD" });
          const contentLength = response.headers.get("content-length");
          if (contentLength) {
            totalSize += parseInt(contentLength);
          }
        } catch (error) {
          console.warn("Error checking file size:", error);
        }
      }

      setStorageUsed(totalSize);
    } catch (error) {
      console.error("Error checking storage usage:", error);
    }
  };

  const performBackup = async (type: "manual" | "auto" = "manual") => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Lỗi", "Vui lòng đăng nhập để sao lưu dữ liệu");
        return;
      }

      // Ensure database is initialized
      await databaseService.ensureInitialized();

      // Export all data from SQLite
      const backupData = {
        version: "1.0.0",
        timestamp: Date.now(),
        userId: user.uid,
        description: type === "manual" ? backupDescription : "Auto backup",
        data: {
          categories: await databaseService.getCategoriesByUser(user.uid),
          transactions: await databaseService.getTransactionsByUser(user.uid),
        },
      };

      // Encrypt backup data
      const jsonData = JSON.stringify(backupData);
      const encryptedData = await encryptData(jsonData);

      // Save to local file
      const fileName = `backup_${user.uid}_${Date.now()}.json`;
      const documentDir = (FileSystem as any).documentDirectory;
      const fileUri = `${documentDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, encryptedData, {
        encoding: "utf8" as any,
      });

      // Upload to Firebase Storage with metadata
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: "utf8" as any,
        });
        const blob = new Blob([fileContent], { type: "application/json" });
        const storageRef = ref(storage, `backups/${user.uid}/${fileName}`);

        // Upload with metadata (as per guide requirement: lưu metadata - ngày, kích thước, loại)
        const metadata = {
          contentType: "application/json",
          customMetadata: {
            description: backupData.description || "",
            version: backupData.version,
            userId: user.uid,
            type: type === "auto" ? "auto" : "manual",
            size: fileInfo.size?.toString() || "0",
          },
        };

        await uploadBytes(storageRef, blob, metadata);

        // Update backup history
        const backupInfo: BackupInfo = {
          id: fileName,
          timestamp: backupData.timestamp,
          size: fileInfo.size || 0,
          version: backupData.version,
          encrypted: true,
          description: backupData.description,
        };

        const updatedHistory = [backupInfo, ...backupHistory].slice(0, 10); // Keep last 10 backups
        setBackupHistory(updatedHistory);
        setLastBackup(backupInfo);
        await AsyncStorage.setItem(
          "backupHistory",
          JSON.stringify(updatedHistory)
        );

        // Clean up old backups (keep only last 5)
        if (updatedHistory.length > 5) {
          const oldBackups = updatedHistory.slice(5);
          for (const oldBackup of oldBackups) {
            try {
              const oldRef = ref(
                storage,
                `backups/${user.uid}/${oldBackup.id}`
              );
              await deleteObject(oldRef);
            } catch (error) {
              console.warn("Error deleting old backup:", error);
            }
          }
        }

        await checkStorageUsage();

        // Reload backup history from Firebase Storage (as per guide requirement)
        await loadBackupHistory();

        setShowBackupModal(false);
        setBackupDescription("");

        Alert.alert(
          "Thành công",
          `Đã sao lưu dữ liệu thành công!\nKích thước: ${formatFileSize(
            backupInfo.size
          )}`
        );
      }
    } catch (error: any) {
      console.error("Backup error:", error);
      Alert.alert("Lỗi", `Không thể sao lưu dữ liệu: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const restoreFromBackup = async (backupInfo: BackupInfo) => {
    Alert.alert(
      "Xác nhận",
      "Khôi phục dữ liệu sẽ thay thế toàn bộ dữ liệu hiện tại. Bạn có chắc chắn?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Khôi phục",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const user = auth.currentUser;
              if (!user) {
                Alert.alert("Lỗi", "Vui lòng đăng nhập");
                return;
              }

              // Download backup from Firebase Storage
              const storageRef = ref(
                storage,
                `backups/${user.uid}/${backupInfo.id}`
              );
              const url = await getDownloadURL(storageRef);
              const response = await fetch(url);
              const encryptedData = await response.text();

              // Decrypt data
              const decryptedData = await decryptData(encryptedData);
              const backupData = JSON.parse(decryptedData);

              // Restore data to SQLite
              await databaseService.ensureInitialized();

              // Khôi phục vào SQLite (as per guide requirement)
              // Note: We restore data - duplicates will be handled by database constraints

              let restoredCategories = 0;
              let restoredTransactions = 0;

              // Restore categories
              for (const category of backupData.data.categories || []) {
                try {
                  // Try to update first, then create if not exists
                  await databaseService.createCategory(category);
                  restoredCategories++;
                } catch (error: any) {
                  // If category already exists, try to update it
                  if (
                    error.message?.includes("UNIQUE constraint") ||
                    error.message?.includes("already exists")
                  ) {
                    try {
                      await databaseService.updateCategory(
                        category.id || category.categoryID,
                        category
                      );
                      restoredCategories++;
                    } catch (updateError) {
                      console.warn("Error updating category:", updateError);
                    }
                  } else {
                    console.warn("Error restoring category:", error);
                  }
                }
              }

              // Restore transactions
              for (const transaction of backupData.data.transactions || []) {
                try {
                  await databaseService.createTransaction(transaction);
                  restoredTransactions++;
                } catch (error: any) {
                  // If transaction already exists, try to update it
                  if (
                    error.message?.includes("UNIQUE constraint") ||
                    error.message?.includes("already exists")
                  ) {
                    try {
                      await databaseService.updateTransaction(
                        transaction.id || transaction.transactionID,
                        transaction
                      );
                      restoredTransactions++;
                    } catch (updateError) {
                      console.warn("Error updating transaction:", updateError);
                    }
                  } else {
                    console.warn("Error restoring transaction:", error);
                  }
                }
              }

              console.log(
                `✅ Restored ${restoredCategories} categories and ${restoredTransactions} transactions`
              );

              // Đồng bộ lên Firebase (as per guide requirement)
              try {
                console.log("🔄 Syncing restored data to Firebase...");
                await syncEngine.performSync(user.uid, true); // Force sync after restore
                console.log("✅ Data synced to Firebase successfully");
              } catch (syncError) {
                console.warn(
                  "⚠️ Warning: Failed to sync to Firebase after restore:",
                  syncError
                );
                // Don't fail the restore if sync fails - data is already in SQLite
              }

              setShowRestoreModal(false);

              // Reload backup history to reflect changes
              await loadBackupHistory();

              Alert.alert("Thành công", "Đã khôi phục dữ liệu thành công!");
            } catch (error: any) {
              console.error("Restore error:", error);
              Alert.alert(
                "Lỗi",
                `Không thể khôi phục dữ liệu: ${error.message}`
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const encryptData = async (data: string): Promise<string> => {
    // Simple encryption using expo-crypto (for production, use a proper encryption library)
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data
    );
    // In production, use proper encryption like expo-crypto's AES encryption
    return btoa(data + "|" + hash); // Base64 encoding for simplicity
  };

  const decryptData = async (encryptedData: string): Promise<string> => {
    // Simple decryption
    const decoded = atob(encryptedData);
    const [data] = decoded.split("|");
    return data;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString("vi-VN");
  };

  const handleAutoBackupToggle = async (value: boolean) => {
    setAutoBackupEnabled(value);
    await saveBackupSettings();
    if (value) {
      Alert.alert(
        "Đã bật",
        `Sao lưu tự động sẽ chạy ${
          backupFrequency === "daily"
            ? "hàng ngày"
            : backupFrequency === "weekly"
            ? "hàng tuần"
            : "hàng tháng"
        } lúc 2:00 AM`
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={themeColor} barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sao lưu & Khôi phục</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Auto Backup Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="backup-restore" size={24} color={themeColor} />
            <Text style={styles.sectionTitle}>Sao lưu Tự động</Text>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Bật sao lưu tự động</Text>
              <Text style={styles.settingDescription}>
                Tự động sao lưu dữ liệu theo lịch đã đặt
              </Text>
            </View>
            <Switch
              value={autoBackupEnabled}
              onValueChange={handleAutoBackupToggle}
              trackColor={{ false: "#E0E0E0", true: themeColor }}
            />
          </View>

          {autoBackupEnabled && (
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Tần suất sao lưu</Text>
              <View style={styles.frequencyButtons}>
                {(["daily", "weekly", "monthly"] as const).map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.frequencyButton,
                      backupFrequency === freq && {
                        backgroundColor: themeColor,
                      },
                    ]}
                    onPress={() => {
                      setBackupFrequency(freq);
                      saveBackupSettings();
                    }}
                  >
                    <Text
                      style={[
                        styles.frequencyButtonText,
                        backupFrequency === freq && { color: "#fff" },
                      ]}
                    >
                      {freq === "daily"
                        ? "Hàng ngày"
                        : freq === "weekly"
                        ? "Hàng tuần"
                        : "Hàng tháng"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Last Backup Info */}
        {lastBackup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="clock-outline" size={24} color={themeColor} />
              <Text style={styles.sectionTitle}>Sao lưu Gần nhất</Text>
            </View>
            <View style={styles.backupCard}>
              <View style={styles.backupCardHeader}>
                <Icon name="database-check" size={32} color={themeColor} />
                <View style={styles.backupCardInfo}>
                  <Text style={styles.backupCardDate}>
                    {formatDate(lastBackup.timestamp)}
                  </Text>
                  <Text style={styles.backupCardSize}>
                    {formatFileSize(lastBackup.size)}
                  </Text>
                </View>
              </View>
              {lastBackup.description && (
                <Text style={styles.backupCardDescription}>
                  {lastBackup.description}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Storage Usage */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="harddisk" size={24} color={themeColor} />
            <Text style={styles.sectionTitle}>Dung lượng Lưu trữ</Text>
          </View>
          <View style={styles.storageCard}>
            <View style={styles.storageInfo}>
              <Text style={styles.storageLabel}>Đã sử dụng</Text>
              <Text style={styles.storageValue}>
                {formatFileSize(storageUsed)} / {formatFileSize(storageLimit)}
              </Text>
            </View>
            <View style={styles.storageBar}>
              <View
                style={[
                  styles.storageBarFill,
                  {
                    width: `${Math.min(
                      (storageUsed / storageLimit) * 100,
                      100
                    )}%`,
                    backgroundColor: themeColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.storageWarning}>
              {storageUsed > storageLimit * 0.9
                ? "⚠️ Dung lượng gần đầy. Vui lòng xóa các bản sao lưu cũ."
                : "💾 Dung lượng còn dư"}
            </Text>
          </View>
        </View>

        {/* Manual Backup */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: themeColor }]}
            onPress={() => setShowBackupModal(true)}
            disabled={loading}
          >
            <Icon name="backup-restore" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Sao lưu Thủ công</Text>
          </TouchableOpacity>
        </View>

        {/* Restore */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, styles.restoreButton]}
            onPress={() => setShowRestoreModal(true)}
            disabled={loading}
          >
            <Icon name="restore" size={24} color={themeColor} />
            <Text style={[styles.actionButtonText, { color: themeColor }]}>
              Khôi phục Dữ liệu
            </Text>
          </TouchableOpacity>
        </View>

        {/* Backup History */}
        {backupHistory.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="history" size={24} color={themeColor} />
              <Text style={styles.sectionTitle}>Lịch sử Sao lưu</Text>
            </View>
            {backupHistory.map((backup) => (
              <TouchableOpacity
                key={backup.id}
                style={styles.historyItem}
                onPress={() => restoreFromBackup(backup)}
              >
                <View style={styles.historyItemLeft}>
                  <Icon name="database" size={20} color={themeColor} />
                  <View style={styles.historyItemInfo}>
                    <Text style={styles.historyItemDate}>
                      {formatDate(backup.timestamp)}
                    </Text>
                    <Text style={styles.historyItemSize}>
                      {formatFileSize(backup.size)}
                    </Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={20} color="#757575" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Backup Modal */}
      <Modal
        visible={showBackupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBackupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sao lưu Dữ liệu</Text>
              <TouchableOpacity onPress={() => setShowBackupModal(false)}>
                <Icon name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Mô tả (tùy chọn)"
              value={backupDescription}
              onChangeText={setBackupDescription}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowBackupModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: themeColor }]}
                onPress={() => performBackup("manual")}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Sao lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Restore Modal */}
      <Modal
        visible={showRestoreModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn Bản Sao lưu</Text>
              <TouchableOpacity onPress={() => setShowRestoreModal(false)}>
                <Icon name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.restoreList}>
              {backupHistory.length === 0 ? (
                <Text style={styles.emptyText}>Chưa có bản sao lưu nào</Text>
              ) : (
                backupHistory.map((backup) => (
                  <TouchableOpacity
                    key={backup.id}
                    style={styles.restoreItem}
                    onPress={() => restoreFromBackup(backup)}
                  >
                    <View style={styles.restoreItemLeft}>
                      <Icon name="database" size={24} color={themeColor} />
                      <View style={styles.restoreItemInfo}>
                        <Text style={styles.restoreItemDate}>
                          {formatDate(backup.timestamp)}
                        </Text>
                        <Text style={styles.restoreItemSize}>
                          {formatFileSize(backup.size)}
                        </Text>
                        {backup.description && (
                          <Text style={styles.restoreItemDescription}>
                            {backup.description}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Icon name="chevron-right" size={20} color="#757575" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => setShowRestoreModal(false)}
            >
              <Text style={styles.modalButtonTextCancel}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.loadingText}>Đang xử lý...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  settingItem: {
    marginBottom: 16,
  },
  settingInfo: {
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: "#757575",
  },
  frequencyButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  frequencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#757575",
  },
  backupCard: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  backupCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  backupCardInfo: {
    flex: 1,
  },
  backupCardDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  backupCardSize: {
    fontSize: 14,
    color: "#757575",
  },
  backupCardDescription: {
    fontSize: 13,
    color: "#757575",
    fontStyle: "italic",
  },
  storageCard: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 12,
  },
  storageInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  storageLabel: {
    fontSize: 14,
    color: "#757575",
  },
  storageValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
  },
  storageBar: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  storageBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  storageWarning: {
    fontSize: 12,
    color: "#FF9800",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  restoreButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 8,
  },
  historyItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  historyItemInfo: {
    flex: 1,
  },
  historyItemDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  historyItemSize: {
    fontSize: 12,
    color: "#757575",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#212121",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#F5F5F5",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalButtonTextCancel: {
    color: "#757575",
    fontSize: 16,
    fontWeight: "600",
  },
  restoreList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  restoreItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 12,
  },
  restoreItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  restoreItemInfo: {
    flex: 1,
  },
  restoreItemDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  restoreItemSize: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 4,
  },
  restoreItemDescription: {
    fontSize: 12,
    color: "#9E9E9E",
    fontStyle: "italic",
  },
  emptyText: {
    textAlign: "center",
    color: "#9E9E9E",
    padding: 40,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
  },
});

export default Saoluu;

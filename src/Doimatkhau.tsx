// src/Doimatkhau.tsx
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { useTheme } from "./context/ThemeContext";
import { auth } from "./firebaseConfig";
import { AuthService } from "./service/auth/auth";
import FirebaseService from "./service/firebase/FirebaseService";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { COLLECTIONS } from "./constants/collections";

type DoimatkhauNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Doimatkhau"
>;

interface LoginHistory {
  id: string;
  loginTime: any;
  deviceInfo?: string;
  ipAddress?: string;
  location?: string;
}

const Doimatkhau = () => {
  const navigation = useNavigation<DoimatkhauNavigationProp>();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isCurrentFocused, setIsCurrentFocused] = useState(false);
  const [isNewFocused, setIsNewFocused] = useState(false);
  const [isConfirmFocused, setIsConfirmFocused] = useState(false);

  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"password" | "delete" | "history">("password");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const { themeColor } = useTheme();

  useEffect(() => {
    if (activeTab === "history") {
      loadLoginHistory();
    }
  }, [activeTab]);

  const loadLoginHistory = async () => {
    setLoadingHistory(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      let history: LoginHistory[] = [];
      let indexUrl: string | null = null;

      // Try LOGIN_HISTORY with index first
      try {
        const q = query(
          collection(db, COLLECTIONS.LOGIN_HISTORY || "LOGIN_HISTORY"),
          where("userID", "==", user.uid),
          orderBy("loginTime", "desc"),
          limit(20)
        );
        const snapshot = await getDocs(q);
        history = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            loginTime: data.loginTime || data.createdAt,
            deviceInfo: data.deviceInfo || data.deviceID || Platform.OS,
            location: data.location || "Unknown",
            ipAddress: data.ipAddress,
          };
        });
      } catch (error: any) {
        // Check if it's an index error
        const isIndexError = error.code === "failed-precondition" || 
                           (error.message && error.message.includes("index"));
        
        if (isIndexError) {
          // Extract index URL from error message
          const indexUrlMatch = error.message?.match(/https:\/\/[^\s\)]+/);
          if (indexUrlMatch) {
            indexUrl = indexUrlMatch[0];
          }

          // Try without orderBy (fallback)
          try {
            const qWithoutOrder = query(
              collection(db, COLLECTIONS.LOGIN_HISTORY || "LOGIN_HISTORY"),
              where("userID", "==", user.uid),
              limit(50) // Get more to sort in memory
            );
            const snapshot = await getDocs(qWithoutOrder);
            const allHistory = snapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                loginTime: data.loginTime || data.createdAt,
                deviceInfo: data.deviceInfo || data.deviceID || Platform.OS,
                location: data.location || "Unknown",
                ipAddress: data.ipAddress,
              };
            });
            
            // Sort in memory and take top 20
            history = allHistory
              .sort((a, b) => {
                const timeA = a.loginTime?.toMillis?.() || a.loginTime || 0;
                const timeB = b.loginTime?.toMillis?.() || b.loginTime || 0;
                return timeB - timeA;
              })
              .slice(0, 20);
          } catch (fallbackError) {
            console.log("Fallback query failed, trying SYNC_LOG");
            // Final fallback to SYNC_LOG
            try {
              const syncQ = query(
                collection(db, COLLECTIONS.SYNC_LOG),
                where("userID", "==", user.uid),
                where("action", "==", "LOGIN"),
                limit(50)
              );
              const syncSnapshot = await getDocs(syncQ);
              const syncHistory = syncSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                  id: doc.id,
                  loginTime: data.syncTime || data.createdAt,
                  deviceInfo: data.deviceID || Platform.OS,
                  location: data.location || "Unknown",
                  ipAddress: data.ipAddress,
                };
              });
              
              // Sort in memory
              history = syncHistory
                .sort((a, b) => {
                  const timeA = a.loginTime?.toMillis?.() || a.loginTime || 0;
                  const timeB = b.loginTime?.toMillis?.() || b.loginTime || 0;
                  return timeB - timeA;
                })
                .slice(0, 20);
            } catch (syncError) {
              console.error("All fallback queries failed:", syncError);
              throw error; // Throw original index error
            }
          }
        } else {
          throw error;
        }
      }

      setLoginHistory(history);

      // Show index warning if needed
      if (indexUrl) {
        Alert.alert(
          "Thông báo",
          `Để tải lịch sử đăng nhập nhanh hơn, vui lòng tạo chỉ mục Firestore:\n\n${indexUrl}\n\nHiện tại ứng dụng đang sử dụng chế độ dự phòng.`,
          [{ text: "OK" }]
        );
      }
    } catch (error: any) {
      console.error("Lỗi khi tải lịch sử đăng nhập:", error);
      
      // Extract index URL if available
      const indexUrlMatch = error.message?.match(/https:\/\/[^\s\)]+/);
      const indexUrl = indexUrlMatch ? indexUrlMatch[0] : null;
      
      if (indexUrl) {
        Alert.alert(
          "Cần tạo chỉ mục Firestore",
          `Vui lòng tạo chỉ mục tại:\n\n${indexUrl}\n\nSau khi tạo, vui lòng đợi vài phút rồi thử lại.`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Lỗi", "Không thể tải lịch sử đăng nhập");
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const recordLoginHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Record in LOGIN_HISTORY collection
      await addDoc(collection(db, COLLECTIONS.LOGIN_HISTORY || "LOGIN_HISTORY"), {
        userID: user.uid,
        loginTime: Timestamp.now(),
        deviceInfo: Platform.OS,
        deviceID: Platform.OS,
        status: "SUCCESS",
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Lỗi khi ghi lịch sử đăng nhập:", error);
    }
  };

  const handleChangePassword = async () => {
    if (currentPassword === "") {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp.");
      return;
    }

    setChanging(true);
    try {
      await AuthService.changePassword(currentPassword, newPassword);
      Alert.alert("Thành công", "Đổi mật khẩu thành công!", [
        {
          text: "OK",
          onPress: () => {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      console.error("Lỗi khi đổi mật khẩu:", error);
      let errorMessage = "Không thể đổi mật khẩu";
      
      if (error.code === "auth/wrong-password") {
        errorMessage = "Mật khẩu hiện tại không đúng";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Mật khẩu quá yếu";
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Vui lòng đăng nhập lại để thay đổi mật khẩu";
      }
      
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setChanging(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Xóa tài khoản",
      "Bạn có chắc chắn muốn xóa tài khoản? Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn và không thể khôi phục.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Tiếp tục",
          style: "destructive",
          onPress: () => {
            setShowDeleteModal(true);
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu");
      return;
    }

    setDeleting(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error("Không tìm thấy người dùng");
      }

      // Xác thực lại với mật khẩu
      const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
      const cred = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, cred);

      // Xóa tất cả dữ liệu liên quan
      await deleteAllUserData(user.uid);

      // Xóa tài khoản
      await AuthService.deleteAccountAndData(user.uid);

      setShowDeleteModal(false);
      setDeletePassword("");
      Alert.alert("Thành công", "Tài khoản đã được xóa", [
        {
          text: "OK",
          onPress: () => {
            navigation.navigate("Login");
          },
        },
      ]);
    } catch (error: any) {
      console.error("Lỗi khi xóa tài khoản:", error);
      let errorMessage = "Không thể xóa tài khoản";
      
      if (error.code === "auth/wrong-password") {
        errorMessage = "Mật khẩu không đúng";
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Vui lòng đăng nhập lại để xóa tài khoản";
      }
      
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const deleteAllUserData = async (userId: string) => {
    try {
      const { writeBatch, doc, getDocs, query, where, collection } = await import("firebase/firestore");
      
      // Xóa tất cả các collection liên quan
      const collectionsToDelete = [
        COLLECTIONS.TRANSACTIONS,
        COLLECTIONS.BUDGET,
        COLLECTIONS.GOAL,
        COLLECTIONS.CATEGORIES,
        COLLECTIONS.RECURRING_TXN,
        COLLECTIONS.NOTIFICATION,
        COLLECTIONS.DEVICE,
        COLLECTIONS.SYNC_LOG,
        COLLECTIONS.LOGIN_HISTORY,
        COLLECTIONS.REPORT,
        COLLECTIONS.TAG,
        COLLECTIONS.TRANSACTION_TAG,
        COLLECTIONS.SPLIT_TRANSACTION,
        COLLECTIONS.ATTACHMENT,
        COLLECTIONS.PAYMENT_METHHOD,
      ];

      // Firestore batch limit is 500 operations
      const BATCH_SIZE = 500;
      let batch = writeBatch(db);
      let operationCount = 0;

      for (const collectionName of collectionsToDelete) {
        try {
          const q = query(
            collection(db, collectionName),
            where("userID", "==", userId)
          );
          const snapshot = await getDocs(q);
          
          for (const docSnap of snapshot.docs) {
            if (operationCount >= BATCH_SIZE) {
              // Commit current batch and start new one
              await batch.commit();
              batch = writeBatch(db);
              operationCount = 0;
            }
            batch.delete(doc(db, collectionName, docSnap.id));
            operationCount++;
          }
        } catch (error) {
          console.log(`Không tìm thấy collection: ${collectionName}`);
        }
      }

      // Xóa user document
      try {
        if (operationCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
        batch.delete(doc(db, COLLECTIONS.USER, userId));
        operationCount++;
      } catch (error) {
        console.log("Không tìm thấy user document");
      }

      // Commit final batch
      if (operationCount > 0) {
        await batch.commit();
      }
      
      console.log("Đã xóa tất cả dữ liệu của người dùng");
    } catch (error) {
      console.error("Lỗi khi xóa dữ liệu:", error);
      throw error;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColor }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bảo mật tài khoản</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "password" && [styles.activeTab, { backgroundColor: themeColor }],
            ]}
            onPress={() => setActiveTab("password")}
          >
            <Icon
              name="lock-reset"
              size={20}
              color={activeTab === "password" ? "#fff" : "#666"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "password" && styles.activeTabText,
              ]}
            >
              Đổi mật khẩu
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "history" && [styles.activeTab, { backgroundColor: themeColor }],
            ]}
            onPress={() => setActiveTab("history")}
          >
            <Icon
              name="history"
              size={20}
              color={activeTab === "history" ? "#fff" : "#666"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "history" && styles.activeTabText,
              ]}
            >
              Lịch sử
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "delete" && [styles.activeTab, { backgroundColor: "#F44336" }],
            ]}
            onPress={() => setActiveTab("delete")}
          >
            <Icon
              name="delete"
              size={20}
              color={activeTab === "delete" ? "#fff" : "#666"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "delete" && styles.activeTabText,
              ]}
            >
              Xóa tài khoản
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Password Change Tab */}
          {activeTab === "password" && (
            <>
              {/* Mật khẩu hiện tại */}
              <View
                style={[
                  styles.inputContainer,
                  isCurrentFocused && [
                    styles.inputContainerFocused,
                    { borderColor: themeColor },
                  ],
                ]}
              >
                <Icon
                  name="lock-outline"
                  size={20}
                  color={isCurrentFocused ? themeColor : "#666"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu hiện tại"
                  secureTextEntry={!showCurrent}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                  onFocus={() => setIsCurrentFocused(true)}
                  onBlur={() => setIsCurrentFocused(false)}
                />
                <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                  <Icon
                    name={showCurrent ? "eye" : "eye-off"}
                    size={20}
                    color={isCurrentFocused ? themeColor : "#666"}
                  />
                </TouchableOpacity>
              </View>

              {/* Mật khẩu mới */}
              <View
                style={[
                  styles.inputContainer,
                  isNewFocused && [
                    styles.inputContainerFocused,
                    { borderColor: themeColor },
                  ],
                ]}
              >
                <Icon
                  name="lock-reset"
                  size={20}
                  color={isNewFocused ? themeColor : "#666"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu mới"
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  onFocus={() => setIsNewFocused(true)}
                  onBlur={() => setIsNewFocused(false)}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                  <Icon
                    name={showNew ? "eye" : "eye-off"}
                    size={20}
                    color={isNewFocused ? themeColor : "#666"}
                  />
                </TouchableOpacity>
              </View>

              {/* Xác nhận mật khẩu */}
              <View
                style={[
                  styles.inputContainer,
                  isConfirmFocused && [
                    styles.inputContainerFocused,
                    { borderColor: themeColor },
                  ],
                ]}
              >
                <Icon
                  name="lock-check"
                  size={20}
                  color={isConfirmFocused ? themeColor : "#666"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Xác nhận mật khẩu"
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  onFocus={() => setIsConfirmFocused(true)}
                  onBlur={() => setIsConfirmFocused(false)}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Icon
                    name={showConfirm ? "eye" : "eye-off"}
                    size={20}
                    color={isConfirmFocused ? themeColor : "#666"}
                  />
                </TouchableOpacity>
              </View>

              {/* Hướng dẫn */}
              <View style={styles.guideline}>
                <Text style={styles.guidelineText}>
                  Mật khẩu phải có ít nhất 6 ký tự
                </Text>
              </View>

              {/* Nút đổi mật khẩu */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: themeColor, shadowColor: themeColor },
                ]}
                onPress={handleChangePassword}
                disabled={changing}
              >
                {changing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Đổi mật khẩu</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Login History Tab */}
          {activeTab === "history" && (
            <View style={styles.historyContainer}>
              {loadingHistory ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={themeColor} />
                  <Text style={styles.loadingText}>Đang tải lịch sử...</Text>
                </View>
              ) : loginHistory.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon name="history" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>Chưa có lịch sử đăng nhập</Text>
                </View>
              ) : (
                <FlatList
                  data={loginHistory}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.historyItem}>
                      <View style={styles.historyIcon}>
                        <Icon name="login" size={24} color={themeColor} />
                      </View>
                      <View style={styles.historyContent}>
                        <Text style={styles.historyTime}>
                          {formatDate(item.loginTime)}
                        </Text>
                        <Text style={styles.historyDevice}>
                          Thiết bị: {item.deviceInfo}
                        </Text>
                        {item.location && (
                          <Text style={styles.historyLocation}>
                            Vị trí: {item.location}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}

          {/* Delete Account Tab */}
          {activeTab === "delete" && (
            <View style={styles.deleteContainer}>
              <Icon name="alert-circle" size={64} color="#F44336" />
              <Text style={styles.deleteTitle}>Xóa tài khoản</Text>
              <Text style={styles.deleteDescription}>
                Khi xóa tài khoản, tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn:
              </Text>
              <View style={styles.deleteList}>
                <View style={styles.deleteListItem}>
                  <Icon name="check-circle" size={20} color="#F44336" />
                  <Text style={styles.deleteListText}>
                    Thông tin cá nhân và hồ sơ
                  </Text>
                </View>
                <View style={styles.deleteListItem}>
                  <Icon name="check-circle" size={20} color="#F44336" />
                  <Text style={styles.deleteListText}>
                    Tất cả giao dịch và chi tiêu
                  </Text>
                </View>
                <View style={styles.deleteListItem}>
                  <Icon name="check-circle" size={20} color="#F44336" />
                  <Text style={styles.deleteListText}>
                    Ngân sách và mục tiêu
                  </Text>
                </View>
                <View style={styles.deleteListItem}>
                  <Icon name="check-circle" size={20} color="#F44336" />
                  <Text style={styles.deleteListText}>
                    Lịch sử và báo cáo
                  </Text>
                </View>
              </View>
              <Text style={styles.deleteWarning}>
                ⚠️ Hành động này không thể hoàn tác!
              </Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Icon name="delete" size={20} color="#fff" />
                    <Text style={styles.deleteButtonText}>Xóa tài khoản</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Icon name="alert-circle" size={48} color="#F44336" />
            <Text style={styles.modalTitle}>Xác nhận xóa tài khoản</Text>
            <Text style={styles.modalDescription}>
              Vui lòng nhập mật khẩu để xác nhận xóa tài khoản. Tất cả dữ liệu sẽ bị xóa vĩnh viễn.
            </Text>
            <View style={styles.modalInputContainer}>
              <Icon name="lock-outline" size={20} color="#666" style={styles.modalInputIcon} />
              <TextInput
                style={styles.modalInput}
                placeholder="Nhập mật khẩu"
                secureTextEntry={true}
                value={deletePassword}
                onChangeText={setDeletePassword}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                }}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmDeleteAccount}
                disabled={deleting || !deletePassword}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Xóa tài khoản</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    gap: 6,
  },
  activeTab: {
    backgroundColor: "#1E88E5",
  },
  tabText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#fff",
    fontWeight: "bold",
  },
  content: {
    padding: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  inputContainerFocused: {
    backgroundColor: "#fff",
    elevation: 4,
    shadowOpacity: 0.1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 14,
  },
  guideline: {
    marginBottom: 24,
    paddingLeft: 4,
  },
  guidelineText: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  historyContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    minHeight: 300,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: "#999",
  },
  historyItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  historyIcon: {
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyTime: {
    fontSize: 15,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  historyDevice: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  historyLocation: {
    fontSize: 12,
    color: "#999",
  },
  deleteContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  deleteTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#F44336",
    marginTop: 16,
    marginBottom: 8,
  },
  deleteDescription: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  deleteList: {
    width: "100%",
    marginBottom: 20,
  },
  deleteListItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingLeft: 8,
  },
  deleteListText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 12,
  },
  deleteWarning: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F44336",
    marginBottom: 24,
    textAlign: "center",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F44336",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    gap: 8,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F44336",
    marginTop: 16,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  modalInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  modalInputIcon: {
    marginRight: 12,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 14,
  },
  modalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  modalCancelText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F44336",
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default Doimatkhau;

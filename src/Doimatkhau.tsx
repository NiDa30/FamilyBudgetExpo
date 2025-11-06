// src/Doimatkhau.tsx
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
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
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { useTheme } from "./context/ThemeContext";

type DoimatkhauNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Doimatkhau"
>;

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

  const { themeColor } = useTheme();

  const handleChangePassword = () => {
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

    Alert.alert("Thành công", "Đổi mật khẩu thành công!", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
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
          <Text style={styles.headerTitle}>Đổi mật khẩu</Text>
        </View>

        <View style={styles.content}>
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
          >
            <Text style={styles.saveButtonText}>Đổi mật khẩu</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
});

export default Doimatkhau;

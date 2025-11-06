import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import Captcha from "./components/Captcha";
import { AuthService } from "./service/auth/auth";

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

type Props = {
  navigation: ForgotPasswordScreenNavigationProp;
};

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaValue, setCaptchaValue] = useState("");
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Lỗi", "Vui lòng nhập email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Lỗi", "Email không đúng định dạng");
      return;
    }

    if (!isCaptchaValid) {
      Alert.alert("Lỗi", "Vui lòng nhập đúng mã xác minh");
      return;
    }

    setLoading(true);
    try {
      await AuthService.sendResetEmail(email);
      Alert.alert(
        "Thành công",
        "Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư của bạn.",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
    } catch (error: any) {
      console.error("❌ Password reset error:", error);
      Alert.alert(
        "Lỗi",
        "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBackground}>
            <Icon name="lock-question" size={48} color="#fff" />
          </View>
        </View>
        <Text style={styles.title}>Quên mật khẩu?</Text>
        <Text style={styles.subtitle}>
          Nhập email của bạn và chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu
        </Text>
      </View>

      <View style={styles.formSection}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputContainer}>
            <Icon name="email-outline" size={22} color="#9E9E9E" />
            <TextInput
              placeholder="Nhập email của bạn"
              style={styles.input}
              placeholderTextColor="#BDBDBD"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
            />
          </View>
        </View>

        {/* CAPTCHA */}
        <Captcha
          value={captchaValue}
          onChangeText={setCaptchaValue}
          onValidate={setIsCaptchaValid}
        />

        <TouchableOpacity
          style={[styles.resetButton, loading && styles.resetButtonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.resetButtonText}>Đang gửi...</Text>
            </>
          ) : (
            <>
              <Text style={styles.resetButtonText}>
                Gửi email đặt lại mật khẩu
              </Text>
              <Icon name="send" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backToLogin}
          onPress={() => navigation.navigate("Login")}
          disabled={loading}
        >
          <Icon name="arrow-left" size={20} color="#1E88E5" />
          <Text style={styles.backToLoginText}>Quay lại đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F5F7FA",
  },
  headerSection: {
    backgroundColor: "#1E88E5",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    fontWeight: "400",
  },
  formSection: {
    backgroundColor: "#fff",
    marginTop: -20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    flex: 1,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#424242",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
    marginLeft: 12,
    fontWeight: "500",
  },
  resetButton: {
    backgroundColor: "#1E88E5",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#1E88E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
    marginBottom: 24,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  backToLogin: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  backToLoginText: {
    fontSize: 15,
    color: "#1E88E5",
    fontWeight: "700",
  },
});

export default ForgotPasswordScreen;

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  // ✅ BỎ TouchableWithoutFeedback
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { authInstance as auth } from "./firebaseConfig";

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

type Props = {
  navigation: LoginScreenNavigationProp;
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ SIMPLIFIED REFS - KHÔNG FOCUS STATE
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert("Lỗi", "Vui lòng nhập email và mật khẩu");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert("Lỗi", "Email không đúng định dạng");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        trimmedPassword
      );

      console.log("✅ Đăng nhập thành công:", userCredential.user.email);

      // Clear form
      setEmail("");
      setPassword("");

      navigation.navigate("Trangchu");
    } catch (error: any) {
      console.error("❌ Lỗi đăng nhập:", error.code);

      const errorMessages: { [key: string]: [string, string] } = {
        "auth/invalid-email": [
          "Email không hợp lệ",
          "Định dạng email không đúng",
        ],
        "auth/user-disabled": ["Tài khoản bị khóa", "Liên hệ hỗ trợ"],
        "auth/user-not-found": [
          "Tài khoản không tồn tại",
          "Đăng ký tài khoản mới",
        ],
        "auth/wrong-password": ["Sai mật khẩu", "Kiểm tra lại mật khẩu"],
        "auth/invalid-credential": [
          "Thông tin sai",
          "Email hoặc mật khẩu không đúng",
        ],
        "auth/network-request-failed": ["Lỗi kết nối", "Kiểm tra internet"],
        "auth/too-many-requests": ["Quá nhiều lần thử", "Thử lại sau 5 phút"],
      };

      const [title, message] = errorMessages[error.code] || [
        "Lỗi đăng nhập",
        "Vui lòng thử lại",
      ];

      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always" // ✅ ALWAYS
        // ✅ BỎ onScrollBeginDrag
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />

          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Icon name="wallet" size={48} color="#fff" />
            </View>
          </View>

          <Text style={styles.title}>Chào mừng trở lại!</Text>
          <Text style={styles.subtitle}>
            Đăng nhập để tiếp tục quản lý chi tiêu
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {/* Email Input - ULTRA SIMPLE */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputContainer}>
              <Icon name="email-outline" size={22} color="#9E9E9E" />
              <TextInput
                ref={emailRef}
                placeholder="Nhập email của bạn"
                style={styles.input}
                placeholderTextColor="#BDBDBD"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                // ✅ BỎ onFocus/onBlur
              />
            </View>
          </View>

          {/* Password Input - ULTRA SIMPLE */}
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Mật khẩu</Text>
            <View style={styles.inputContainer}>
              <Icon name="lock-outline" size={22} color="#9E9E9E" />
              <TextInput
                ref={passwordRef}
                placeholder="Nhập mật khẩu"
                style={styles.input}
                secureTextEntry={!showPassword}
                placeholderTextColor="#BDBDBD"
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                // ✅ BỎ onFocus/onBlur
              />
              <TouchableOpacity
                onPress={() => !loading && setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                disabled={loading}
              >
                <Icon
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="#9E9E9E"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            disabled={loading}
            onPress={() => navigation.navigate("ForgotPassword")}
          >
            <Text style={styles.forgotPassword}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loginButtonText}>Đang đăng nhập...</Text>
              </>
            ) : (
              <>
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
                <Icon name="arrow-right" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {/* Sign Up */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Chưa có tài khoản? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Signup")}
              disabled={loading}
            >
              <Text style={styles.signUpLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ✅ SIMPLIFIED STYLES - KHÔNG FOCUS EFFECTS
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    backgroundColor: "#930f2aff",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    position: "relative",
    overflow: "hidden",
  },
  decorativeCircle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    top: -50,
    right: -50,
  },
  decorativeCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    top: 120,
    left: -40,
  },
  decorativeCircle3: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    bottom: 20,
    right: 30,
  },
  logoContainer: {
    alignItems: "center",
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
  eyeIcon: {
    padding: 4,
  },
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPassword: {
    color: "#1E88E5",
    fontSize: 14,
    fontWeight: "600",
  },
  loginButton: {
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
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    fontSize: 15,
    color: "#757575",
    fontWeight: "400",
  },
  signUpLink: {
    fontSize: 15,
    color: "#1E88E5",
    fontWeight: "700",
  },
});

export default LoginScreen;

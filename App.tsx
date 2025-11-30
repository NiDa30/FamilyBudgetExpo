import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { authInstance as auth } from "./src/firebaseConfig";

import Bieudo from "./src/Bieudo";
import Doimatkhau from "./src/Doimatkhau";
import ForgotPasswordScreen from "./src/ForgotPassword";
import Home from "./src/Home";
import Login from "./src/Login";
import NhapGiaoDich from "./src/Nhap";
import Nhappl from "./src/Nhappl";
import Quethoadon from "./src/Quethoadon";
import Saoluu from "./src/Saoluu";
import Setting from "./src/Setting";
import Signup from "./src/Signup";
import Thongbao from "./src/Thongbao";
import Thongtintaikhoan from "./src/Thongtintaikhoan";
import Timkiem from "./src/Timkiem";
import Trangchu from "./src/Trangchu";
import TuyChinhMauSac from "./src/TuyChinhMauSac";
import Veungdung from "./src/Veungdung";
import XuatExcel from "./src/XuatExcel";
import { ThemeProvider } from "./src/context/ThemeContext";
import { SharedDataProvider } from "./src/context/SharedDataContext";
import BudgetDashboardScreen from "./src/screens/Trangchu/BudgetDashboardScreen";
import NotificationSettingsScreen from "./src/screens/notification/NotificationSettings";
import BudgetSetupScreen from "./src/screens/budget/BudgetSetupScreen";

export type RootStackParamList = {
  Trangchu: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  QuenMatKhau: undefined;
  Home: { newCategory?: Category; updatedCategories?: Category[] } | undefined;
  Nhappl: undefined;
  Nhap:
    | { selectedCategory?: Category; transactionType?: "expense" | "income" }
    | undefined;
  Bieudo: undefined;
  Setting: undefined;
  Timkiem: undefined;
  AddTransaction: undefined;
  Quethoadon: undefined;
  Saoluu: undefined;
  Doimatkhau: undefined;
  Thongbao: undefined;
  Thongtintaikhoan: undefined;
  TuyChinhMauSac: undefined;
  Veungdung: undefined;
  XuatExcel: undefined;
  BudgetDashboard: undefined;
  NotificationSettings: undefined;
  BudgetSetup: undefined;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // ✅ アプリ起動時に認証状態をチェック
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("✅ User is authenticated:", user.email);
        setIsAuthenticated(true);
      } else {
        console.log("ℹ️ User is not authenticated");
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    // クリーンアップ
    return () => unsubscribe();
  }, []);

  // ローディング中はスプラッシュ画面を表示
  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SharedDataProvider>
          <NavigationContainer>
          <Stack.Navigator initialRouteName={isAuthenticated ? "Trangchu" : "Login"}>
            <Stack.Screen
              name="Login"
              component={Login}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Signup"
              component={Signup}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Trangchu"
              component={Trangchu}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Home"
              component={Home}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Nhappl"
              component={Nhappl}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Nhap"
              component={NhapGiaoDich}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Bieudo"
              component={Bieudo}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Setting"
              component={Setting}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Timkiem"
              component={Timkiem}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AddTransaction"
              component={NhapGiaoDich}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Quethoadon"
              component={Quethoadon}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Saoluu"
              component={Saoluu}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Doimatkhau"
              component={Doimatkhau}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Thongbao"
              component={Thongbao}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Thongtintaikhoan"
              component={Thongtintaikhoan}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TuyChinhMauSac"
              component={TuyChinhMauSac}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Veungdung"
              component={Veungdung}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="XuatExcel"
              component={XuatExcel}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BudgetDashboard"
              component={BudgetDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={NotificationSettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BudgetSetup"
              component={BudgetSetupScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
          </NavigationContainer>
        </SharedDataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});

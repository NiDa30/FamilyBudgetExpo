import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
import BudgetDashboardScreen from "./src/screens/Trangchu/BudgetDashboardScreen";

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
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Login">
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
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

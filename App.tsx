// App.js
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, ActivityIndicator, Text, Alert, StyleSheet } from "react-native";

// Import Database Services
import DatabaseService from "./src/database/databaseService";
import SyncEngine from "./src/service/sync/SyncEngine";

import Bieudo from "./src/Bieudo";
import Home from "./src/Home";
import Login from "./src/Login";
import NhapGiaoDich from "./src/Nhap";
import Nhappl from "./src/Nhappl";
import Quethoadon from "./src/Quethoadon";
import Setting from "./src/Setting";
import Signup from "./src/Signup";
import Timkiem from "./src/Timkiem";
import Trangchu from "./src/Trangchu";

export type RootStackParamList = {
  Trangchu: undefined;
  Login: undefined;
  Signup: undefined;
  Home: { newCategory?: Category; updatedCategories?: Category[] } | undefined;
  Nhappl: { userId: string } | undefined;
  Nhap:
    | { selectedCategory?: Category; transactionType?: "expense" | "income" }
    | undefined;
  Bieudo: undefined;
  Setting: undefined;
  Timkiem: undefined;
  Quethoadon: undefined;
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
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log("🚀 Starting app initialization...");

      // 1. Khởi tạo SQLite Database
      console.log("1️⃣ Initializing SQLite Database...");
      await DatabaseService.initialize();
      console.log("✅ SQLite Database initialized successfully");

      // 2. Khởi tạo Sync Engine
      console.log("2️⃣ Initializing Sync Engine...");
      await SyncEngine.initialize();
      console.log("✅ Sync Engine initialized successfully");

      console.log("🎉 App initialization completed");
      setIsReady(true);
    } catch (error: any) {
      console.error("❌ App initialization failed:", error);
      setInitError(error?.message || "Unknown error");
      console.error("Error details:", error);

      Alert.alert(
        "Lỗi Khởi Tạo",
        "Không thể khởi tạo ứng dụng. Vui lòng thử lại.",
        [
          {
            text: "Thử lại",
            onPress: () => {
              setInitError(null);
              initializeApp();
            },
          },
        ]
      );
    }
  };

  // Loading Screen
  if (!isReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Đang khởi tạo ứng dụng...</Text>
          {initError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Lỗi: {initError}</Text>
              <Text style={styles.errorHint}>Đang thử lại...</Text>
            </View>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  // Main App
  return (
    <SafeAreaProvider>
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
            name="Quethoadon"
            component={Quethoadon}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  errorContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#FFE5E5",
    borderRadius: 8,
    maxWidth: "90%",
  },
  errorText: {
    fontSize: 14,
    color: "#D32F2F",
    textAlign: "center",
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});

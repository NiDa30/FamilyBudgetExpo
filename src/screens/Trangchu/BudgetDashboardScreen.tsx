import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../../../App";
import { useTheme } from "../../context/ThemeContext";
import databaseService from "../../database/databaseService";
import { Transaction } from "../../domain/types";
import BudgetDashboard from "./components/Budget/BudgetDashboard";

type BudgetDashboardScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "BudgetDashboard"
>;

const BudgetDashboardScreen = () => {
  const navigation = useNavigation<BudgetDashboardScreenNavigationProp>();
  const { themeColor } = useTheme();
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Initialize database
      await databaseService.initialize();

      // Get current user (simplified for now)
      // In a real implementation, you would get the actual user ID
      const userId = "current_user_id";

      // Get transactions for the current month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const transactions = await databaseService.getTransactionsByUser(userId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Calculate totals
      let income = 0;
      let expense = 0;

      transactions.forEach((transaction: Transaction) => {
        if (transaction.type === "INCOME") {
          income += transaction.amount;
        } else if (transaction.type === "EXPENSE") {
          expense += transaction.amount;
        }
      });

      setTotalIncome(income);
      setTotalExpense(expense);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gợi ý & Mục tiêu</Text>
          <TouchableOpacity style={styles.moreButton} activeOpacity={0.8}>
            <Icon name="dots-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <BudgetDashboard totalIncome={totalIncome} totalExpense={totalExpense} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
});

export default BudgetDashboardScreen;

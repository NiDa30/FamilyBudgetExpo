// src/screens/budget/BudgetSetupScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { authInstance as auth } from "../../firebaseConfig";
import BudgetService from "../../service/budget/BudgetService";
import { databaseService } from "../../database/databaseService";

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: "INCOME" | "EXPENSE";
}

const BudgetSetupScreen = () => {
  const navigation = useNavigation();
  const { themeColor } = useTheme();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Map<string, number>>(new Map());
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        navigation.goBack();
        return;
      }

      // カテゴリを取得
      await databaseService.ensureInitialized();
      const userCategories = await databaseService.getCategoriesByUser(user.uid);
      const expenseCategories = userCategories.filter(
        (cat: any) => cat.type === "EXPENSE"
      );
      setCategories(expenseCategories);

      // 既存の予算を取得
      const existingBudgets = await BudgetService.getBudgetsByMonth(monthYear);
      const budgetMap = new Map<string, number>();
      existingBudgets.forEach((budget) => {
        budgetMap.set(budget.categoryId, budget.budgetAmount);
      });
      setBudgets(budgetMap);
    } catch (error) {
      console.error("Error loading budget data:", error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu ngân sách");
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetChange = (categoryId: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    const newBudgets = new Map(budgets);
    if (numAmount > 0) {
      newBudgets.set(categoryId, numAmount);
    } else {
      newBudgets.delete(categoryId);
    }
    setBudgets(newBudgets);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      // 各カテゴリの予算を保存
      for (const [categoryId, amount] of budgets.entries()) {
        await BudgetService.createOrUpdateBudget(categoryId, amount, monthYear, 80);
      }

      Alert.alert("Thành công", "Đã lưu ngân sách thành công", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error saving budgets:", error);
      Alert.alert("Lỗi", "Không thể lưu ngân sách");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (templateName: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // ユーザーの月次収入を取得（簡略化のため、固定値を使用）
      // 実際の実装では、ユーザー設定から取得
      const monthlyIncome = 10000000; // 仮の値

      if (templateName === "50-30-20") {
        const suggestion = await BudgetService.suggestBudgetByRule(monthlyIncome, monthYear);
        Alert.alert(
          "Gợi ý ngân sách",
          `Nhu cầu: ${suggestion.needs.toLocaleString("vi-VN")}₫\nMong muốn: ${suggestion.wants.toLocaleString("vi-VN")}₫\nTiết kiệm: ${suggestion.savings.toLocaleString("vi-VN")}₫`,
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error applying template:", error);
    }
  };

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString("vi-VN") + "₫";
  };

  if (loading && categories.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={themeColor} />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thiết lập Ngân sách</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Lưu</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* テンプレート選択 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mẫu ngân sách</Text>
          <TouchableOpacity
            style={[styles.templateButton, { borderColor: themeColor }]}
            onPress={() => handleApplyTemplate("50-30-20")}
          >
            <Icon name="lightbulb-on" size={20} color={themeColor} />
            <Text style={[styles.templateButtonText, { color: themeColor }]}>
              Quy tắc 50/30/20
            </Text>
          </TouchableOpacity>
        </View>

        {/* カテゴリ別予算設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ngân sách theo danh mục</Text>
          {categories.map((category) => (
            <View key={category.id} style={styles.budgetItem}>
              <View style={styles.categoryInfo}>
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: (category.color || themeColor) + "20" },
                  ]}
                >
                  <Icon
                    name={category.icon || "tag"}
                    size={20}
                    color={category.color || themeColor}
                  />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
              </View>
              <TextInput
                style={styles.budgetInput}
                placeholder="0"
                keyboardType="numeric"
                value={budgets.get(category.id)?.toString() || ""}
                onChangeText={(text) => handleBudgetChange(category.id, text)}
                placeholderTextColor="#BDBDBD"
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#757575",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 8,
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 12,
  },
  templateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  templateButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  budgetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#212121",
  },
  budgetInput: {
    width: 120,
    height: 40,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    textAlign: "right",
  },
});

export default BudgetSetupScreen;


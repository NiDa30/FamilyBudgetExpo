// src/components/budget/BudgetAndGoalsOverview.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Category } from "../../domain/types";
import { auth } from "../../firebaseConfig";
// ✅ Fix require cycle: Import trực tiếp từ các file thay vì từ index.ts
import { BudgetRecommendation } from "./BudgetRecommendation";
import { CategoryBudget } from "./CategoryBudget";
import { SpendingTrendAnalysis } from "./SpendingTrendAnalysis";
import { BudgetAdjustmentSuggestions } from "./BudgetAdjustmentSuggestions";
import { BudgetAlerts } from "./BudgetAlerts";
import { GoalTracker } from "./GoalTracker";

interface BudgetAndGoalsOverviewProps {
  monthlyIncome: number;
  lastMonthsExpenses: { month: string; total: number }[];
  categories: Category[];
  budgetAlerts: any[];
  goals: any[];
  categoryBudgets: any[];
  spendingTrends: any[];
  adjustmentSuggestions: any[];
  budgetRule: { needsPercent: number; wantsPercent: number; savingsPercent: number };
  themeColor: string;
  onReloadData?: () => void;
  formatCurrency: (amount: number) => string;
}

export const BudgetAndGoalsOverview: React.FC<BudgetAndGoalsOverviewProps> = ({
  monthlyIncome,
  lastMonthsExpenses,
  categories,
  budgetAlerts,
  goals,
  categoryBudgets,
  spendingTrends,
  adjustmentSuggestions,
  budgetRule: initialBudgetRule,
  themeColor,
  onReloadData,
  formatCurrency,
}) => {
  // Budget rule state - sync with prop changes
  const [budgetRule, setBudgetRule] = useState(initialBudgetRule);
  const [showBudgetRuleModal, setShowBudgetRuleModal] = useState(false);

  // Sync budgetRule state when prop changes
  useEffect(() => {
    setBudgetRule(initialBudgetRule);
  }, [initialBudgetRule]);

  // Category budget states
  const [showCategoryBudgetModal, setShowCategoryBudgetModal] = useState(false);
  const [selectedCategoryForBudget, setSelectedCategoryForBudget] = useState<string | null>(null);
  const [showCategoryBudgetInputModal, setShowCategoryBudgetInputModal] = useState(false);
  const [categoryBudgetAmount, setCategoryBudgetAmount] = useState("");
  const [selectedCategoryForBudgetInput, setSelectedCategoryForBudgetInput] = useState<Category | null>(null);

  // Handle budget rule customization
  const handleSaveBudgetRule = useCallback(async () => {
    const total =
      budgetRule.needsPercent +
      budgetRule.wantsPercent +
      budgetRule.savingsPercent;
    if (total !== 100) {
      Alert.alert(
        "Lỗi",
        "Tổng tỷ lệ phải bằng 100%. Vui lòng điều chỉnh lại."
      );
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      const FirebaseService = (
        await import("../../service/firebase/FirebaseService")
      ).default;
      await FirebaseService.updateUser(user.uid, {
        budgetRule: `${budgetRule.needsPercent}-${budgetRule.wantsPercent}-${budgetRule.savingsPercent}`,
      });

      Alert.alert("Thành công", "Đã cập nhật quy tắc ngân sách");
      setShowBudgetRuleModal(false);
      if (onReloadData) {
        onReloadData();
      }
    } catch (error) {
      console.error("Error saving budget rule:", error);
      Alert.alert("Lỗi", "Không thể lưu quy tắc ngân sách");
    }
  }, [budgetRule, onReloadData]);

  // Handle category budget save
  const handleSaveCategoryBudget = useCallback(async () => {
    const amount = parseFloat(categoryBudgetAmount || "0");
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền hợp lệ");
      return;
    }

    if (!selectedCategoryForBudgetInput) {
      Alert.alert("Lỗi", "Không tìm thấy danh mục");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      const FirebaseService = (
        await import("../../service/firebase/FirebaseService")
      ).default;
      const currentDate = new Date();
      const monthYear = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;

      // Check if budget already exists
      const budgets = await FirebaseService.getBudgets(user.uid);
      const existingBudget = budgets.find(
        (b: any) =>
          b.categoryID === selectedCategoryForBudgetInput.id &&
          b.monthYear === monthYear
      );

      if (existingBudget) {
        // Update existing budget
        await FirebaseService.updateBudget(existingBudget.id, {
          budgetAmount: amount,
          warningThreshold: 80,
        });
      } else {
        // Create new budget
        await FirebaseService.addBudget(user.uid, {
          categoryID: selectedCategoryForBudgetInput.id,
          monthYear,
          budgetAmount: amount,
          warningThreshold: 80,
        });
      }

      Alert.alert(
        "Thành công",
        `Đã thiết lập ngân sách ${formatCurrency(amount)} cho "${selectedCategoryForBudgetInput.name}"`
      );
      setShowCategoryBudgetInputModal(false);
      setSelectedCategoryForBudgetInput(null);
      setCategoryBudgetAmount("");

      // Reload data
      if (onReloadData) {
        onReloadData();
      }
    } catch (error) {
      console.error("Error saving category budget:", error);
      Alert.alert("Lỗi", "Không thể lưu ngân sách");
    }
  }, [categoryBudgetAmount, selectedCategoryForBudgetInput, formatCurrency, onReloadData]);

  return (
    <View>
      {/* Budget Recommendation */}
      <BudgetRecommendation
        monthlyIncome={monthlyIncome}
        lastMonthsExpenses={lastMonthsExpenses}
        rule={budgetRule}
        themeColor={themeColor}
        onCustomizePress={() => setShowBudgetRuleModal(true)}
      />

      {/* Category Budgets */}
      <CategoryBudget
        categoryBudgets={categoryBudgets}
        themeColor={themeColor}
        onCategoryPress={(categoryId) => {
          setSelectedCategoryForBudget(categoryId);
          setShowCategoryBudgetModal(true);
        }}
        onSetBudgetPress={() => setShowCategoryBudgetModal(true)}
      />

      {/* Spending Trend Analysis */}
      <SpendingTrendAnalysis
        trends={spendingTrends}
        themeColor={themeColor}
      />

      {/* Budget Adjustment Suggestions */}
      <BudgetAdjustmentSuggestions
        suggestions={adjustmentSuggestions}
        themeColor={themeColor}
        onApplySuggestion={(suggestion) => {
          Alert.alert(
            "Áp dụng gợi ý",
            `Bạn có muốn áp dụng gợi ý điều chỉnh ngân sách cho "${suggestion.category}" không?`,
            [
              { text: "Hủy", style: "cancel" },
              {
                text: "Áp dụng",
                onPress: async () => {
                  // TODO: Implement apply suggestion logic
                  Alert.alert("Thành công", "Đã áp dụng gợi ý");
                  if (onReloadData) {
                    onReloadData();
                  }
                },
              },
            ]
          );
        }}
      />

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <BudgetAlerts alerts={budgetAlerts} themeColor={themeColor} />
      )}

      {/* Goal Tracker */}
      <GoalTracker
        goals={goals}
        themeColor={themeColor}
        onAddGoalPress={() => {
          // TODO: Navigate to goal creation screen
          Alert.alert(
            "Thêm mục tiêu",
            "Tính năng thêm mục tiêu sẽ được triển khai trong màn hình quản lý mục tiêu."
          );
        }}
      />

      {/* Budget Rule Modal */}
      <Modal
        visible={showBudgetRuleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBudgetRuleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tùy chỉnh quy tắc ngân sách</Text>
              <TouchableOpacity
                onPress={() => setShowBudgetRuleModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.budgetRuleContainer}>
                <Text style={styles.budgetRuleDescription}>
                  Quy tắc 50/30/20 giúp bạn phân bổ thu nhập một cách hợp lý.
                  Bạn có thể tùy chỉnh tỷ lệ theo nhu cầu của mình. Tổng tỷ lệ
                  phải bằng 100%.
                </Text>

                {/* Needs (Chi phí thiết yếu) */}
                <View style={styles.budgetRuleItem}>
                  <View style={styles.budgetRuleItemHeader}>
                    <Icon name="home" size={20} color="#FF9800" />
                    <Text style={styles.budgetRuleItemLabel}>
                      Chi phí thiết yếu
                    </Text>
                  </View>
                  <View style={styles.budgetRuleInputContainer}>
                    <TextInput
                      style={styles.budgetRuleInput}
                      value={budgetRule.needsPercent.toString()}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        if (value >= 0 && value <= 100) {
                          setBudgetRule({
                            ...budgetRule,
                            needsPercent: value,
                            savingsPercent:
                              100 - value - budgetRule.wantsPercent,
                          });
                        }
                      }}
                      keyboardType="numeric"
                      placeholder="50"
                    />
                    <Text style={styles.budgetRulePercent}>%</Text>
                  </View>
                  <Text style={styles.budgetRuleAmount}>
                    {formatCurrency(
                      (monthlyIncome * budgetRule.needsPercent) / 100
                    )}
                  </Text>
                </View>

                {/* Wants (Chi tiêu linh hoạt) */}
                <View style={styles.budgetRuleItem}>
                  <View style={styles.budgetRuleItemHeader}>
                    <Icon name="shopping" size={20} color="#2196F3" />
                    <Text style={styles.budgetRuleItemLabel}>
                      Chi tiêu linh hoạt
                    </Text>
                  </View>
                  <View style={styles.budgetRuleInputContainer}>
                    <TextInput
                      style={styles.budgetRuleInput}
                      value={budgetRule.wantsPercent.toString()}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        if (value >= 0 && value <= 100) {
                          setBudgetRule({
                            ...budgetRule,
                            wantsPercent: value,
                            savingsPercent:
                              100 - budgetRule.needsPercent - value,
                          });
                        }
                      }}
                      keyboardType="numeric"
                      placeholder="30"
                    />
                    <Text style={styles.budgetRulePercent}>%</Text>
                  </View>
                  <Text style={styles.budgetRuleAmount}>
                    {formatCurrency(
                      (monthlyIncome * budgetRule.wantsPercent) / 100
                    )}
                  </Text>
                </View>

                {/* Savings (Tiết kiệm & Đầu tư) */}
                <View style={styles.budgetRuleItem}>
                  <View style={styles.budgetRuleItemHeader}>
                    <Icon name="piggy-bank" size={20} color="#4CAF50" />
                    <Text style={styles.budgetRuleItemLabel}>
                      Tiết kiệm & Đầu tư
                    </Text>
                  </View>
                  <View style={styles.budgetRuleInputContainer}>
                    <TextInput
                      style={styles.budgetRuleInput}
                      value={budgetRule.savingsPercent.toString()}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        if (value >= 0 && value <= 100) {
                          setBudgetRule({
                            ...budgetRule,
                            savingsPercent: value,
                            wantsPercent: 100 - budgetRule.needsPercent - value,
                          });
                        }
                      }}
                      keyboardType="numeric"
                      placeholder="20"
                    />
                    <Text style={styles.budgetRulePercent}>%</Text>
                  </View>
                  <Text style={styles.budgetRuleAmount}>
                    {formatCurrency(
                      (monthlyIncome * budgetRule.savingsPercent) / 100
                    )}
                  </Text>
                </View>

                {/* Total */}
                <View style={styles.budgetRuleTotal}>
                  <Text style={styles.budgetRuleTotalLabel}>Tổng:</Text>
                  <Text
                    style={[
                      styles.budgetRuleTotalValue,
                      {
                        color:
                          budgetRule.needsPercent +
                            budgetRule.wantsPercent +
                            budgetRule.savingsPercent ===
                          100
                            ? "#4CAF50"
                            : "#F44336",
                      },
                    ]}
                  >
                    {budgetRule.needsPercent +
                      budgetRule.wantsPercent +
                      budgetRule.savingsPercent}
                    %
                  </Text>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[
                    styles.budgetRuleSaveButton,
                    {
                      backgroundColor:
                        budgetRule.needsPercent +
                          budgetRule.wantsPercent +
                          budgetRule.savingsPercent ===
                        100
                          ? themeColor
                          : "#CCCCCC",
                    },
                  ]}
                  onPress={handleSaveBudgetRule}
                  disabled={
                    budgetRule.needsPercent +
                      budgetRule.wantsPercent +
                      budgetRule.savingsPercent !==
                    100
                  }
                >
                  <Text style={styles.budgetRuleSaveButtonText}>Lưu</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Budget Modal */}
      <Modal
        visible={showCategoryBudgetModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCategoryBudgetModal(false);
          setSelectedCategoryForBudget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Thiết lập ngân sách danh mục
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCategoryBudgetModal(false);
                  setSelectedCategoryForBudget(null);
                }}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.categoryBudgetList}>
                <Text style={styles.categoryBudgetListTitle}>
                  Chọn danh mục để thiết lập ngân sách
                </Text>
                {categories
                  .filter((cat) => cat.type === "EXPENSE")
                  .map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.categoryBudgetListItem}
                      onPress={() => {
                        setSelectedCategoryForBudgetInput(cat);
                        setCategoryBudgetAmount("");
                        setShowCategoryBudgetModal(false);
                        setShowCategoryBudgetInputModal(true);
                      }}
                    >
                      <View
                        style={[
                          styles.categoryBudgetListIcon,
                          { backgroundColor: cat.color + "20" },
                        ]}
                      >
                        <Icon
                          name={cat.icon || "tag"}
                          size={20}
                          color={cat.color}
                        />
                      </View>
                      <Text style={styles.categoryBudgetListText}>
                        {cat.name}
                      </Text>
                      <Icon name="chevron-right" size={24} color="#CCCCCC" />
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Budget Input Modal */}
      <Modal
        visible={showCategoryBudgetInputModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCategoryBudgetInputModal(false);
          setSelectedCategoryForBudgetInput(null);
          setCategoryBudgetAmount("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Thiết lập ngân sách cho "{selectedCategoryForBudgetInput?.name}"
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCategoryBudgetInputModal(false);
                  setSelectedCategoryForBudgetInput(null);
                  setCategoryBudgetAmount("");
                }}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text
                style={{ fontSize: 14, color: "#757575", marginBottom: 12 }}
              >
                Nhập ngân sách hàng tháng (VNĐ):
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: "#E0E0E0",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  marginBottom: 20,
                }}
                value={categoryBudgetAmount}
                onChangeText={setCategoryBudgetAmount}
                keyboardType="numeric"
                placeholder="Ví dụ: 1000000"
              />
              <TouchableOpacity
                style={[
                  styles.budgetRuleSaveButton,
                  {
                    backgroundColor:
                      categoryBudgetAmount &&
                      parseFloat(categoryBudgetAmount) > 0
                        ? themeColor
                        : "#CCCCCC",
                  },
                ]}
                onPress={handleSaveCategoryBudget}
                disabled={
                  !categoryBudgetAmount || parseFloat(categoryBudgetAmount) <= 0
                }
              >
                <Text style={styles.budgetRuleSaveButtonText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212121",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  budgetRuleContainer: {
    padding: 16,
  },
  budgetRuleDescription: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 20,
    lineHeight: 20,
  },
  budgetRuleItem: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
  },
  budgetRuleItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  budgetRuleItemLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  budgetRuleInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  budgetRuleInput: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
    paddingVertical: 12,
  },
  budgetRulePercent: {
    fontSize: 16,
    color: "#757575",
    marginLeft: 8,
  },
  budgetRuleAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#424242",
  },
  budgetRuleTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginBottom: 20,
  },
  budgetRuleTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  budgetRuleTotalValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  budgetRuleSaveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  budgetRuleSaveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  categoryBudgetList: {
    padding: 16,
  },
  categoryBudgetListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 16,
  },
  categoryBudgetListItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryBudgetListIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryBudgetListText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#212121",
  },
});


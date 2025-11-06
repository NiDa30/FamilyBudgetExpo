import { StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface BudgetSuggestionProps {
  totalIncome: number;
  totalExpense: number;
}

const BudgetSuggestion = ({
  totalIncome,
  totalExpense,
}: BudgetSuggestionProps) => {
  // Calculate 50/30/20 budget suggestion
  const essentialBudget = totalIncome * 0.5; // 50% for essentials
  const flexibleBudget = totalIncome * 0.3; // 30% for flexible spending
  const savingsBudget = totalIncome * 0.2; // 20% for savings

  // Calculate actual spending in each category (simplified)
  const essentialSpent = totalExpense * 0.5; // Simplified calculation
  const flexibleSpent = totalExpense * 0.3; // Simplified calculation
  const savingsSpent = 0; // Savings aren't "spent"

  // Calculate percentages for progress bars
  const essentialPercentage =
    essentialBudget > 0
      ? Math.min((essentialSpent / essentialBudget) * 100, 100)
      : 0;
  const flexiblePercentage =
    flexibleBudget > 0
      ? Math.min((flexibleSpent / flexibleBudget) * 100, 100)
      : 0;
  const savingsPercentage =
    savingsBudget > 0
      ? Math.min(
          ((savingsBudget - (savingsBudget - 0)) / savingsBudget) * 100,
          100
        )
      : 0;

  // Check if spending exceeds budget
  const isEssentialOverBudget = essentialSpent > essentialBudget;
  const isFlexibleOverBudget = flexibleSpent > flexibleBudget;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gợi ý ngân sách</Text>
        <Text style={styles.subtitle}>Theo quy tắc 50/30/20</Text>
      </View>

      {/* Essentials (50%) */}
      <View style={styles.budgetItem}>
        <View style={styles.itemHeader}>
          <View style={styles.iconContainer}>
            <Icon name="home" size={20} color="#fff" />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>Thiết yếu</Text>
            <Text style={styles.itemSubtitle}>50% thu nhập</Text>
          </View>
          <Text style={styles.itemAmount}>
            {essentialBudget.toLocaleString("vi-VN")}₫
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${essentialPercentage}%`,
                backgroundColor: isEssentialOverBudget ? "#F44336" : "#4CAF50",
              },
            ]}
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Đã chi: {essentialSpent.toLocaleString("vi-VN")}₫
          </Text>
          <Text style={styles.progressText}>
            {essentialPercentage.toFixed(0)}%
          </Text>
        </View>
        {isEssentialOverBudget && (
          <View style={styles.warningContainer}>
            <Icon name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.warningText}>Vượt ngân sách!</Text>
          </View>
        )}
      </View>

      {/* Flexible (30%) */}
      <View style={styles.budgetItem}>
        <View style={styles.itemHeader}>
          <View style={[styles.iconContainer, { backgroundColor: "#FF9800" }]}>
            <Icon name="gamepad-variant" size={20} color="#fff" />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>Linh hoạt</Text>
            <Text style={styles.itemSubtitle}>30% thu nhập</Text>
          </View>
          <Text style={styles.itemAmount}>
            {flexibleBudget.toLocaleString("vi-VN")}₫
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${flexiblePercentage}%`,
                backgroundColor: isFlexibleOverBudget ? "#F44336" : "#2196F3",
              },
            ]}
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Đã chi: {flexibleSpent.toLocaleString("vi-VN")}₫
          </Text>
          <Text style={styles.progressText}>
            {flexiblePercentage.toFixed(0)}%
          </Text>
        </View>
        {isFlexibleOverBudget && (
          <View style={styles.warningContainer}>
            <Icon name="alert-circle" size={16} color="#F44336" />
            <Text style={styles.warningText}>Vượt ngân sách!</Text>
          </View>
        )}
      </View>

      {/* Savings (20%) */}
      <View style={styles.budgetItem}>
        <View style={styles.itemHeader}>
          <View style={[styles.iconContainer, { backgroundColor: "#9C27B0" }]}>
            <Icon name="piggy-bank" size={20} color="#fff" />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>Tiết kiệm</Text>
            <Text style={styles.itemSubtitle}>20% thu nhập</Text>
          </View>
          <Text style={styles.itemAmount}>
            {savingsBudget.toLocaleString("vi-VN")}₫
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${savingsPercentage}%`,
                backgroundColor: "#9C27B0",
              },
            ]}
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Đã tiết kiệm:{" "}
            {(savingsBudget - savingsSpent).toLocaleString("vi-VN")}₫
          </Text>
          <Text style={styles.progressText}>
            {savingsPercentage.toFixed(0)}%
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#757575",
  },
  budgetItem: {
    marginBottom: 20,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 13,
    color: "#9E9E9E",
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#EEEEEE",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4CAF50",
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressText: {
    fontSize: 13,
    color: "#757575",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  warningText: {
    fontSize: 13,
    color: "#F44336",
    marginLeft: 4,
    fontWeight: "500",
  },
});

export default BudgetSuggestion;

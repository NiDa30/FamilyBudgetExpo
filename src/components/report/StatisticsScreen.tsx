import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface StatisticsScreenProps {
  expenseCategories: Array<{
    categoryName: string;
    amount: number;
    percentage: number;
    color: string;
    icon: string;
  }>;
  monthlyComparison: Array<{
    period: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  formatCurrency: (amount: number) => string;
}

export const StatisticsScreen: React.FC<StatisticsScreenProps> = ({
  expenseCategories,
  monthlyComparison,
  formatCurrency,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Category Statistics */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Thống kê Chi tiêu theo Danh mục</Text>
        {expenseCategories.length > 0 ? (
          expenseCategories.map((cat, index) => (
            <View key={index} style={styles.statItem}>
              <View style={styles.statItemLeft}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: cat.color || "#FF6B6B" },
                  ]}
                >
                  <Icon name={cat.icon || "tag"} size={20} color="#fff" />
                </View>
                <View style={styles.statInfo}>
                  <Text style={styles.statName}>{cat.categoryName}</Text>
                  <Text style={styles.statPercentage}>
                    {cat.percentage.toFixed(1)}% tổng chi tiêu
                  </Text>
                </View>
              </View>
              <Text style={styles.statAmount}>
                {formatCurrency(cat.amount)}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Icon name="chart-bar" size={48} color="#E0E0E0" />
            <Text style={styles.emptyStateText}>Chưa có dữ liệu</Text>
          </View>
        )}
      </View>

      {/* Monthly Summary */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Tóm tắt theo Tháng</Text>
        {monthlyComparison.length > 0 ? (
          monthlyComparison.map((month, index) => (
            <View key={index} style={styles.monthSummaryItem}>
              <Text style={styles.monthLabel}>{month.period}</Text>
              <View style={styles.monthDetails}>
                <View style={styles.monthDetailRow}>
                  <Text style={styles.monthDetailLabel}>Thu nhập:</Text>
                  <Text
                    style={[
                      styles.monthDetailValue,
                      { color: "#4CAF50" },
                    ]}
                  >
                    {formatCurrency(month.income)}
                  </Text>
                </View>
                <View style={styles.monthDetailRow}>
                  <Text style={styles.monthDetailLabel}>Chi tiêu:</Text>
                  <Text
                    style={[
                      styles.monthDetailValue,
                      { color: "#F44336" },
                    ]}
                  >
                    {formatCurrency(month.expense)}
                  </Text>
                </View>
                <View style={styles.monthDetailRow}>
                  <Text style={styles.monthDetailLabel}>Số dư:</Text>
                  <Text
                    style={[
                      styles.monthDetailValue,
                      {
                        color: month.balance >= 0 ? "#1E88E5" : "#F44336",
                      },
                    ]}
                  >
                    {month.balance >= 0 ? "+" : ""}
                    {formatCurrency(Math.abs(month.balance))}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Icon name="calendar" size={48} color="#E0E0E0" />
            <Text style={styles.emptyStateText}>Chưa có dữ liệu</Text>
          </View>
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
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
  statsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 8,
  },
  statItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 2,
  },
  statPercentage: {
    fontSize: 12,
    color: "#757575",
  },
  statAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#424242",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9E9E9E",
    marginTop: 12,
  },
  monthSummaryItem: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 12,
  },
  monthDetails: {
    gap: 8,
  },
  monthDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthDetailLabel: {
    fontSize: 14,
    color: "#757575",
  },
  monthDetailValue: {
    fontSize: 15,
    fontWeight: "700",
  },
});


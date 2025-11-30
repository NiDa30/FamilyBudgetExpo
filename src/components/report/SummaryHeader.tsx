import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface SummaryHeaderProps {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  formatCurrency: (amount: number) => string;
}

export const SummaryHeader: React.FC<SummaryHeaderProps> = ({
  totalIncome,
  totalExpense,
  balance,
  formatCurrency,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Tổng chi tiêu */}
        <View style={[styles.item, styles.expenseItem]}>
          <Icon name="arrow-up" size={18} color="#F44336" />
          <View style={styles.itemContent}>
            <Text style={styles.label}>Chi tiêu</Text>
            <Text style={[styles.amount, styles.expenseAmount]}>
              {formatCurrency(totalExpense)}
            </Text>
          </View>
        </View>

        {/* Tổng thu nhập */}
        <View style={[styles.item, styles.incomeItem]}>
          <Icon name="arrow-down" size={18} color="#4CAF50" />
          <View style={styles.itemContent}>
            <Text style={styles.label}>Thu nhập</Text>
            <Text style={[styles.amount, styles.incomeAmount]}>
              {formatCurrency(totalIncome)}
            </Text>
          </View>
        </View>

        {/* Số dư */}
        <View
          style={[
            styles.item,
            styles.balanceItem,
            balance >= 0 ? styles.balancePositive : styles.balanceNegative,
          ]}
        >
          <Icon
            name="wallet"
            size={18}
            color={balance >= 0 ? "#1E88E5" : "#F44336"}
          />
          <View style={styles.itemContent}>
            <Text style={styles.label}>Số dư</Text>
            <Text
              style={[
                styles.amount,
                {
                  color: balance >= 0 ? "#1E88E5" : "#F44336",
                },
              ]}
            >
              {balance >= 0 ? "+" : ""}
              {formatCurrency(Math.abs(balance))}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    padding: 10,
    borderRadius: 12,
    gap: 8,
  },
  expenseItem: {
    backgroundColor: "rgba(244, 67, 54, 0.05)",
  },
  incomeItem: {
    backgroundColor: "rgba(76, 175, 80, 0.05)",
  },
  balanceItem: {
    backgroundColor: "rgba(33, 150, 243, 0.05)",
  },
  balancePositive: {
    backgroundColor: "rgba(33, 150, 243, 0.05)",
  },
  balanceNegative: {
    backgroundColor: "rgba(244, 67, 54, 0.05)",
  },
  itemContent: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: "#757575",
    marginBottom: 2,
    fontWeight: "500",
  },
  amount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#212121",
  },
  expenseAmount: {
    color: "#F44336",
  },
  incomeAmount: {
    color: "#4CAF50",
  },
});


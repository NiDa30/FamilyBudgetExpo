// src/components/budget/BudgetRecommendation.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { suggestByRule, RuleConfig, SpendSummary } from "../../utils/budgetRules";

interface BudgetRecommendationProps {
  monthlyIncome: number;
  lastMonthsExpenses: { month: string; total: number }[];
  rule?: RuleConfig;
  themeColor?: string;
  onCustomizePress?: () => void;
}

export const BudgetRecommendation: React.FC<BudgetRecommendationProps> = ({
  monthlyIncome,
  lastMonthsExpenses,
  rule = { needsPercent: 50, wantsPercent: 30, savingsPercent: 20 },
  themeColor = "#1E88E5",
  onCustomizePress,
}) => {
  const summary: SpendSummary = {
    monthlyIncome,
    lastMonthsExpenses,
  };

  const suggestion = suggestByRule(summary, rule);

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrapper, { backgroundColor: `${themeColor}15` }]}>
            <Icon name="lightbulb-on" size={24} color={themeColor} />
          </View>
          <View>
            <Text style={styles.title}>Gợi ý Ngân sách</Text>
            <Text style={styles.subtitle}>Quy tắc {rule.needsPercent}/{rule.wantsPercent}/{rule.savingsPercent}</Text>
          </View>
        </View>
        {onCustomizePress && (
          <TouchableOpacity onPress={onCustomizePress} style={styles.customizeButton}>
            <Icon name="tune" size={20} color={themeColor} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.budgetCards}>
        <View style={[styles.budgetCard, { borderLeftColor: "#4CAF50" }]}>
          <View style={styles.budgetCardHeader}>
            <Icon name="home" size={20} color="#4CAF50" />
            <Text style={styles.budgetCardTitle}>Nhu cầu thiết yếu</Text>
          </View>
          <Text style={[styles.budgetCardAmount, { color: "#4CAF50" }]}>
            {formatCurrency(suggestion.limits.NEEDS)}
          </Text>
          <Text style={styles.budgetCardPercent}>{rule.needsPercent}% thu nhập</Text>
        </View>

        <View style={[styles.budgetCard, { borderLeftColor: "#FF9800" }]}>
          <View style={styles.budgetCardHeader}>
            <Icon name="shopping" size={20} color="#FF9800" />
            <Text style={styles.budgetCardTitle}>Chi tiêu linh hoạt</Text>
          </View>
          <Text style={[styles.budgetCardAmount, { color: "#FF9800" }]}>
            {formatCurrency(suggestion.limits.WANTS)}
          </Text>
          <Text style={styles.budgetCardPercent}>{rule.wantsPercent}% thu nhập</Text>
        </View>

        <View style={[styles.budgetCard, { borderLeftColor: "#2196F3" }]}>
          <View style={styles.budgetCardHeader}>
            <Icon name="piggy-bank" size={20} color="#2196F3" />
            <Text style={styles.budgetCardTitle}>Tiết kiệm & Đầu tư</Text>
          </View>
          <Text style={[styles.budgetCardAmount, { color: "#2196F3" }]}>
            {formatCurrency(suggestion.limits.SAVINGS)}
          </Text>
          <Text style={styles.budgetCardPercent}>{rule.savingsPercent}% thu nhập</Text>
        </View>
      </View>

      {suggestion.warnings.length > 0 && (
        <View style={styles.warningsContainer}>
          {suggestion.warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Icon name="alert" size={16} color="#FF9800" />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      )}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#757575",
  },
  customizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  budgetCards: {
    gap: 12,
  },
  budgetCard: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  budgetCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  budgetCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#424242",
  },
  budgetCardAmount: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  budgetCardPercent: {
    fontSize: 12,
    color: "#757575",
  },
  warningsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    gap: 8,
  },
  warningItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#E65100",
    lineHeight: 18,
  },
});


// src/components/budget/SpendingTrendAnalysis.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface AdjustmentSuggestion {
  type: "reduce" | "increase" | "reallocate";
  category: string;
  currentAmount: number;
  suggestedAmount: number;
  reason: string;
  impact: "high" | "medium" | "low";
}

interface BudgetAdjustmentSuggestionsProps {
  suggestions: AdjustmentSuggestion[];
  themeColor?: string;
  onApplySuggestion?: (suggestion: AdjustmentSuggestion) => void;
}

export const BudgetAdjustmentSuggestions: React.FC<BudgetAdjustmentSuggestionsProps> = ({
  suggestions,
  themeColor = "#1E88E5",
  onApplySuggestion,
}) => {
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  };

  const getSuggestionIcon = (type: string): string => {
    switch (type) {
      case "reduce":
        return "arrow-down-circle";
      case "increase":
        return "arrow-up-circle";
      default:
        return "swap-horizontal";
    }
  };

  const getSuggestionColor = (type: string): string => {
    switch (type) {
      case "reduce":
        return "#F44336";
      case "increase":
        return "#4CAF50";
      default:
        return "#FF9800";
    }
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case "high":
        return "#F44336";
      case "medium":
        return "#FF9800";
      default:
        return "#4CAF50";
    }
  };

  if (suggestions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: `${themeColor}15` }]}>
            <Icon name="lightbulb-on" size={24} color={themeColor} />
          </View>
          <Text style={styles.title}>Gợi ý Điều chỉnh Ngân sách</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="check-circle-outline" size={48} color="#4CAF50" />
          <Text style={styles.emptyText}>Ngân sách của bạn đang tối ưu!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: `${themeColor}15` }]}>
          <Icon name="lightbulb-on" size={24} color={themeColor} />
        </View>
        <Text style={styles.title}>Gợi ý Điều chỉnh Ngân sách</Text>
      </View>

      <View style={styles.suggestionsList}>
        {suggestions.map((suggestion, index) => {
          const suggestionColor = getSuggestionColor(suggestion.type);
          const impactColor = getImpactColor(suggestion.impact);
          const changeAmount = Math.abs(suggestion.suggestedAmount - suggestion.currentAmount);
          const changePercent =
            suggestion.currentAmount > 0
              ? (changeAmount / suggestion.currentAmount) * 100
              : 0;

          return (
            <View key={index} style={styles.suggestionItem}>
              <View style={styles.suggestionHeader}>
                <View
                  style={[
                    styles.suggestionIcon,
                    { backgroundColor: suggestionColor + "20" },
                  ]}
                >
                  <Icon
                    name={getSuggestionIcon(suggestion.type)}
                    size={20}
                    color={suggestionColor}
                  />
                </View>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
                  <View style={styles.suggestionAmounts}>
                    <Text style={styles.currentAmount}>
                      {formatCurrency(suggestion.currentAmount)}
                    </Text>
                    <Icon name="arrow-right" size={16} color="#757575" />
                    <Text
                      style={[
                        styles.suggestedAmount,
                        { color: suggestionColor },
                      ]}
                    >
                      {formatCurrency(suggestion.suggestedAmount)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.impactBadge,
                    { backgroundColor: impactColor + "20" },
                  ]}
                >
                  <Text style={[styles.impactText, { color: impactColor }]}>
                    {suggestion.impact === "high"
                      ? "Cao"
                      : suggestion.impact === "medium"
                      ? "Trung bình"
                      : "Thấp"}
                  </Text>
                </View>
              </View>

              <Text style={styles.suggestionReason}>{suggestion.reason}</Text>

              <View style={styles.suggestionFooter}>
                <View style={styles.changeInfo}>
                  <Text style={styles.changeLabel}>Thay đổi:</Text>
                  <Text
                    style={[
                      styles.changeValue,
                      {
                        color:
                          suggestion.type === "reduce" ? "#F44336" : "#4CAF50",
                      },
                    ]}
                  >
                    {suggestion.type === "reduce" ? "-" : "+"}
                    {formatCurrency(changeAmount)} ({changePercent.toFixed(0)}%)
                  </Text>
                </View>
                {onApplySuggestion && (
                  <TouchableOpacity
                    style={[styles.applyButton, { borderColor: themeColor }]}
                    onPress={() => onApplySuggestion(suggestion)}
                  >
                    <Text style={[styles.applyButtonText, { color: themeColor }]}>
                      Áp dụng
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
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
    flex: 1,
  },
  suggestionsList: {
    gap: 12,
  },
  suggestionItem: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionCategory: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 8,
  },
  suggestionAmounts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentAmount: {
    fontSize: 14,
    fontWeight: "500",
    color: "#757575",
  },
  suggestedAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  impactText: {
    fontSize: 11,
    fontWeight: "600",
  },
  suggestionReason: {
    fontSize: 13,
    color: "#757575",
    lineHeight: 18,
    marginBottom: 12,
  },
  suggestionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  changeInfo: {
    flex: 1,
  },
  changeLabel: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 2,
  },
  changeValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  applyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  applyButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#9E9E9E",
  },
});


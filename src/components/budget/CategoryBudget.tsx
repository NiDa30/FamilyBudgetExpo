// src/components/budget/CategoryBudget.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface CategoryBudgetItem {
  categoryId: string;
  categoryName: string;
  icon?: string;
  color?: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
}

interface CategoryBudgetProps {
  categoryBudgets: CategoryBudgetItem[];
  themeColor?: string;
  onCategoryPress?: (categoryId: string) => void;
  onSetBudgetPress?: () => void;
}

export const CategoryBudget: React.FC<CategoryBudgetProps> = ({
  categoryBudgets,
  themeColor = "#1E88E5",
  onCategoryPress,
  onSetBudgetPress,
}) => {
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return "#F44336";
    if (percentage >= 90) return "#FF9800";
    if (percentage >= 70) return "#FFC107";
    return "#4CAF50";
  };

  if (categoryBudgets.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: `${themeColor}15` }]}>
            <Icon name="tag-multiple" size={24} color={themeColor} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Ngân sách theo Danh mục</Text>
            <Text style={styles.subtitle}>Thiết lập ngân sách cho từng danh mục</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="tag-outline" size={48} color="#E0E0E0" />
          <Text style={styles.emptyText}>Chưa có ngân sách danh mục nào</Text>
          {onSetBudgetPress && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: themeColor }]}
              onPress={onSetBudgetPress}
            >
              <Icon name="plus" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Thiết lập ngân sách</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: `${themeColor}15` }]}>
          <Icon name="tag-multiple" size={24} color={themeColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Ngân sách theo Danh mục</Text>
          <Text style={styles.subtitle}>
            {categoryBudgets.length} danh mục đã thiết lập
          </Text>
        </View>
        {onSetBudgetPress && (
          <TouchableOpacity onPress={onSetBudgetPress} style={styles.addIconButton}>
            <Icon name="plus" size={24} color={themeColor} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {categoryBudgets.map((item, index) => {
          const progressColor = getProgressColor(item.percentage);
          const isOverBudget = item.percentage >= 100;

          return (
            <TouchableOpacity
              key={item.categoryId || index}
              style={styles.budgetCard}
              onPress={() => onCategoryPress?.(item.categoryId)}
              activeOpacity={0.7}
            >
              <View style={styles.budgetCardHeader}>
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: (item.color || themeColor) + "20" },
                  ]}
                >
                  <Icon
                    name={item.icon || "tag"}
                    size={24}
                    color={item.color || themeColor}
                  />
                </View>
                <View style={styles.budgetCardInfo}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {item.categoryName}
                  </Text>
                  <Text style={styles.budgetAmount}>
                    {formatCurrency(item.budgetAmount)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(item.percentage, 100)}%`,
                        backgroundColor: progressColor,
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressInfo}>
                  <Text style={[styles.spentAmount, { color: progressColor }]}>
                    {formatCurrency(item.spentAmount)}
                  </Text>
                  <Text
                    style={[
                      styles.percentage,
                      { color: isOverBudget ? "#F44336" : "#757575" },
                    ]}
                  >
                    {item.percentage.toFixed(0)}%
                  </Text>
                </View>
              </View>

              {isOverBudget && (
                <View style={styles.overBudgetBadge}>
                  <Icon name="alert-circle" size={14} color="#F44336" />
                  <Text style={styles.overBudgetText}>Vượt ngân sách</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
  headerText: {
    flex: 1,
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
  addIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    marginHorizontal: -4,
  },
  budgetCard: {
    width: 200,
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  budgetCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  budgetCardInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  budgetAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#424242",
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spentAmount: {
    fontSize: 13,
    fontWeight: "600",
  },
  percentage: {
    fontSize: 12,
    fontWeight: "500",
  },
  overBudgetBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 6,
    backgroundColor: "#FFEBEE",
    borderRadius: 6,
    gap: 4,
  },
  overBudgetText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#F44336",
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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});


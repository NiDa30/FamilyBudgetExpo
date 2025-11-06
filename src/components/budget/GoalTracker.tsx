// src/components/budget/GoalTracker.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  endDate: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
}

interface GoalTrackerProps {
  goals: Goal[];
  themeColor?: string;
  onAddGoalPress?: () => void;
}

export const GoalTracker: React.FC<GoalTrackerProps> = ({
  goals,
  themeColor = "#1E88E5",
  onAddGoalPress,
}) => {
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  };

  const calculateProgress = (goal: Goal): number => {
    if (goal.targetAmount === 0) return 0;
    return Math.min((goal.savedAmount / goal.targetAmount) * 100, 100);
  };

  const getDaysRemaining = (endDate: string): number => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");

  if (activeGoals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: `${themeColor}15` }]}>
            <Icon name="target" size={24} color={themeColor} />
          </View>
          <Text style={styles.title}>Mục tiêu Tiết kiệm</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="target-variant" size={48} color="#E0E0E0" />
          <Text style={styles.emptyText}>Chưa có mục tiêu nào</Text>
          {onAddGoalPress && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: themeColor }]}
              onPress={onAddGoalPress}
            >
              <Icon name="plus" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Thêm mục tiêu</Text>
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
          <Icon name="target" size={24} color={themeColor} />
        </View>
        <Text style={styles.title}>Mục tiêu Tiết kiệm</Text>
        {onAddGoalPress && (
          <TouchableOpacity onPress={onAddGoalPress} style={styles.addIconButton}>
            <Icon name="plus" size={24} color={themeColor} />
          </TouchableOpacity>
        )}
      </View>

      {activeGoals.map((goal) => {
        const progress = calculateProgress(goal);
        const daysRemaining = getDaysRemaining(goal.endDate);
        const isOnTrack = progress >= (daysRemaining / 365) * 100;

        return (
          <View key={goal.id} style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.goalHeaderLeft}>
                <Icon name="flag" size={20} color={themeColor} />
                <Text style={styles.goalName}>{goal.name}</Text>
              </View>
              <View style={styles.goalStatusBadge}>
                <Icon
                  name={isOnTrack ? "check-circle" : "clock-outline"}
                  size={16}
                  color={isOnTrack ? "#4CAF50" : "#FF9800"}
                />
                <Text
                  style={[
                    styles.goalStatusText,
                    { color: isOnTrack ? "#4CAF50" : "#FF9800" },
                  ]}
                >
                  {isOnTrack ? "Đúng tiến độ" : "Cần tăng tốc"}
                </Text>
              </View>
            </View>

            <View style={styles.goalAmounts}>
              <View>
                <Text style={styles.goalAmountLabel}>Đã tiết kiệm</Text>
                <Text style={[styles.goalAmountValue, { color: themeColor }]}>
                  {formatCurrency(goal.savedAmount)}
                </Text>
              </View>
              <View style={styles.goalAmountDivider} />
              <View>
                <Text style={styles.goalAmountLabel}>Mục tiêu</Text>
                <Text style={styles.goalAmountValue}>
                  {formatCurrency(goal.targetAmount)}
                </Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress}%`,
                      backgroundColor: themeColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{progress.toFixed(1)}%</Text>
            </View>

            <View style={styles.goalFooter}>
              <View style={styles.goalFooterItem}>
                <Icon name="calendar" size={16} color="#757575" />
                <Text style={styles.goalFooterText}>
                  Còn {daysRemaining > 0 ? `${daysRemaining} ngày` : "Đã hết hạn"}
                </Text>
              </View>
              <View style={styles.goalFooterItem}>
                <Icon name="cash" size={16} color="#757575" />
                <Text style={styles.goalFooterText}>
                  Còn thiếu: {formatCurrency(Math.max(0, goal.targetAmount - goal.savedAmount))}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
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
    justifyContent: "space-between",
    marginBottom: 20,
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
  addIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
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
  goalCard: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  goalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  goalName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  goalStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  goalStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  goalAmounts: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  goalAmountLabel: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 4,
  },
  goalAmountValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  goalAmountDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 10,
    backgroundColor: "#E0E0E0",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    color: "#757575",
    textAlign: "right",
  },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  goalFooterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  goalFooterText: {
    fontSize: 12,
    color: "#757575",
  },
});


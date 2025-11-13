// src/components/budget/SpendingTrendAnalysis.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface TrendData {
  period: string;
  amount: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
}

interface SpendingTrendAnalysisProps {
  trends: TrendData[];
  themeColor?: string;
}

export const SpendingTrendAnalysis: React.FC<SpendingTrendAnalysisProps> = ({
  trends,
  themeColor = "#1E88E5",
}) => {
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  };

  const getTrendIcon = (trend: "up" | "down" | "stable"): string => {
    switch (trend) {
      case "up":
        return "trending-up";
      case "down":
        return "trending-down";
      default:
        return "trending-neutral";
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable"): string => {
    switch (trend) {
      case "up":
        return "#F44336"; // Red for increasing expenses
      case "down":
        return "#4CAF50"; // Green for decreasing expenses
      default:
        return "#757575";
    }
  };

  if (trends.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: `${themeColor}15` }]}>
            <Icon name="chart-line" size={24} color={themeColor} />
          </View>
          <Text style={styles.title}>Phân tích Xu hướng Chi tiêu</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="chart-line-variant" size={48} color="#E0E0E0" />
          <Text style={styles.emptyText}>Chưa có dữ liệu để phân tích</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: `${themeColor}15` }]}>
          <Icon name="chart-line" size={24} color={themeColor} />
        </View>
        <Text style={styles.title}>Phân tích Xu hướng Chi tiêu</Text>
      </View>

      <View style={styles.trendsList}>
        {trends.map((trend, index) => {
          const trendColor = getTrendColor(trend.trend);
          const isIncrease = trend.changePercent > 0;

          return (
            <View key={index} style={styles.trendItem}>
              <View style={styles.trendItemLeft}>
                <View style={[styles.trendIcon, { backgroundColor: trendColor + "20" }]}>
                  <Icon name={getTrendIcon(trend.trend)} size={20} color={trendColor} />
                </View>
                <View style={styles.trendInfo}>
                  <Text style={styles.trendPeriod}>{trend.period}</Text>
                  <Text style={styles.trendAmount}>{formatCurrency(trend.amount)}</Text>
                </View>
              </View>
              <View style={styles.trendChange}>
                <Icon
                  name={isIncrease ? "arrow-up" : "arrow-down"}
                  size={16}
                  color={trendColor}
                />
                <Text style={[styles.trendChangeText, { color: trendColor }]}>
                  {Math.abs(trend.changePercent).toFixed(1)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Insights */}
      {trends.length > 0 && (
        <View style={styles.insightsContainer}>
          <Icon name="lightbulb-on-outline" size={20} color="#FF9800" />
          <View style={styles.insightsContent}>
            <Text style={styles.insightsTitle}>Nhận xét</Text>
            <Text style={styles.insightsText}>
              {trends[0].trend === "up"
                ? "Chi tiêu đang có xu hướng tăng. Hãy xem xét điều chỉnh ngân sách."
                : trends[0].trend === "down"
                ? "Chi tiêu đang giảm. Bạn đang quản lý tài chính tốt!"
                : "Chi tiêu ổn định. Hãy tiếp tục duy trì."}
            </Text>
          </View>
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
  trendsList: {
    gap: 12,
  },
  trendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
  },
  trendItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  trendIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  trendInfo: {
    flex: 1,
  },
  trendPeriod: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  trendAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#424242",
  },
  trendChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendChangeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  insightsContainer: {
    flexDirection: "row",
    marginTop: 16,
    padding: 12,
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    gap: 12,
  },
  insightsContent: {
    flex: 1,
  },
  insightsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212121",
    marginBottom: 4,
  },
  insightsText: {
    fontSize: 12,
    color: "#757575",
    lineHeight: 18,
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


// src/components/budget/BudgetAlerts.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { BudgetAlert } from "../../service/analytics/AnalyticsService";

interface BudgetAlertsProps {
  alerts: BudgetAlert[];
  themeColor?: string;
}

export const BudgetAlerts: React.FC<BudgetAlertsProps> = ({
  alerts,
  themeColor = "#1E88E5",
}) => {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M ₫`;
    }
    return `${(amount / 1000).toFixed(0)}K ₫`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconWrapper, { backgroundColor: "#FFF3E0" }]}>
          <Icon name="alert-circle" size={24} color="#FF9800" />
        </View>
        <Text style={styles.title}>Cảnh báo Ngân sách</Text>
      </View>

      {alerts.map((alert, index) => (
        <View
          key={index}
          style={[
            styles.alertItem,
            alert.alertLevel === "critical" && styles.alertItemCritical,
          ]}
        >
          <View style={styles.alertContent}>
            <View style={styles.alertHeader}>
              <Icon
                name={alert.isOverLimit ? "alert" : "alert-outline"}
                size={20}
                color={alert.alertLevel === "critical" ? "#F44336" : "#FF9800"}
              />
              <Text style={styles.alertCategory}>{alert.categoryName}</Text>
            </View>
            <View style={styles.alertDetails}>
              <View style={styles.alertDetailRow}>
                <Text style={styles.alertLabel}>Đã chi:</Text>
                <Text style={styles.alertValue}>
                  {formatCurrency(alert.currentSpent)}
                </Text>
              </View>
              <View style={styles.alertDetailRow}>
                <Text style={styles.alertLabel}>Giới hạn:</Text>
                <Text style={styles.alertValue}>
                  {formatCurrency(alert.budgetLimit)}
                </Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(alert.percentage, 100)}%`,
                    backgroundColor:
                      alert.alertLevel === "critical" ? "#F44336" : "#FF9800",
                  },
                ]}
              />
            </View>
            <Text style={styles.alertPercentage}>
              {alert.percentage.toFixed(1)}% ngân sách
            </Text>
          </View>
        </View>
      ))}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  alertItem: {
    backgroundColor: "#FFF3E0",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  alertItemCritical: {
    backgroundColor: "#FFEBEE",
    borderLeftColor: "#F44336",
  },
  alertContent: {
    gap: 8,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertCategory: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  alertDetails: {
    gap: 4,
  },
  alertDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  alertLabel: {
    fontSize: 13,
    color: "#757575",
  },
  alertValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#212121",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  alertPercentage: {
    fontSize: 12,
    color: "#757575",
    marginTop: 4,
  },
});


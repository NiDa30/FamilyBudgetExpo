import { StyleSheet, Text, View } from "react-native";

interface BudgetSectionProps {
  totalExpense: number;
  totalIncome: number;
}

const BudgetSection = ({ totalExpense, totalIncome }: BudgetSectionProps) => {
  return (
    <View style={styles.whiteSection}>
      <View style={styles.budgetSettingHeader}>
        <Text style={styles.budgetSettingTitle}>Ngân sách tháng này</Text>
        <Text style={styles.budgetSettingLink}>Cài đặt</Text>
      </View>
      <View style={styles.budgetBar}>
        <View
          style={[
            styles.budgetBarFill,
            {
              width:
                totalExpense > 0
                  ? `${Math.min(
                      (totalExpense / (totalIncome || 1)) * 100,
                      100
                    )}%`
                  : "0%",
            },
          ]}
        />
      </View>
      <Text style={styles.budgetBarText}>
        {totalExpense > 0
          ? `Đã chi ${Math.round((totalExpense / (totalIncome || 1)) * 100)}%`
          : "Chưa có dữ liệu"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  whiteSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: -10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  budgetSettingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  budgetSettingTitle: {
    fontSize: 16,
    color: "#212121",
    fontWeight: "600",
  },
  budgetSettingLink: {
    fontSize: 14,
    color: "#1E88E5",
    fontWeight: "500",
  },
  budgetBar: {
    height: 10,
    backgroundColor: "#E3F2FD",
    borderRadius: 5,
    overflow: "hidden",
  },
  budgetBarFill: {
    height: "100%",
    width: "0%",
    backgroundColor: "#42A5F5",
  },
  budgetBarText: {
    fontSize: 12,
    color: "#9E9E9E",
    marginTop: 8,
  },
});

export default BudgetSection;

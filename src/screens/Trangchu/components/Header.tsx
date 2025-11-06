import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../../../../App";
import { useTheme } from "../../../context/ThemeContext";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Trangchu"
>;

interface HeaderProps {
  date: Date;
  totalBalance: number;
  totalExpense: number;
  totalIncome: number;
  setShowPicker: (show: boolean) => void;
}

const Header = ({
  date,
  totalBalance,
  totalExpense,
  totalIncome,
  setShowPicker,
}: HeaderProps) => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { themeColor } = useTheme();

  const formatTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN").format(amount);
  };

  const getBudgetStatus = () => {
    if (totalBalance > 0) return "Thặng dư";
    if (totalBalance < 0) return "Thâm hụt";
    return "Số dư";
  };

  return (
    <View style={[styles.blueHeader, { backgroundColor: themeColor }]}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>{formatTime()}</Text>
        <View style={styles.statusIcons}>
          <Icon name="volume-variant-off" size={16} color="#fff" />
          <Icon
            name="signal-cellular-3"
            size={16}
            color="#fff"
            style={{ marginLeft: 6 }}
          />
          <Text style={styles.statusBattery}>100%</Text>
          <Icon
            name="battery"
            size={18}
            color="#fff"
            style={{ marginLeft: 2 }}
          />
        </View>
      </View>

      {/* Date and menu */}
      <View style={styles.dateHeader}>
        <TouchableOpacity
          style={styles.dateLeft}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.8}
        >
          <View style={styles.calendarIconWrapper}>
            <Icon name="calendar-month" size={22} color="#fff" />
          </View>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{getBudgetStatus()}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Setting")}
          style={styles.menuButton}
          activeOpacity={0.8}
        >
          <Icon name="dots-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Budget display */}
      <View style={styles.budgetContainer}>
        <Text style={styles.budgetLabel}>Tổng số dư</Text>
        <View style={styles.budgetAmountWrapper}>
          <Text style={styles.currencySymbol}>₫</Text>
          <Text style={styles.budgetAmount}>
            {formatCurrency(totalBalance)}
          </Text>
        </View>
      </View>

      {/* Expense and Income Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrapper}>
            <Icon name="arrow-up" size={20} color="#FF5252" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Chi tiêu</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(totalExpense)} ₫
            </Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { marginLeft: 12 }]}>
          <View
            style={[
              styles.summaryIconWrapper,
              { backgroundColor: "rgba(76, 175, 80, 0.15)" },
            ]}
          >
            <Icon name="arrow-down" size={20} color="#4CAF50" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Thu nhập</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(totalIncome)} ₫
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  blueHeader: {
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  statusTime: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBattery: {
    color: "#fff",
    fontSize: 13,
    marginLeft: 6,
    fontWeight: "500",
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
  },
  dateLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  calendarIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  dateText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
  statusBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  budgetContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  budgetLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    marginBottom: 4,
    fontWeight: "500",
  },
  budgetAmountWrapper: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  currencySymbol: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "400",
    marginRight: 4,
  },
  budgetAmount: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "300",
    letterSpacing: -1,
  },
  summaryContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    padding: 12,
  },
  summaryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(244, 67, 54, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryInfo: {
    marginLeft: 12,
    flex: 1,
  },
  summaryLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    marginBottom: 2,
  },
  summaryAmount: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default Header;

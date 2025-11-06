import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../../../../App";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Trangchu"
>;

const QuickActions = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  return (
    <View style={styles.quickActions}>
      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => navigation.navigate("Nhappl")}
        activeOpacity={0.7}
      >
        <View style={styles.quickActionIcon}>
          <Icon name="plus-circle" size={28} color="#1E88E5" />
        </View>
        <Text style={styles.quickActionText}>Ghi nợ</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => navigation.navigate("Quethoadon")}
        activeOpacity={0.7}
      >
        <View style={styles.quickActionIcon}>
          <Icon name="receipt" size={28} color="#4CAF50" />
        </View>
        <Text style={styles.quickActionText}>Hóa đơn</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => navigation.navigate("Bieudo")}
        activeOpacity={0.7}
      >
        <View style={styles.quickActionIcon}>
          <Icon name="chart-bar" size={28} color="#FF9800" />
        </View>
        <Text style={styles.quickActionText}>Thống kê</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => navigation.navigate("BudgetDashboard")}
        activeOpacity={0.7}
      >
        <View style={styles.quickActionIcon}>
          <Icon name="finance" size={28} color="#9C27B0" />
        </View>
        <Text style={styles.quickActionText}>Ngân sách</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => navigation.navigate("Home")}
        activeOpacity={0.7}
      >
        <View style={styles.quickActionIcon}>
          <Icon name="cog" size={28} color="#9C27B0" />
        </View>
        <Text style={styles.quickActionText}>Quản lý</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  quickActions: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
    marginTop: -20,
    zIndex: 10,
  },
  quickActionButton: {
    alignItems: "center",
    flex: 1,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
});

export default QuickActions;

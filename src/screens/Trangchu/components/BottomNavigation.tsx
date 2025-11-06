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

interface BottomNavigationProps {
  setShowCategoryModal: (show: boolean) => void;
}

const BottomNavigation = ({ setShowCategoryModal }: BottomNavigationProps) => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { themeColor } = useTheme();

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Timkiem")}
        activeOpacity={0.7}
      >
        <Icon name="text-box-search-outline" size={26} color="#9E9E9E" />
        <Text style={styles.navLabel}>Tìm Kiếm</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Home")}
        activeOpacity={0.7}
      >
        <Icon name="view-grid-outline" size={26} color="#2196F3" />
        <Text
          style={[styles.navLabel, { color: "#2196F3", fontWeight: "600" }]}
        >
          Tổng Quan
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Bieudo")}
        activeOpacity={0.7}
      >
        <Icon name="chart-pie" size={26} color="#9E9E9E" />
        <Text style={styles.navLabel}>Thống Kê</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Quethoadon")}
        activeOpacity={0.7}
      >
        <Icon name="qrcode-scan" size={26} color="#9E9E9E" />
        <Text style={styles.navLabel}>Quét hóa đơn</Text>
      </TouchableOpacity>

      {/* FAB button – DÙNG MÀU THEME */}
      <TouchableOpacity
        style={[
          styles.addButton,
          { backgroundColor: themeColor, shadowColor: themeColor },
        ]}
        onPress={() => setShowCategoryModal(true)}
        activeOpacity={0.9}
      >
        <Icon name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  navItem: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 6 },
  navLabel: { fontSize: 11, color: "#9E9E9E", marginTop: 4, fontWeight: "500" },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: "absolute",
    right: 20,
    bottom: 70,
  },
});

export default BottomNavigation;

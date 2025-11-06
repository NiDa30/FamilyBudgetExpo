// src/TuyChinhMauSac.tsx
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { useTheme } from "./context/ThemeContext";

const PRESET_COLORS = [
  "#1E88E5",
  "#4CAF50",
  "#FF9800",
  "#F44336",
  "#9C27B0",
  "#00BCD4",
];

type TuyChinhMauSacNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "TuyChinhMauSac"
>;

const TuyChinhMauSac = () => {
  const navigation = useNavigation<TuyChinhMauSacNavigationProp>();
  const { themeColor, setThemeColor } = useTheme();
  const [selectedColor, setSelectedColor] = useState(themeColor);

  const applyAndGoBack = () => {
    setThemeColor(selectedColor);
    navigation.goBack(); // TOÀN BỘ APP ĐỔI MÀU NGAY!
  };

  const resetToDefault = () => {
    setSelectedColor("#1E88E5");
    setThemeColor("#1E88E5");
    Alert.alert("Đặt lại", "Đã khôi phục màu mặc định");
  };

  return (
    <View style={styles.container}>
      {/* Header dùng màu hiện tại */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <TouchableOpacity onPress={applyAndGoBack} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tùy chỉnh màu sắc</Text>
        <TouchableOpacity onPress={applyAndGoBack} style={styles.applyButton}>
          <Text style={styles.applyText}>Lưu</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.currentColorCard}>
          <Text style={styles.sectionTitle}>Màu hiện tại</Text>
          <View
            style={[
              styles.currentColorPreview,
              { backgroundColor: selectedColor },
            ]}
          >
            <Icon name="brush" size={32} color="#fff" />
          </View>
          <Text style={styles.currentColorCode}>{selectedColor}</Text>
        </View>

        <View style={styles.presetColorsCard}>
          <Text style={styles.sectionTitle}>Chọn màu</Text>
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorItem,
                  { backgroundColor: color },
                  selectedColor === color && styles.selectedColorItem,
                ]}
                onPress={() => setSelectedColor(color)}
              >
                {selectedColor === color && (
                  <Icon name="check" size={24} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.resetButton} onPress={resetToDefault}>
          <Icon name="restore" size={20} color="#757575" />
          <Text style={styles.resetText}>Khôi phục mặc định</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
  },
  applyButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  applyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  currentColorCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 12,
  },
  currentColorPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  currentColorCode: {
    fontSize: 14,
    color: "#757575",
    fontFamily: "monospace",
  },
  presetColorsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  colorItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  selectedColorItem: {
    borderWidth: 3,
    borderColor: "#fff",
    elevation: 4,
  },
  infoCard: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    marginBottom: 16,
    gap: 12,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoTextBold: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#E65100",
  },
  infoText: {
    fontSize: 13,
    color: "#E65100",
    lineHeight: 18,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEEEEE",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  resetText: {
    fontSize: 15,
    color: "#757575",
    fontWeight: "600",
  },
  previewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    elevation: 2,
  },
  previewHeader: {
    height: 60,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 16,
  },
  previewHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  previewContent: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  previewItem: {
    alignItems: "center",
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 13,
    color: "#424242",
  },
});

export default TuyChinhMauSac;

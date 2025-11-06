import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Category, RootStackParamList } from "../../../../App";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Trangchu"
>;

interface CategoryModalProps {
  showCategoryModal: boolean;
  setShowCategoryModal: (show: boolean) => void;
  activeTab: "expense" | "income";
  setActiveTab: (tab: "expense" | "income") => void;
  currentCategories: Category[];
  handleCategorySelect: (category: Category) => void;
}

const CategoryModal = ({
  showCategoryModal,
  setShowCategoryModal,
  activeTab,
  setActiveTab,
  currentCategories,
  handleCategorySelect,
}: CategoryModalProps) => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => handleCategorySelect(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.color }]}>
        <Icon name={item.icon} size={26} color="#fff" />
      </View>
      <Text style={styles.categoryName}>{item.name}</Text>
      <Icon
        name="chevron-right"
        size={20}
        color="#BDBDBD"
        style={styles.categoryArrow}
      />
    </TouchableOpacity>
  );

  return (
    <TouchableOpacity
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={() => setShowCategoryModal(false)}
    >
      <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
        <View style={styles.modalHandle} />

        <View style={styles.modalHeader}>
          <View style={styles.tabsWrapper}>
            <TouchableOpacity
              style={[
                styles.modalTab,
                activeTab === "expense" && styles.modalTabActiveExpense,
              ]}
              onPress={() => setActiveTab("expense")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.tabIconWrapper,
                  activeTab === "expense" && styles.tabIconWrapperActiveExpense,
                ]}
              >
                <Icon
                  name="arrow-up-circle"
                  size={24}
                  color={activeTab === "expense" ? "#fff" : "#F44336"}
                />
              </View>
              <Text
                style={[
                  styles.modalTabText,
                  activeTab === "expense" && styles.modalTabTextActiveExpense,
                ]}
              >
                Chi tiêu
              </Text>
            </TouchableOpacity>

            <View style={styles.tabDivider} />

            <TouchableOpacity
              style={[
                styles.modalTab,
                activeTab === "income" && styles.modalTabActiveIncome,
              ]}
              onPress={() => setActiveTab("income")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.tabIconWrapper,
                  activeTab === "income" && styles.tabIconWrapperActiveIncome,
                ]}
              >
                <Icon
                  name="arrow-down-circle"
                  size={24}
                  color={activeTab === "income" ? "#fff" : "#4CAF50"}
                />
              </View>
              <Text
                style={[
                  styles.modalTabText,
                  activeTab === "income" && styles.modalTabTextActiveIncome,
                ]}
              >
                Thu nhập
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              setShowCategoryModal(false);
              navigation.navigate("Home");
            }}
            style={styles.modalSettingsButton}
            activeOpacity={0.7}
          >
            <Icon name="cog-outline" size={24} color="#757575" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={currentCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          numColumns={1}
          contentContainerStyle={styles.categoryList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCategoryContainer}>
              <Icon name="folder-open-outline" size={48} color="#BDBDBD" />
              <Text style={styles.emptyCategoryText}>Chưa có danh mục</Text>
              <TouchableOpacity
                style={styles.addCategoryButton}
                onPress={() => {
                  setShowCategoryModal(false);
                  navigation.navigate("Home");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.addCategoryButtonText}>Thêm danh mục</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  tabsWrapper: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderRadius: 16,
    padding: 4,
    marginRight: 12,
  },
  modalTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  modalTabActiveExpense: {
    backgroundColor: "#F44336",
    shadowColor: "#F44336",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTabActiveIncome: {
    backgroundColor: "#4CAF50",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconWrapperActiveExpense: { backgroundColor: "rgba(255, 255, 255, 0.25)" },
  tabIconWrapperActiveIncome: { backgroundColor: "rgba(255, 255, 255, 0.25)" },
  tabDivider: { width: 8 },
  modalTabText: { fontSize: 14, color: "#757575", fontWeight: "600" },
  modalTabTextActiveExpense: { color: "#fff", fontWeight: "700" },
  modalTabTextActiveIncome: { color: "#fff", fontWeight: "700" },
  modalSettingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryList: { padding: 20 },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 10,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryName: { flex: 1, fontSize: 15, color: "#212121", fontWeight: "500" },
  categoryArrow: { marginLeft: 8 },
  emptyCategoryContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyCategoryText: {
    fontSize: 16,
    color: "#757575",
    marginTop: 16,
    marginBottom: 24,
  },
  addCategoryButton: {
    backgroundColor: "#1E88E5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addCategoryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default CategoryModal;

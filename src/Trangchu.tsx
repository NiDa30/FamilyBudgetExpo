// HomeScreen.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Category, RootStackParamList } from "../App";
import { TransactionService } from "./service/transactions";
import { auth } from "./firebaseConfig";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Trangchu"
>;

const HomeScreen = () => {
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const navigation = useNavigation<HomeScreenNavigationProp>();

  useEffect(() => {
    loadCategories();
    refreshTotals();
  }, []);

  useEffect(() => {
    // Recalculate when month changes
    refreshTotals();
  }, [date]);

  const loadCategories = async () => {
    try {
      const storedExpense = await AsyncStorage.getItem("expenseCategories");
      const storedIncome = await AsyncStorage.getItem("incomeCategories");

      if (storedExpense) {
        setExpenseCategories(JSON.parse(storedExpense));
      }
      if (storedIncome) {
        setIncomeCategories(JSON.parse(storedIncome));
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const refreshTotals = async () => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      ).toISOString();
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        1
      ).toISOString();

      const [expenses, incomes] = await Promise.all([
        TransactionService.query(user.uid, {
          range: { start, end },
          type: "EXPENSE",
        }),
        TransactionService.query(user.uid, {
          range: { start, end },
          type: "INCOME",
        }),
      ]);

      const expense = expenses.reduce((s, t) => s + (t.amount || 0), 0);
      const income = incomes.reduce((s, t) => s + (t.amount || 0), 0);

      setTotalExpense(expense);
      setTotalIncome(income);
      setTotalBalance(income - expense);
    } catch (error) {
      console.error("Error calculating totals:", error);
    }
  };

  const onChangeDate = (_event: any, selectedDate?: Date | undefined) => {
    const currentDate = selectedDate || date;
    setShowPicker(false);
    setDate(currentDate);
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN").format(amount);
  };

  const formatTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getBudgetStatus = () => {
    if (totalBalance > 0) return "Thặng dư";
    if (totalBalance < 0) return "Thâm hụt";
    return "Số dư";
  };

  const currentCategories =
    activeTab === "expense" ? expenseCategories : incomeCategories;

  const handleCategorySelect = (category: Category) => {
    setShowCategoryModal(false);
    navigation.navigate("Nhap", {
      selectedCategory: category,
      transactionType: activeTab,
    });
  };

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
    <View style={styles.container}>
      {/* Header màu xanh với gradient effect */}
      <View style={styles.blueHeader}>
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

      {/* White section with shadow */}
      <View style={styles.whiteSection}>
        <View style={styles.budgetSettingHeader}>
          <Text style={styles.budgetSettingTitle}>Ngân sách tháng này</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.budgetSettingLink}>Cài đặt</Text>
          </TouchableOpacity>
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

      {/* Empty state with better design */}
      <ScrollView
        style={styles.emptyContainer}
        contentContainerStyle={styles.emptyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyIllustration}>
          <Icon
            name="close"
            size={20}
            color="#90CAF9"
            style={styles.decorIcon1}
          />
          <Icon
            name="circle-outline"
            size={14}
            color="#E3F2FD"
            style={styles.decorIcon2}
          />
          <Icon
            name="close"
            size={14}
            color="#E3F2FD"
            style={styles.decorIcon3}
          />
          <Icon
            name="circle-outline"
            size={18}
            color="#90CAF9"
            style={styles.decorIcon4}
          />
          <Icon
            name="close"
            size={18}
            color="#E3F2FD"
            style={styles.decorIcon5}
          />
          <Icon
            name="circle-outline"
            size={12}
            color="#90CAF9"
            style={styles.decorIcon6}
          />

          <View style={styles.scrollIcon}>
            <View style={styles.scrollPaper}>
              <View style={styles.scrollLine} />
              <View style={styles.scrollLine} />
              <View style={styles.scrollLine} />
              <View style={[styles.scrollLine, { width: "60%" }]} />
            </View>
            <View style={styles.scrollBottom} />
          </View>

          <View style={styles.decorDots}>
            <View style={[styles.decorDot, { opacity: 0.3 }]} />
            <View style={[styles.decorDot, { opacity: 0.5 }]} />
            <View style={styles.decorDot} />
            <View style={[styles.decorDot, { opacity: 0.5 }]} />
            <View style={[styles.decorDot, { opacity: 0.3 }]} />
          </View>
        </View>
        <Text style={styles.emptyText}>Chưa có giao dịch nào</Text>
        <Text style={styles.emptySubtext}>
          Nhấn nút + để thêm giao dịch mới
        </Text>
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChangeDate}
          maximumDate={new Date()}
        />
      )}

      {/* Bottom navigation */}
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
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Quethoadon")}
        >
          <Icon name="qrcode-scan" size={26} color="#9E9E9E" />
          <Text style={styles.navLabel}>Quét hóa đơn</Text>
        </TouchableOpacity>

        {/* FAB button */}
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.8}
          onPress={() => setShowCategoryModal(true)}
        >
          <Icon name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowCategoryModal(false)}
          />
          <View style={styles.modalContent}>
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
                      activeTab === "expense" &&
                        styles.tabIconWrapperActiveExpense,
                    ]}
                  >
                    <Icon
                      name="arrow-up"
                      size={16}
                      color={activeTab === "expense" ? "#fff" : "#F44336"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.modalTabText,
                      activeTab === "expense" &&
                        styles.modalTabTextActiveExpense,
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
                      activeTab === "income" &&
                        styles.tabIconWrapperActiveIncome,
                    ]}
                  >
                    <Icon
                      name="arrow-down"
                      size={16}
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
                style={styles.modalSettingsButton}
                activeOpacity={0.7}
                onPress={() => {
                  setShowCategoryModal(false);
                  navigation.navigate("Nhappl");
                }}
              >
                <Icon name="cog-outline" size={22} color="#757575" />
              </TouchableOpacity>
            </View>

            {currentCategories.length > 0 ? (
              <FlatList
                data={currentCategories}
                renderItem={renderCategoryItem}
                keyExtractor={(item) => item.id}
                style={styles.categoryList}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyCategoryContainer}>
                <Icon name="folder-open-outline" size={64} color="#E0E0E0" />
                <Text style={styles.emptyCategoryText}>
                  Chưa có danh mục nào
                </Text>
                <TouchableOpacity
                  style={styles.addCategoryButton}
                  onPress={() => {
                    setShowCategoryModal(false);
                    navigation.navigate("Nhappl");
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addCategoryButtonText}>
                    Thêm danh mục
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  blueHeader: {
    backgroundColor: "#1E88E5",
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#1E88E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  statusTime: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBattery: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 6,
  },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    marginRight: 10,
  },
  dateText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 10,
  },
  statusBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
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
    alignItems: "center",
    paddingVertical: 16,
  },
  budgetLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 14,
    marginBottom: 8,
  },
  budgetAmountWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
    marginRight: 4,
  },
  budgetAmount: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
  },
  summaryContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 12,
  },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 14,
    backdropFilter: "blur(10px)",
  },
  summaryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 82, 82, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    marginBottom: 4,
  },
  summaryAmount: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  whiteSection: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  budgetSettingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  budgetSettingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#212121",
  },
  budgetSettingLink: {
    fontSize: 13,
    color: "#1E88E5",
    fontWeight: "600",
  },
  budgetBar: {
    height: 8,
    backgroundColor: "#E3F2FD",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  budgetBarFill: {
    height: "100%",
    backgroundColor: "#FF5252",
    borderRadius: 4,
  },
  budgetBarText: {
    fontSize: 12,
    color: "#757575",
  },
  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIllustration: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    position: "relative",
  },
  decorIcon1: {
    position: "absolute",
    top: 20,
    left: 20,
    opacity: 0.6,
  },
  decorIcon2: {
    position: "absolute",
    top: 20,
    right: 30,
    opacity: 0.4,
  },
  decorIcon3: {
    position: "absolute",
    bottom: 60,
    left: 15,
    opacity: 0.3,
  },
  decorIcon4: {
    position: "absolute",
    top: 50,
    right: 15,
    opacity: 0.5,
  },
  decorIcon5: {
    position: "absolute",
    bottom: 50,
    right: 25,
    opacity: 0.3,
  },
  decorIcon6: {
    position: "absolute",
    top: 80,
    left: 30,
    opacity: 0.4,
  },
  scrollIcon: {
    alignItems: "center",
  },
  scrollPaper: {
    width: 120,
    height: 150,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#90CAF9",
    padding: 16,
    justifyContent: "flex-start",
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  scrollLine: {
    width: "100%",
    height: 4,
    backgroundColor: "#BBDEFB",
    marginVertical: 6,
    borderRadius: 2,
  },
  scrollBottom: {
    width: 100,
    height: 35,
    backgroundColor: "#90CAF9",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginTop: -12,
  },
  decorDots: {
    flexDirection: "row",
    marginTop: 20,
  },
  decorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#90CAF9",
    marginHorizontal: 4,
  },
  emptyText: {
    fontSize: 18,
    color: "#424242",
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9E9E9E",
  },
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
  navItem: {
    alignItems: "center",
    position: "relative",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navLabel: {
    fontSize: 11,
    color: "#9E9E9E",
    marginTop: 4,
    fontWeight: "500",
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#1E88E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: "absolute",
    right: 20,
    bottom: 70,
  },
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
  tabIconWrapperActiveExpense: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabIconWrapperActiveIncome: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabDivider: {
    width: 8,
  },
  modalTabText: {
    fontSize: 14,
    color: "#757575",
    fontWeight: "600",
  },
  modalTabTextActiveExpense: {
    color: "#fff",
    fontWeight: "700",
  },
  modalTabTextActiveIncome: {
    color: "#fff",
    fontWeight: "700",
  },
  modalSettingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryList: {
    padding: 20,
  },
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
  categoryName: {
    flex: 1,
    fontSize: 15,
    color: "#212121",
    fontWeight: "500",
  },
  categoryArrow: {
    marginLeft: 8,
  },
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

export default HomeScreen;

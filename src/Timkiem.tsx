import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RootStackParamList } from "../App";
import { TransactionRepository } from "./database/repositories";
import { Transaction } from "./domain/types";
import { auth, db } from "./firebaseConfig";

type SearchScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Timkiem"
>;

const Timkiem = () => {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "INCOME" | "EXPENSE">(
    "all"
  );
  const [filterTime, setFilterTime] = useState<
    "all" | "day" | "week" | "month" | "year"
  >("all");

  // Get current user ID
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUserId(currentUser.uid);
    } else {
      // Handle case when user is not authenticated
      Alert.alert("Lỗi", "Vui lòng đăng nhập để sử dụng tính năng tìm kiếm");
      navigation.goBack();
    }
  }, [navigation]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  };

  // Format amount with currency
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // Calculate date range based on filter
  const getDateRange = useCallback((): {
    start: string;
    end: string;
  } | null => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (filterTime) {
      case "day":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        return null;
    }

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };
  }, [filterTime]);

  // Perform search with filters
  const performSearch = useCallback(
    async (query: string) => {
      if (!userId) return;

      setIsLoading(true);
      try {
        const filters: any = {};

        // Add search term filter
        if (query.trim()) {
          filters.search = query.trim();
        }

        // Add type filter
        if (filterType !== "all") {
          filters.type = filterType;
        }

        // Add date range filter
        if (filterTime !== "all") {
          const dateRange = getDateRange();
          if (dateRange) {
            filters.range = {
              start: dateRange.start,
              end: dateRange.end,
            };
          }
        }

        // Use TransactionRepository.query for efficient search
        const results = await TransactionRepository.query(userId, {
          ...filters,
          sortBy: "date",
          sortDir: "DESC",
        });

        setSearchResults(results);
      } catch (error) {
        console.error("Error searching transactions:", error);
        Alert.alert("Lỗi", "Không thể thực hiện tìm kiếm. Vui lòng thử lại.");
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, filterType, filterTime, getDateRange]
  );

  // Handle search when query or filters change with debounce
  useEffect(() => {
    if (!userId) return;

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, filterType, filterTime, userId, performSearch]);

  // ✅ REAL-TIME SYNC: Set up Firebase listeners for data synchronization
  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user?.uid) return;

      console.log(
        "🔄 Timkiem screen focused, setting up real-time listeners..."
      );

      // Set up transaction listener
      const transactionsQuery = query(
        collection(db, "TRANSACTIONS"),
        where("userID", "==", user.uid),
        where("isDeleted", "==", false),
        orderBy("date", "desc")
      );

      const unsubscribeTransactions = onSnapshot(
        transactionsQuery,
        async (snapshot) => {
          console.log(
            `📊 Firebase transactions updated: ${snapshot.docs.length} transactions`
          );

          // Sync Firebase transactions to SQLite
          try {
            for (const doc of snapshot.docs) {
              const data = doc.data();
              try {
                const existing = await TransactionRepository.getById(doc.id);
                if (!existing) {
                  await TransactionRepository.create({
                    id: doc.id,
                    userId: data.userID || user.uid,
                    categoryId: data.categoryID || null,
                    amount: data.amount || 0,
                    type: data.type || "EXPENSE",
                    date: data.date?.toMillis
                      ? new Date(data.date.toMillis()).toISOString()
                      : data.date || new Date().toISOString(),
                    description: data.description || null,
                    paymentMethod: data.paymentMethod || null,
                    merchantName: data.merchantName || null,
                    merchantLocation: data.merchantLocation || null,
                    latitude: data.latitude || null,
                    longitude: data.longitude || null,
                    tags: data.tags ? data.tags.split(",") : undefined,
                    isSynced: true,
                    lastModifiedAt: data.updatedAt?.toMillis
                      ? new Date(data.updatedAt.toMillis()).toISOString()
                      : new Date().toISOString(),
                    isDeleted: false,
                    createdAt: data.createdAt?.toMillis
                      ? new Date(data.createdAt.toMillis()).toISOString()
                      : new Date().toISOString(),
                  });
                }
              } catch (syncError) {
                // Suppress duplicate error logs
              }
            }

            // Reload search results after syncing transactions
            performSearch(searchQuery);
          } catch (syncError) {
            console.warn("Failed to sync transactions to SQLite:", syncError);
          }
        },
        (error) => {
          console.error("Firebase transactions listener error:", error);
        }
      );

      return () => {
        unsubscribeTransactions();
      };
    }, [searchQuery, performSearch])
  );

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    // Get category info if available
    const categoryName = (item as any).categoryName || "Không phân loại";
    const categoryIcon = (item as any).categoryIcon || "tag";
    const categoryColor = (item as any).categoryColor || "#9E9E9E";

    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => {
          // Navigate to transaction detail screen if available
          // For now, just show an alert
          Alert.alert(
            "Chi tiết giao dịch",
            `Mô tả: ${item.description || "Không có"}\n` +
              `Số tiền: ${formatAmount(item.amount)}\n` +
              `Loại: ${item.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"}\n` +
              `Ngày: ${formatDate(item.date)}`
          );
        }}
        activeOpacity={0.7}
      >
        <View style={styles.transactionLeft}>
          <View style={styles.transactionHeader}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: categoryColor + "20" },
              ]}
            >
              <Icon name={categoryIcon} size={20} color={categoryColor} />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionCategory}>
                {item.description || "Không có ghi chú"}
              </Text>
              <Text style={styles.transactionCategoryName}>{categoryName}</Text>
            </View>
          </View>
          {item.merchantName && (
            <Text style={styles.transactionNote}>{item.merchantName}</Text>
          )}
          <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.transactionAmount,
              item.type === "EXPENSE"
                ? styles.expenseAmount
                : styles.incomeAmount,
            ]}
          >
            {item.type === "EXPENSE" ? "-" : "+"}
            {formatAmount(item.amount)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Reset all filters
  const resetFilters = () => {
    setFilterType("all");
    setFilterTime("all");
    setSearchQuery("");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusBar}>
          <Text style={styles.statusTime}>10:35</Text>
          <View style={styles.statusIcons}>
            <Icon name="volume-variant-off" size={16} color="#fff" />
            <Icon
              name="signal-cellular-3"
              size={16}
              color="#fff"
              style={{ marginLeft: 6 }}
            />
            <Text style={styles.statusBattery}>56%</Text>
            <Icon
              name="battery-50"
              size={16}
              color="#fff"
              style={{ marginLeft: 4 }}
            />
          </View>
        </View>

        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tìm kiếm</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Icon
            name="magnify"
            size={24}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo phân loại, số tiền, ghi chú..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Icon name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Button */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Text style={styles.filterButtonText}>
          {showFilters ? "Ẩn bộ lọc" : "Hiển thị bộ lọc"}
        </Text>
        <Icon
          name={showFilters ? "chevron-up" : "chevron-down"}
          size={20}
          color="#2196F3"
        />
      </TouchableOpacity>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            <View style={styles.filterRow}>
              {/* Type Filter */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Loại giao dịch</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filterType === "all" && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilterType("all")}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterType === "all" && styles.filterOptionTextActive,
                      ]}
                    >
                      Tất cả
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filterType === "EXPENSE" && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilterType("EXPENSE")}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterType === "EXPENSE" &&
                          styles.filterOptionTextActive,
                      ]}
                    >
                      Chi tiêu
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filterType === "INCOME" && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilterType("INCOME")}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterType === "INCOME" &&
                          styles.filterOptionTextActive,
                      ]}
                    >
                      Thu nhập
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Time Filter */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Thời gian</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filterTime === "all" && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilterTime("all")}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterTime === "all" && styles.filterOptionTextActive,
                      ]}
                    >
                      Tất cả
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filterTime === "day" && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilterTime("day")}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterTime === "day" && styles.filterOptionTextActive,
                      ]}
                    >
                      Hôm nay
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filterTime === "week" && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilterTime("week")}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterTime === "week" && styles.filterOptionTextActive,
                      ]}
                    >
                      Tuần này
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filterTime === "month" && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilterTime("month")}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterTime === "month" && styles.filterOptionTextActive,
                      ]}
                    >
                      Tháng này
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterOption,
                      filterTime === "year" && styles.filterOptionActive,
                    ]}
                    onPress={() => setFilterTime("year")}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterTime === "year" && styles.filterOptionTextActive,
                      ]}
                    >
                      Năm nay
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Reset Filters Button */}
          <TouchableOpacity
            style={styles.resetFiltersButton}
            onPress={resetFilters}
          >
            <Text style={styles.resetFiltersText}>Đặt lại bộ lọc</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      <View style={styles.resultsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="magnify" size={64} color="#E0E0E0" />
            <Text style={styles.emptyText}>
              {searchQuery.trim() === "" &&
              filterType === "all" &&
              filterTime === "all"
                ? "Nhập từ khóa để tìm kiếm hoặc chọn bộ lọc"
                : "Không tìm thấy kết quả"}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                Tìm thấy {searchResults.length} kết quả
              </Text>
            </View>
            <FlatList
              data={searchResults}
              renderItem={renderTransactionItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <View style={styles.navButtons}>
          <View style={styles.navDivider} />
          <View style={styles.navSquare} />
          <Icon name="chevron-left" size={32} color="#666" />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    backgroundColor: "#2196F3",
    paddingTop: 10,
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
    fontSize: 16,
    fontWeight: "500",
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBattery: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  searchContainer: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    padding: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  filterButtonText: {
    color: "#2196F3",
    fontSize: 16,
    fontWeight: "500",
    marginRight: 8,
  },
  filtersContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  filterGroup: {
    marginRight: 24,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    marginRight: 8,
    marginBottom: 8,
  },
  filterOptionActive: {
    backgroundColor: "#2196F3",
  },
  filterOptionText: {
    fontSize: 13,
    color: "#666",
  },
  filterOptionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  resetFiltersButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    marginLeft: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "#FFEBEE",
  },
  resetFiltersText: {
    color: "#F44336",
    fontSize: 13,
    fontWeight: "500",
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#757575",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
    textAlign: "center",
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#F5F5F5",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  resultsCount: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  resultsList: {
    paddingVertical: 8,
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  transactionLeft: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    marginBottom: 2,
  },
  transactionCategoryName: {
    fontSize: 12,
    color: "#999",
  },
  transactionNote: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: "#999",
  },
  transactionRight: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: "bold",
  },
  expenseAmount: {
    color: "#F44336",
  },
  incomeAmount: {
    color: "#4CAF50",
  },
  bottomNav: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  navButtons: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 40,
  },
  navDivider: {
    width: 2,
    height: 32,
    backgroundColor: "#666",
  },
  navSquare: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: "#666",
    borderRadius: 4,
  },
});

export default Timkiem;

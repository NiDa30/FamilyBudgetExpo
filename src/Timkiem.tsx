// src/Timkiem.tsx
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { RootStackParamList } from "../App";
import {
  CategoryRepository,
  TransactionRepository,
} from "./database/repositories";
import { Category, Transaction } from "./domain/types";
import { TransactionService } from "./service/transactions";
import { auth } from "./firebaseConfig";
import databaseService from "./database/databaseService";
import { useTheme } from "./context/ThemeContext";
import { LineChart, PieChart } from "react-native-chart-kit";
import { mapRowToTransaction } from "./domain/mappers";

type SearchScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Timkiem"
>;

interface FilterState {
  type: "all" | "INCOME" | "EXPENSE";
  time: "all" | "day" | "week" | "month" | "year" | "custom";
  categoryId?: string | null;
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: string;
  sortBy: "date" | "amount" | "created_at";
  sortDir: "ASC" | "DESC";
  customStartDate?: Date;
  customEndDate?: Date;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  searchQuery?: string;
  createdAt: string;
}

interface SearchSuggestion {
  text: string;
  type: "description" | "merchant" | "category";
}

const { width } = Dimensions.get("window");

const Timkiem = () => {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const { themeColor } = useTheme();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    type: "all",
    time: "all",
    sortBy: "date",
    sortDir: "DESC",
  });

  // Advanced filter states
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(
    null
  );
  const [minAmountInput, setMinAmountInput] = useState("");
  const [maxAmountInput, setMaxAmountInput] = useState("");

  // Saved filters
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSavedFilters, setShowSavedFilters] = useState(false);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [filterNameInput, setFilterNameInput] = useState("");

  // Search suggestions
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // View modes
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const [chartType, setChartType] = useState<"pie" | "line">("pie");

  // Detail modal
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Statistics
  const [statistics, setStatistics] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netAmount: 0,
    transactionCount: 0,
  });

  // Get current user ID and load categories
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUserId(currentUser.uid);
      loadCategories();
      loadSavedFilters();
    } else {
      Alert.alert("Lỗi", "Vui lòng đăng nhập để sử dụng tính năng tìm kiếm");
      navigation.goBack();
    }
  }, [navigation]);

  const loadCategories = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      await databaseService.ensureInitialized();
      const cats = await databaseService.getCategoriesByUser(currentUser.uid);

      // Ensure cats is an array
      if (!Array.isArray(cats)) {
        console.warn("getCategoriesByUser returned non-array:", cats);
        setCategories([]);
        return;
      }

      // Map database rows to Category objects
      const mappedCategories: Category[] = cats.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        type: row.type,
        isSystemDefault: !!row.is_system_default,
        icon: row.icon,
        color: row.color,
        parentCategoryId: row.parent_category_id ?? null,
        displayOrder: row.display_order,
        isHidden: !!row.is_hidden,
        createdAt: row.created_at,
      }));

      setCategories(mappedCategories);
    } catch (error) {
      console.warn("Failed to load categories:", error);
      // Fallback to CategoryRepository if databaseService fails
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const cats = await CategoryRepository.listByUser(currentUser.uid);
          setCategories(cats);
        }
      } catch (fallbackError) {
        console.error(
          "Failed to load categories from repository:",
          fallbackError
        );
      }
    }
  };

  const loadSavedFilters = async () => {
    try {
      const saved = await AsyncStorage.getItem("savedSearchFilters");
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    }
  };

  const saveCurrentFilter = async () => {
    setShowSaveFilterModal(true);
  };

  const confirmSaveFilter = async () => {
    try {
      if (!filterNameInput.trim()) {
        Alert.alert("Lỗi", "Vui lòng nhập tên cho bộ lọc");
        return;
      }

      const filterName = filterNameInput.trim();

      const newFilter: SavedFilter = {
        id: Date.now().toString(),
        name: filterName,
        filters,
        searchQuery,
        createdAt: new Date().toISOString(),
      };

      const updated = [...savedFilters, newFilter];
      setSavedFilters(updated);
      await AsyncStorage.setItem("savedSearchFilters", JSON.stringify(updated));
      setFilterNameInput("");
      setShowSaveFilterModal(false);
      Alert.alert("Thành công", "Đã lưu bộ lọc");
    } catch (error) {
      console.error("Error saving filter:", error);
      Alert.alert("Lỗi", "Không thể lưu bộ lọc");
    }
  };

  const loadSavedFilter = (savedFilter: SavedFilter) => {
    setFilters(savedFilter.filters);
    setSearchQuery(savedFilter.searchQuery || "");
    setShowSavedFilters(false);
    if (savedFilter.filters.customStartDate) {
      setFilters((prev) => ({
        ...prev,
        customStartDate: new Date(savedFilter.filters.customStartDate!),
      }));
    }
    if (savedFilter.filters.customEndDate) {
      setFilters((prev) => ({
        ...prev,
        customEndDate: new Date(savedFilter.filters.customEndDate!),
      }));
    }
  };

  const deleteSavedFilter = async (filterId: string) => {
    try {
      const updated = savedFilters.filter((f) => f.id !== filterId);
      setSavedFilters(updated);
      await AsyncStorage.setItem("savedSearchFilters", JSON.stringify(updated));
      Alert.alert("Thành công", "Đã xóa bộ lọc");
    } catch (error) {
      console.error("Error deleting filter:", error);
    }
  };

  // Generate search suggestions
  useEffect(() => {
    if (searchQuery.length > 0 && searchResults.length > 0) {
      const uniqueSuggestions: SearchSuggestion[] = [];
      const seen = new Set<string>();

      searchResults.forEach((txn) => {
        if (txn.description && !seen.has(txn.description.toLowerCase())) {
          seen.add(txn.description.toLowerCase());
          uniqueSuggestions.push({
            text: txn.description,
            type: "description",
          });
        }
        if (txn.merchantName && !seen.has(txn.merchantName.toLowerCase())) {
          seen.add(txn.merchantName.toLowerCase());
          uniqueSuggestions.push({
            text: txn.merchantName,
            type: "merchant",
          });
        }
      });

      setSuggestions(uniqueSuggestions.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [searchQuery, searchResults]);

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
    if (filters.time === "all") return null;

    if (filters.time === "custom") {
      if (filters.customStartDate && filters.customEndDate) {
        return {
          start: filters.customStartDate.toISOString(),
          end: filters.customEndDate.toISOString(),
        };
      }
      return null;
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (filters.time) {
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
  }, [filters.time, filters.customStartDate, filters.customEndDate]);

  // Calculate statistics
  const calculateStatistics = (results: Transaction[]) => {
    const stats = {
      totalIncome: 0,
      totalExpense: 0,
      netAmount: 0,
      transactionCount: results.length,
    };

    results.forEach((txn) => {
      if (txn.type === "INCOME") {
        stats.totalIncome += txn.amount;
      } else {
        stats.totalExpense += txn.amount;
      }
    });

    stats.netAmount = stats.totalIncome - stats.totalExpense;
    return stats;
  };

  // Perform search with filters using databaseService
  const performSearch = useCallback(
    async (query: string) => {
      if (!userId) return;

      setIsLoading(true);
      try {
        await databaseService.ensureInitialized();

        // Build query options for databaseService
        const options: any = {};

        // Add date range filter
        const dateRange = getDateRange();
        if (dateRange) {
          options.startDate = dateRange.start;
          options.endDate = dateRange.end;
        }

        // Add type filter
        if (filters.type !== "all") {
          options.type = filters.type;
        }

        // Add category filter
        if (filters.categoryId !== undefined && filters.categoryId !== null) {
          options.categoryId = filters.categoryId;
        }

        // Get all transactions from databaseService
        let allTransactions = await databaseService.getTransactionsByUser(
          userId,
          options
        );

        // Ensure allTransactions is an array
        if (!Array.isArray(allTransactions)) {
          console.warn(
            "getTransactionsByUser returned non-array:",
            allTransactions
          );
          allTransactions = [];
        }

        console.log(
          `Loaded ${allTransactions.length} transactions from database`
        );

        // Apply search filter in memory
        if (query.trim() && allTransactions.length > 0) {
          const searchLower = query.trim().toLowerCase();
          allTransactions = allTransactions.filter(
            (txn: any) =>
              (txn.description &&
                txn.description.toLowerCase().includes(searchLower)) ||
              (txn.merchant_name &&
                txn.merchant_name.toLowerCase().includes(searchLower)) ||
              (txn.category_name &&
                txn.category_name.toLowerCase().includes(searchLower)) ||
              (txn.amount && txn.amount.toString().includes(searchLower))
          );
        }

        // Apply amount range filters
        if (filters.minAmount !== undefined && allTransactions.length > 0) {
          allTransactions = allTransactions.filter(
            (txn: any) => txn.amount >= filters.minAmount!
          );
        }
        if (filters.maxAmount !== undefined && allTransactions.length > 0) {
          allTransactions = allTransactions.filter(
            (txn: any) => txn.amount <= filters.maxAmount!
          );
        }

        // Map database rows to Transaction objects
        const mappedResults: Transaction[] = Array.isArray(allTransactions)
          ? allTransactions.map((row: any) => mapRowToTransaction(row))
          : [];

        // Sort results
        const sortBy = filters.sortBy || "date";
        const sortDir = filters.sortDir || "DESC";
        mappedResults.sort((a, b) => {
          let aVal: any;
          let bVal: any;

          if (sortBy === "date") {
            aVal = new Date(a.date).getTime();
            bVal = new Date(b.date).getTime();
          } else if (sortBy === "amount") {
            aVal = a.amount;
            bVal = b.amount;
          } else {
            aVal = a.createdAt
              ? new Date(a.createdAt).getTime()
              : new Date(a.date).getTime();
            bVal = b.createdAt
              ? new Date(b.createdAt).getTime()
              : new Date(b.date).getTime();
          }

          if (sortDir === "ASC") {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
          }
        });

        setSearchResults(mappedResults);
        setStatistics(calculateStatistics(mappedResults));

        // Show notification if results found
        if (mappedResults.length > 0) {
          console.log(`Found ${mappedResults.length} transactions`);
        } else {
          console.log("No transactions found with current filters");
        }
      } catch (error) {
        console.error("Error searching transactions:", error);
        Alert.alert("Lỗi", "Không thể thực hiện tìm kiếm. Vui lòng thử lại.");
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, filters, getDateRange]
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
  }, [searchQuery, filters, userId, performSearch]);

  // Initial load: show all transactions when component mounts
  useEffect(() => {
    if (userId && !isLoading) {
      // Load all transactions on initial mount (only once)
      const timer = setTimeout(() => {
        performSearch("");
      }, 500); // Small delay to ensure database is ready

      return () => clearTimeout(timer);
    }
  }, [userId]); // Only depend on userId, not performSearch

  // Get category info for a transaction
  const getCategoryInfo = (categoryId: string | null | undefined) => {
    if (!categoryId) {
      return {
        name: "Không phân loại",
        icon: "tag",
        color: "#9E9E9E",
      };
    }
    const category = categories.find((cat) => cat.id === categoryId);
    return {
      name: category?.name || "Không phân loại",
      icon: category?.icon || "tag",
      color: category?.color || "#9E9E9E",
    };
  };

  // Handle transaction edit
  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowEditModal(true);
  };

  // Handle transaction delete
  const handleDelete = (transaction: Transaction) => {
    Alert.alert("Xóa giao dịch", "Bạn có chắc chắn muốn xóa giao dịch này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            if (!userId) return;
            await TransactionService.softDelete(transaction.id, userId);
            Alert.alert("Thành công", "Đã xóa giao dịch");
            performSearch(searchQuery); // Refresh results
          } catch (error) {
            console.error("Error deleting transaction:", error);
            Alert.alert("Lỗi", "Không thể xóa giao dịch");
          }
        },
      },
    ]);
  };

  // Handle transaction update
  const handleUpdate = async (updates: Partial<Transaction>) => {
    if (!selectedTransaction || !userId) return;

    try {
      await TransactionService.update(selectedTransaction.id, updates, userId);
      Alert.alert("Thành công", "Đã cập nhật giao dịch");
      setShowEditModal(false);
      setSelectedTransaction(null);
      performSearch(searchQuery); // Refresh results
    } catch (error) {
      console.error("Error updating transaction:", error);
      Alert.alert("Lỗi", "Không thể cập nhật giao dịch");
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      type: "all",
      time: "all",
      sortBy: "date",
      sortDir: "DESC",
    });
    setMinAmountInput("");
    setMaxAmountInput("");
    setSearchQuery("");
  };

  // Prepare chart data
  const prepareChartData = () => {
    // Ensure searchResults is an array
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      return {
        labels: [],
        datasets: [
          {
            data: [],
          },
        ],
      };
    }

    if (chartType === "pie") {
      // Pie chart by category
      const categoryMap = new Map<string, number>();
      searchResults.forEach((txn) => {
        if (txn && txn.categoryId !== undefined && txn.amount !== undefined) {
          const categoryName = getCategoryInfo(txn.categoryId).name;
          const current = categoryMap.get(categoryName) || 0;
          categoryMap.set(categoryName, current + txn.amount);
        }
      });

      const labels = Array.from(categoryMap.keys());
      const data = Array.from(categoryMap.values());

      if (labels.length === 0 || data.length === 0) {
        return {
          labels: ["Không có dữ liệu"],
          datasets: [
            {
              data: [1],
            },
          ],
        };
      }

      return {
        labels,
        datasets: [
          {
            data,
          },
        ],
      };
    } else {
      // Line chart by date
      const dateMap = new Map<string, number>();
      searchResults.forEach((txn) => {
        if (txn && txn.date && txn.amount !== undefined) {
          const dateKey = formatDate(txn.date);
          const current = dateMap.get(dateKey) || 0;
          dateMap.set(dateKey, current + txn.amount);
        }
      });

      const sortedDates = Array.from(dateMap.keys()).sort();
      const labels = sortedDates.slice(0, 10); // Limit to 10 dates
      const data = labels.map((d) => dateMap.get(d) || 0);

      if (labels.length === 0 || data.length === 0) {
        return {
          labels: ["Không có dữ liệu"],
          datasets: [
            {
              data: [0],
              color: (opacity = 1) => themeColor,
              strokeWidth: 2,
            },
          ],
        };
      }

      return {
        labels,
        datasets: [
          {
            data,
            color: (opacity = 1) => themeColor,
            strokeWidth: 2,
          },
        ],
      };
    }
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const categoryInfo = getCategoryInfo(item.categoryId);

    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => {
          setSelectedTransaction(item);
          setShowDetailModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.transactionLeft}>
          <View style={styles.transactionHeader}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: categoryInfo.color + "20" },
              ]}
            >
              <Icon
                name={categoryInfo.icon}
                size={20}
                color={categoryInfo.color}
              />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionCategory}>
                {item.description || "Không có ghi chú"}
              </Text>
              <Text style={styles.transactionCategoryName}>
                {categoryInfo.name}
              </Text>
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
          <View style={styles.transactionActions}>
            <TouchableOpacity
              onPress={() => handleEdit(item)}
              style={styles.actionButton}
            >
              <Icon name="pencil" size={16} color={themeColor} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={styles.actionButton}
            >
              <Icon name="delete" size={16} color="#F44336" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColor }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tìm kiếm & Lọc</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setShowSavedFilters(true)}
              style={styles.headerIconButton}
            >
              <Icon name="bookmark" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setViewMode(viewMode === "list" ? "chart" : "list")
              }
              style={styles.headerIconButton}
            >
              <Icon
                name={
                  viewMode === "list" ? "chart-line" : "format-list-bulleted"
                }
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: themeColor }]}>
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

        {/* Search Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => {
                  setSearchQuery(suggestion.text);
                  setShowSuggestions(false);
                }}
              >
                <Icon
                  name={
                    suggestion.type === "description"
                      ? "text"
                      : suggestion.type === "merchant"
                      ? "store"
                      : "tag"
                  }
                  size={16}
                  color="#666"
                />
                <Text style={styles.suggestionText}>{suggestion.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Filter Button */}
      <View style={styles.filterButtonContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Icon
            name={showFilters ? "chevron-up" : "chevron-down"}
            size={20}
            color={themeColor}
          />
          <Text style={[styles.filterButtonText, { color: themeColor }]}>
            {showFilters ? "Ẩn bộ lọc" : "Hiển thị bộ lọc"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveFilterButton}
          onPress={saveCurrentFilter}
        >
          <Icon name="content-save" size={18} color={themeColor} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <ScrollView
          style={styles.filtersContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Basic Filters */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Bộ lọc cơ bản</Text>

            {/* Type Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Loại giao dịch</Text>
              <View style={styles.filterOptions}>
                {["all", "EXPENSE", "INCOME"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterOption,
                      filters.type === type && [
                        styles.filterOptionActive,
                        { backgroundColor: themeColor },
                      ],
                    ]}
                    onPress={() =>
                      setFilters({ ...filters, type: type as any })
                    }
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filters.type === type && styles.filterOptionTextActive,
                      ]}
                    >
                      {type === "all"
                        ? "Tất cả"
                        : type === "EXPENSE"
                        ? "Chi tiêu"
                        : "Thu nhập"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Time Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Thời gian</Text>
              <View style={styles.filterOptions}>
                {["all", "day", "week", "month", "year", "custom"].map(
                  (time) => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.filterOption,
                        filters.time === time && [
                          styles.filterOptionActive,
                          { backgroundColor: themeColor },
                        ],
                      ]}
                      onPress={() =>
                        setFilters({ ...filters, time: time as any })
                      }
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.time === time &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {time === "all"
                          ? "Tất cả"
                          : time === "day"
                          ? "Hôm nay"
                          : time === "week"
                          ? "Tuần này"
                          : time === "month"
                          ? "Tháng này"
                          : time === "year"
                          ? "Năm nay"
                          : "Tùy chỉnh"}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            {/* Custom Date Range */}
            {filters.time === "custom" && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Khoảng thời gian</Text>
                <View style={styles.dateRangeContainer}>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker("start")}
                  >
                    <Icon name="calendar-start" size={20} color={themeColor} />
                    <Text style={styles.dateButtonText}>
                      {filters.customStartDate
                        ? formatDate(filters.customStartDate.toISOString())
                        : "Từ ngày"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker("end")}
                  >
                    <Icon name="calendar-end" size={20} color={themeColor} />
                    <Text style={styles.dateButtonText}>
                      {filters.customEndDate
                        ? formatDate(filters.customEndDate.toISOString())
                        : "Đến ngày"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Sort Options */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Sắp xếp</Text>
              <View style={styles.sortContainer}>
                <View style={styles.sortRow}>
                  <Text style={styles.sortLabel}>Theo:</Text>
                  {["date", "amount", "created_at"].map((sortBy) => (
                    <TouchableOpacity
                      key={sortBy}
                      style={[
                        styles.sortOption,
                        filters.sortBy === sortBy && [
                          styles.sortOptionActive,
                          { backgroundColor: themeColor },
                        ],
                      ]}
                      onPress={() =>
                        setFilters({ ...filters, sortBy: sortBy as any })
                      }
                    >
                      <Text
                        style={[
                          styles.sortOptionText,
                          filters.sortBy === sortBy &&
                            styles.sortOptionTextActive,
                        ]}
                      >
                        {sortBy === "date"
                          ? "Ngày"
                          : sortBy === "amount"
                          ? "Số tiền"
                          : "Ngày tạo"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.sortRow}>
                  <Text style={styles.sortLabel}>Thứ tự:</Text>
                  {["ASC", "DESC"].map((sortDir) => (
                    <TouchableOpacity
                      key={sortDir}
                      style={[
                        styles.sortOption,
                        filters.sortDir === sortDir && [
                          styles.sortOptionActive,
                          { backgroundColor: themeColor },
                        ],
                      ]}
                      onPress={() =>
                        setFilters({ ...filters, sortDir: sortDir as any })
                      }
                    >
                      <Text
                        style={[
                          styles.sortOptionText,
                          filters.sortDir === sortDir &&
                            styles.sortOptionTextActive,
                        ]}
                      >
                        {sortDir === "ASC" ? "Tăng dần" : "Giảm dần"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Advanced Filters */}
          <TouchableOpacity
            style={styles.advancedFilterToggle}
            onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Text style={styles.advancedFilterToggleText}>
              {showAdvancedFilters ? "Ẩn" : "Hiển thị"} bộ lọc nâng cao
            </Text>
            <Icon
              name={showAdvancedFilters ? "chevron-up" : "chevron-down"}
              size={20}
              color={themeColor}
            />
          </TouchableOpacity>

          {showAdvancedFilters && (
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Bộ lọc nâng cao</Text>

              {/* Category Filter */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Danh mục</Text>
                <TouchableOpacity
                  style={styles.categoryPickerButton}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={styles.categoryPickerText}>
                    {filters.categoryId
                      ? getCategoryInfo(filters.categoryId).name
                      : "Tất cả danh mục"}
                  </Text>
                  <Icon name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Amount Range */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Khoảng số tiền</Text>
                <View style={styles.amountRangeContainer}>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Từ"
                    value={minAmountInput}
                    onChangeText={setMinAmountInput}
                    keyboardType="numeric"
                    onBlur={() => {
                      const amount = parseFloat(minAmountInput);
                      if (!isNaN(amount)) {
                        setFilters({ ...filters, minAmount: amount });
                      } else if (minAmountInput === "") {
                        setFilters({ ...filters, minAmount: undefined });
                      }
                    }}
                  />
                  <Text style={styles.amountRangeSeparator}>-</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Đến"
                    value={maxAmountInput}
                    onChangeText={setMaxAmountInput}
                    keyboardType="numeric"
                    onBlur={() => {
                      const amount = parseFloat(maxAmountInput);
                      if (!isNaN(amount)) {
                        setFilters({ ...filters, maxAmount: amount });
                      } else if (maxAmountInput === "") {
                        setFilters({ ...filters, maxAmount: undefined });
                      }
                    }}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Reset Filters Button */}
          <TouchableOpacity
            style={styles.resetFiltersButton}
            onPress={resetFilters}
          >
            <Icon name="refresh" size={18} color="#F44336" />
            <Text style={styles.resetFiltersText}>Đặt lại bộ lọc</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Statistics Bar */}
      {searchResults.length > 0 && (
        <View style={styles.statisticsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tổng thu</Text>
            <Text style={[styles.statValue, { color: "#4CAF50" }]}>
              {formatAmount(statistics.totalIncome)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tổng chi</Text>
            <Text style={[styles.statValue, { color: "#F44336" }]}>
              {formatAmount(statistics.totalExpense)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Số dư</Text>
            <Text
              style={[
                styles.statValue,
                {
                  color: statistics.netAmount >= 0 ? "#4CAF50" : "#F44336",
                },
              ]}
            >
              {formatAmount(statistics.netAmount)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Số giao dịch</Text>
            <Text style={styles.statValue}>{statistics.transactionCount}</Text>
          </View>
        </View>
      )}

      {/* Results */}
      <View style={styles.resultsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColor} />
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="magnify" size={64} color="#E0E0E0" />
            <Text style={styles.emptyText}>
              {searchQuery.trim() === "" &&
              filters.type === "all" &&
              filters.time === "all" &&
              !filters.categoryId &&
              !filters.minAmount &&
              !filters.maxAmount
                ? "Nhập từ khóa để tìm kiếm hoặc chọn bộ lọc"
                : "Không tìm thấy kết quả"}
            </Text>
          </View>
        ) : viewMode === "list" ? (
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
        ) : (
          <ScrollView style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Biểu đồ thống kê</Text>
              <View style={styles.chartTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.chartTypeButton,
                    chartType === "pie" && [
                      styles.chartTypeButtonActive,
                      { backgroundColor: themeColor },
                    ],
                  ]}
                  onPress={() => setChartType("pie")}
                >
                  <Text
                    style={[
                      styles.chartTypeButtonText,
                      chartType === "pie" && styles.chartTypeButtonTextActive,
                    ]}
                  >
                    Tròn
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chartTypeButton,
                    chartType === "line" && [
                      styles.chartTypeButtonActive,
                      { backgroundColor: themeColor },
                    ],
                  ]}
                  onPress={() => setChartType("line")}
                >
                  <Text
                    style={[
                      styles.chartTypeButtonText,
                      chartType === "line" && styles.chartTypeButtonTextActive,
                    ]}
                  >
                    Đường
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {(() => {
              const chartData = prepareChartData();
              if (
                !chartData ||
                !chartData.labels ||
                chartData.labels.length === 0
              ) {
                return (
                  <View style={styles.emptyState}>
                    <Icon name="chart-line" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>
                      Không có dữ liệu để hiển thị
                    </Text>
                  </View>
                );
              }

              return chartType === "pie" ? (
                <PieChart
                  data={chartData as any}
                  width={width - 40}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  }}
                  accessor="value"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              ) : (
                <LineChart
                  data={chartData as any}
                  width={width - 40}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => themeColor,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                  }}
                  bezier
                  style={{
                    marginVertical: 8,
                    borderRadius: 16,
                  }}
                />
              );
            })()}
          </ScrollView>
        )}
      </View>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn danh mục</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: null, name: "Tất cả danh mục" }, ...categories]}
              keyExtractor={(item) => item.id || "all"}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryOption}
                  onPress={() => {
                    setFilters({
                      ...filters,
                      categoryId: item.id || undefined,
                    });
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.categoryOptionText}>{item.name}</Text>
                  {filters.categoryId === item.id && (
                    <Icon name="check" size={20} color={themeColor} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={
            showDatePicker === "start"
              ? filters.customStartDate || new Date()
              : filters.customEndDate || new Date()
          }
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            if (selectedDate) {
              if (showDatePicker === "start") {
                setFilters({
                  ...filters,
                  customStartDate: selectedDate,
                });
              } else {
                setFilters({
                  ...filters,
                  customEndDate: selectedDate,
                });
              }
            }
            setShowDatePicker(null);
          }}
        />
      )}

      {/* Transaction Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTransaction && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Chi tiết giao dịch</Text>
                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                    style={styles.modalCloseButton}
                  >
                    <Icon name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.detailContent}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mô tả:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.description || "Không có"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Số tiền:</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        selectedTransaction.type === "EXPENSE"
                          ? { color: "#F44336" }
                          : { color: "#4CAF50" },
                      ]}
                    >
                      {selectedTransaction.type === "EXPENSE" ? "-" : "+"}
                      {formatAmount(selectedTransaction.amount)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Loại:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.type === "EXPENSE"
                        ? "Chi tiêu"
                        : "Thu nhập"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Danh mục:</Text>
                    <Text style={styles.detailValue}>
                      {getCategoryInfo(selectedTransaction.categoryId).name}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Ngày:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedTransaction.date)}
                    </Text>
                  </View>
                  {selectedTransaction.merchantName && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Cửa hàng:</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.merchantName}
                      </Text>
                    </View>
                  )}
                  {selectedTransaction.paymentMethod && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phương thức:</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.paymentMethod}
                      </Text>
                    </View>
                  )}
                </ScrollView>
                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={[
                      styles.detailActionButton,
                      { backgroundColor: themeColor },
                    ]}
                    onPress={() => {
                      setShowDetailModal(false);
                      handleEdit(selectedTransaction);
                    }}
                  >
                    <Icon name="pencil" size={18} color="#fff" />
                    <Text style={styles.detailActionText}>Chỉnh sửa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.detailActionButton,
                      { backgroundColor: "#F44336" },
                    ]}
                    onPress={() => {
                      setShowDetailModal(false);
                      handleDelete(selectedTransaction);
                    }}
                  >
                    <Icon name="delete" size={18} color="#fff" />
                    <Text style={styles.detailActionText}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTransaction && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Chỉnh sửa giao dịch</Text>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(false)}
                    style={styles.modalCloseButton}
                  >
                    <Icon name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <EditTransactionForm
                  transaction={selectedTransaction}
                  categories={categories}
                  onSave={handleUpdate}
                  onCancel={() => setShowEditModal(false)}
                  themeColor={themeColor}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Save Filter Modal */}
      <Modal
        visible={showSaveFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSaveFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lưu bộ lọc</Text>
              <TouchableOpacity
                onPress={() => setShowSaveFilterModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.editForm}>
              <View style={styles.editFormGroup}>
                <Text style={styles.editFormLabel}>Tên bộ lọc</Text>
                <TextInput
                  style={styles.editFormInput}
                  value={filterNameInput}
                  onChangeText={setFilterNameInput}
                  placeholder="Nhập tên cho bộ lọc này"
                  autoFocus={true}
                />
              </View>
              <View style={styles.editFormActions}>
                <TouchableOpacity
                  style={[styles.editFormButton, styles.editFormCancelButton]}
                  onPress={() => {
                    setShowSaveFilterModal(false);
                    setFilterNameInput("");
                  }}
                >
                  <Text style={styles.editFormCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.editFormButton,
                    { backgroundColor: themeColor },
                  ]}
                  onPress={confirmSaveFilter}
                >
                  <Text style={styles.editFormSaveText}>Lưu</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Saved Filters Modal */}
      <Modal
        visible={showSavedFilters}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSavedFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bộ lọc đã lưu</Text>
              <TouchableOpacity
                onPress={() => setShowSavedFilters(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {savedFilters.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="bookmark-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Chưa có bộ lọc đã lưu</Text>
              </View>
            ) : (
              <FlatList
                data={savedFilters}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.savedFilterItem}>
                    <TouchableOpacity
                      style={styles.savedFilterContent}
                      onPress={() => loadSavedFilter(item)}
                    >
                      <Icon name="bookmark" size={20} color={themeColor} />
                      <View style={styles.savedFilterInfo}>
                        <Text style={styles.savedFilterName}>{item.name}</Text>
                        <Text style={styles.savedFilterDate}>
                          {formatDate(item.createdAt)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteSavedFilter(item.id)}
                      style={styles.deleteFilterButton}
                    >
                      <Icon name="delete" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Edit Transaction Form Component
interface EditTransactionFormProps {
  transaction: Transaction;
  categories: Category[];
  onSave: (updates: Partial<Transaction>) => void;
  onCancel: () => void;
  themeColor: string;
}

const EditTransactionForm = ({
  transaction,
  categories,
  onSave,
  onCancel,
  themeColor,
}: EditTransactionFormProps) => {
  const [description, setDescription] = useState(transaction.description || "");
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [selectedCategory, setSelectedCategory] = useState(
    transaction.categoryId
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền hợp lệ");
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<Transaction> = {
        description: description.trim() || undefined,
        amount: parseFloat(amount),
        categoryId: selectedCategory || null,
      };
      onSave(updates);
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.editForm}>
      <View style={styles.editFormGroup}>
        <Text style={styles.editFormLabel}>Mô tả</Text>
        <TextInput
          style={styles.editFormInput}
          value={description}
          onChangeText={setDescription}
          placeholder="Nhập mô tả"
        />
      </View>

      <View style={styles.editFormGroup}>
        <Text style={styles.editFormLabel}>Số tiền</Text>
        <TextInput
          style={styles.editFormInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Nhập số tiền"
        />
      </View>

      <View style={styles.editFormGroup}>
        <Text style={styles.editFormLabel}>Danh mục</Text>
        <TouchableOpacity
          style={styles.editFormCategoryButton}
          onPress={() => setShowCategoryPicker(true)}
        >
          <Text style={styles.editFormCategoryText}>
            {selectedCategory
              ? categories.find((c) => c.id === selectedCategory)?.name ||
                "Chọn danh mục"
              : "Chọn danh mục"}
          </Text>
          <Icon name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.editFormActions}>
        <TouchableOpacity
          style={[styles.editFormButton, styles.editFormCancelButton]}
          onPress={onCancel}
        >
          <Text style={styles.editFormCancelText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.editFormButton, { backgroundColor: themeColor }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.editFormSaveText}>Lưu</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Picker for Edit */}
      <Modal
        visible={showCategoryPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn danh mục</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories.filter((c) => c.type === transaction.type)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryOption}
                  onPress={() => {
                    setSelectedCategory(item.id);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.categoryOptionText}>{item.name}</Text>
                  {selectedCategory === item.id && (
                    <Icon name="check" size={20} color={themeColor} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    backgroundColor: "#2196F3",
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconButton: {
    marginLeft: 12,
    padding: 4,
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
    borderRadius: 8,
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
  suggestionsContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  suggestionText: {
    fontSize: 14,
    color: "#333",
  },
  filterButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterButtonText: {
    color: "#2196F3",
    fontSize: 16,
    fontWeight: "500",
    marginRight: 8,
  },
  saveFilterButton: {
    padding: 4,
  },
  filtersContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    maxHeight: 400,
  },
  filterSection: {
    padding: 16,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  filterGroup: {
    marginBottom: 16,
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
  dateRangeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  dateButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#333",
  },
  sortContainer: {
    marginTop: 8,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sortLabel: {
    fontSize: 14,
    color: "#666",
    marginRight: 12,
    minWidth: 60,
  },
  sortOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    marginRight: 8,
  },
  sortOptionActive: {
    backgroundColor: "#2196F3",
  },
  sortOptionText: {
    fontSize: 13,
    color: "#666",
  },
  sortOptionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  advancedFilterToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F5F5F5",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  advancedFilterToggleText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2196F3",
  },
  categoryPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  categoryPickerText: {
    fontSize: 14,
    color: "#333",
  },
  amountRangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  amountInput: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    fontSize: 14,
    color: "#333",
    marginHorizontal: 4,
  },
  amountRangeSeparator: {
    fontSize: 16,
    color: "#666",
    marginHorizontal: 8,
  },
  resetFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#FFEBEE",
    margin: 16,
    borderRadius: 8,
  },
  resetFiltersText: {
    color: "#F44336",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  statisticsBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
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
  transactionActions: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 4,
  },
  chartContainer: {
    padding: 20,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  chartTypeSelector: {
    flexDirection: "row",
  },
  chartTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    marginLeft: 8,
  },
  chartTypeButtonActive: {
    backgroundColor: "#2196F3",
  },
  chartTypeButtonText: {
    fontSize: 13,
    color: "#666",
  },
  chartTypeButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalCloseButton: {
    padding: 4,
  },
  categoryOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  categoryOptionText: {
    fontSize: 14,
    color: "#333",
  },
  detailContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    textAlign: "right",
  },
  detailActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  detailActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  detailActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  savedFilterItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  savedFilterContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  savedFilterInfo: {
    marginLeft: 12,
    flex: 1,
  },
  savedFilterName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  savedFilterDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  deleteFilterButton: {
    padding: 8,
  },
  editForm: {
    padding: 16,
  },
  editFormGroup: {
    marginBottom: 16,
  },
  editFormLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  editFormInput: {
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    fontSize: 14,
    color: "#333",
  },
  editFormCategoryButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  editFormCategoryText: {
    fontSize: 14,
    color: "#333",
  },
  editFormActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  editFormButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  editFormCancelButton: {
    backgroundColor: "#F5F5F5",
    marginRight: 8,
  },
  editFormCancelText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },
  editFormSaveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default Timkiem;

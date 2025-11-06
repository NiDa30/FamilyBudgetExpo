import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // ISO date string
  createdAt: string; // ISO date string
}

const GoalTracker = () => {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);

  // Load goals from AsyncStorage
  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const storedGoals = await AsyncStorage.getItem("financialGoals");
      if (storedGoals) {
        setGoals(JSON.parse(storedGoals));
      }
    } catch (error) {
      console.error("Error loading goals:", error);
    }
  };

  const saveGoals = async (newGoals: FinancialGoal[]) => {
    try {
      await AsyncStorage.setItem("financialGoals", JSON.stringify(newGoals));
      setGoals(newGoals);
    } catch (error) {
      console.error("Error saving goals:", error);
    }
  };

  const addGoal = (name: string, targetAmount: number, deadline: string) => {
    const newGoal: FinancialGoal = {
      id: Date.now().toString(),
      name,
      targetAmount,
      currentAmount: 0,
      deadline,
      createdAt: new Date().toISOString(),
    };

    const updatedGoals = [...goals, newGoal];
    saveGoals(updatedGoals);
    setShowAddGoal(false);
  };

  const deleteGoal = (id: string) => {
    Alert.alert("Xóa mục tiêu", "Bạn có chắc chắn muốn xóa mục tiêu này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          const updatedGoals = goals.filter((goal) => goal.id !== id);
          saveGoals(updatedGoals);
        },
      },
    ]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  };

  const getDaysRemaining = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProgressPercentage = (current: number, target: number) => {
    return target > 0 ? Math.min((current / target) * 100, 100) : 0;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mục tiêu tài chính</Text>
        <TouchableOpacity
          style={styles.headerAddButton}
          onPress={() => setShowAddGoal(true)}
        >
          <Icon name="plus" size={20} color="#1E88E5" />
        </TouchableOpacity>
      </View>

      {goals.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="bullseye" size={48} color="#BDBDBD" />
          <Text style={styles.emptyText}>Chưa có mục tiêu nào</Text>
          <Text style={styles.emptySubtext}>Tạo mục tiêu đầu tiên của bạn</Text>
        </View>
      ) : (
        <View style={styles.goalsList}>
          {goals.map((goal) => {
            const progress = getProgressPercentage(
              goal.currentAmount,
              goal.targetAmount
            );
            const daysRemaining = getDaysRemaining(goal.deadline);
            const isOverdue = daysRemaining < 0;

            return (
              <View key={goal.id} style={styles.goalItem}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <TouchableOpacity onPress={() => deleteGoal(goal.id)}>
                    <Icon name="trash-can-outline" size={20} color="#757575" />
                  </TouchableOpacity>
                </View>

                <View style={styles.goalAmounts}>
                  <Text style={styles.currentAmount}>
                    {formatCurrency(goal.currentAmount)}
                  </Text>
                  <Text style={styles.targetAmount}>
                    / {formatCurrency(goal.targetAmount)}
                  </Text>
                </View>

                <View style={styles.progressBarContainer}>
                  <View
                    style={[styles.progressBar, { width: `${progress}%` }]}
                  />
                </View>

                <View style={styles.goalDetails}>
                  <View style={styles.detailItem}>
                    <Icon name="progress-clock" size={16} color="#757575" />
                    <Text style={styles.detailText}>
                      {progress.toFixed(0)}% hoàn thành
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Icon
                      name={isOverdue ? "calendar-alert" : "calendar-clock"}
                      size={16}
                      color={isOverdue ? "#F44336" : "#757575"}
                    />
                    <Text
                      style={[
                        styles.detailText,
                        isOverdue && styles.overdueText,
                      ]}
                    >
                      {isOverdue ? "Quá hạn" : `${daysRemaining} ngày`}
                    </Text>
                  </View>
                </View>

                <View style={styles.deadlineContainer}>
                  <Text style={styles.deadlineText}>
                    Hạn chót: {formatDate(goal.deadline)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && (
        <AddGoalModal onAdd={addGoal} onCancel={() => setShowAddGoal(false)} />
      )}
    </View>
  );
};

const AddGoalModal = ({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, targetAmount: number, deadline: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  const handleAdd = () => {
    if (!name.trim() || !targetAmount || !deadline) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin");
      return;
    }

    const amount = parseFloat(targetAmount.replace(/[^0-9]/g, ""));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Lỗi", "Số tiền không hợp lệ");
      return;
    }

    onAdd(name, amount, deadline);
    setName("");
    setTargetAmount("");
    setDeadline("");
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Thêm mục tiêu mới</Text>
          <TouchableOpacity onPress={onCancel}>
            <Icon name="close" size={24} color="#757575" />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tên mục tiêu</Text>
          <View style={styles.inputContainer}>
            <Icon name="bullseye" size={20} color="#757575" />
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: Mua xe máy, Du lịch"
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Số tiền mục tiêu</Text>
          <View style={styles.inputContainer}>
            <Icon name="currency-usd" size={20} color="#757575" />
            <TextInput
              style={styles.input}
              placeholder="0"
              value={targetAmount}
              onChangeText={setTargetAmount}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Hạn chót</Text>
          <View style={styles.inputContainer}>
            <Icon name="calendar" size={20} color="#757575" />
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={deadline}
              onChangeText={setDeadline}
            />
          </View>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalAddButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>Thêm</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  headerAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    color: "#757575",
    marginTop: 12,
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9E9E9E",
    marginTop: 4,
  },
  goalsList: {
    gap: 16,
  },
  goalItem: {
    padding: 16,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  goalName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
    flex: 1,
  },
  goalAmounts: {
    flexDirection: "row",
    marginBottom: 12,
  },
  currentAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E88E5",
  },
  targetAmount: {
    fontSize: 16,
    color: "#757575",
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#EEEEEE",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#1E88E5",
  },
  goalDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 13,
    color: "#757575",
    marginLeft: 4,
  },
  overdueText: {
    color: "#F44336",
  },
  deadlineContainer: {
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 12,
  },
  deadlineText: {
    fontSize: 13,
    color: "#757575",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#212121",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#212121",
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#757575",
    fontWeight: "500",
  },
  modalAddButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#1E88E5",
  },
  addButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
});

export default GoalTracker;

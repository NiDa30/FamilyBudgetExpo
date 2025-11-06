import { ScrollView, StyleSheet, View } from "react-native";
import BudgetSuggestion from "./BudgetSuggestion";
import GoalTracker from "./GoalTracker";

interface BudgetDashboardProps {
  totalIncome: number;
  totalExpense: number;
}

const BudgetDashboard = ({
  totalIncome,
  totalExpense,
}: BudgetDashboardProps) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BudgetSuggestion totalIncome={totalIncome} totalExpense={totalExpense} />
      <GoalTracker />
      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default BudgetDashboard;

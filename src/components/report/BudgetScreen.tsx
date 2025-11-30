import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { BudgetAndGoalsOverview } from "../budget";
import { Category } from "../../domain/types";

interface BudgetScreenProps {
  monthlyIncome: number;
  lastMonthsExpenses: Array<{ month: string; total: number }>;
  categories: Category[];
  budgetAlerts: any[];
  goals: any[];
  categoryBudgets: any[];
  spendingTrends: any[];
  adjustmentSuggestions: any[];
  budgetRule: {
    needsPercent: number;
    wantsPercent: number;
    savingsPercent: number;
  };
  themeColor: string;
  onReloadData: () => void;
  formatCurrency: (amount: number) => string;
}

export const BudgetScreen: React.FC<BudgetScreenProps> = ({
  monthlyIncome,
  lastMonthsExpenses,
  categories,
  budgetAlerts,
  goals,
  categoryBudgets,
  spendingTrends,
  adjustmentSuggestions,
  budgetRule,
  themeColor,
  onReloadData,
  formatCurrency,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BudgetAndGoalsOverview
        monthlyIncome={monthlyIncome}
        lastMonthsExpenses={lastMonthsExpenses}
        categories={categories}
        budgetAlerts={budgetAlerts}
        goals={goals}
        categoryBudgets={categoryBudgets}
        spendingTrends={spendingTrends}
        adjustmentSuggestions={adjustmentSuggestions}
        budgetRule={budgetRule}
        themeColor={themeColor}
        onReloadData={onReloadData}
        formatCurrency={formatCurrency}
      />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});


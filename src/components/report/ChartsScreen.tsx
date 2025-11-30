import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { BarChart, LineChart, PieChart } from "../charts";

interface ChartsScreenProps {
  pieChartExpenseData: Array<{
    name: string;
    amount: number;
    color: string;
  }>;
  pieChartIncomeData: Array<{
    name: string;
    amount: number;
    color: string;
  }>;
  barChartData: {
    labels: string[];
    datasets: Array<{
      data: number[];
      color: (opacity?: number) => string;
    }>;
  };
  lineChartData: {
    labels: string[];
    datasets: Array<{
      data: number[];
      color: (opacity?: number) => string;
      strokeWidth?: number;
    }>;
  };
  totalIncome: number;
  totalExpense: number;
  themeColor: string;
}

export const ChartsScreen: React.FC<ChartsScreenProps> = ({
  pieChartExpenseData,
  pieChartIncomeData,
  barChartData,
  lineChartData,
  totalIncome,
  totalExpense,
  themeColor,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Pie Charts */}
      <PieChart
        data={pieChartExpenseData}
        title="Phân loại Chi tiêu"
        total={totalExpense}
      />
      <PieChart
        data={pieChartIncomeData}
        title="Phân loại Thu nhập"
        total={totalIncome}
      />

      {/* Bar Chart - Monthly Comparison */}
      <BarChart
        data={barChartData}
        title="So sánh Thu nhập & Chi tiêu theo Tháng"
        yAxisLabel=""
        yAxisSuffix="K ₫"
        themeColor={themeColor}
      />

      {/* Line Chart - Trend */}
      <LineChart
        data={lineChartData}
        title="Xu hướng Thu nhập & Chi tiêu"
        yAxisLabel=""
        yAxisSuffix="K ₫"
        themeColor={themeColor}
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


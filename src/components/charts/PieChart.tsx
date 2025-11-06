// src/components/charts/PieChart.tsx
import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { PieChart as RNPieChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

interface PieChartData {
  name: string;
  amount: number;
  color: string;
  legendFontColor?: string;
  legendFontSize?: number;
}

interface PieChartProps {
  data: PieChartData[];
  title: string;
  total: number;
}

export const PieChart: React.FC<PieChartProps> = ({ data, title, total }) => {
  if (!data || data.length === 0 || total === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Chưa có dữ liệu</Text>
        </View>
      </View>
    );
  }

  const chartData = data.map((item) => ({
    name: item.name,
    amount: item.amount,
    color: item.color,
    legendFontColor: item.legendFontColor || "#7F7F7F",
    legendFontSize: item.legendFontSize || 12,
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <RNPieChart
        data={chartData}
        width={screenWidth - 64}
        height={220}
        chartConfig={{
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        accessor="amount"
        backgroundColor="transparent"
        paddingLeft="15"
        style={styles.chart}
        absolute
      />
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
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212121",
    marginBottom: 20,
  },
  chart: {
    marginVertical: 8,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9E9E9E",
  },
});


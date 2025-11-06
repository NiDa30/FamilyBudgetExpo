// src/components/charts/LineChart.tsx
import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart as RNLineChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;

interface LineChartProps {
  data: {
    labels: string[];
    datasets: {
      data: number[];
      color?: (opacity: number) => string;
      strokeWidth?: number;
    }[];
  };
  title: string;
  yAxisLabel?: string;
  yAxisSuffix?: string;
  themeColor?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  yAxisLabel = "",
  yAxisSuffix = "₫",
  themeColor = "#1E88E5",
}) => {
  if (!data || !data.labels || data.labels.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Chưa có dữ liệu</Text>
        </View>
      </View>
    );
  }

  const chartData = {
    labels: data.labels,
    datasets: data.datasets.map((dataset) => ({
      data: dataset.data,
      color: dataset.color || ((opacity = 1) => themeColor),
      strokeWidth: dataset.strokeWidth || 2,
    })),
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <RNLineChart
        data={chartData}
        width={screenWidth - 64}
        height={220}
        yAxisLabel={yAxisLabel}
        yAxisSuffix={yAxisSuffix}
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
          propsForBackgroundLines: {
            strokeDasharray: "",
            stroke: "#E0E0E0",
            strokeWidth: 1,
          },
        }}
        style={styles.chart}
        bezier
        fromZero
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
    borderRadius: 16,
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


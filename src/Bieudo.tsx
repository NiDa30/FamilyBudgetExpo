import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

type ChartScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Bieudo'>;

const { width } = Dimensions.get('window');

const ChartScreen = () => {
  const navigation = useNavigation<ChartScreenNavigationProp>();
  const [activeTab, setActiveTab] = useState<'chart' | 'stats'>('chart');
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Dữ liệu mẫu cho biểu đồ chi tiêu
  const expenseCategories = [
    { name: 'Ăn uống', amount: 2500000, color: '#FF6B6B', icon: 'food-apple', percentage: 45 },
    { name: 'Giao thông', amount: 1500000, color: '#4ECDC4', icon: 'bus', percentage: 27 },
    { name: 'Mua sắm', amount: 1000000, color: '#95E1D3', icon: 'shopping', percentage: 18 },
    { name: 'Giải trí', amount: 550000, color: '#FFD93D', icon: 'movie', percentage: 10 },
  ];

  // Dữ liệu mẫu cho biểu đồ thu nhập
  const incomeCategories = [
    { name: 'Lương', amount: 15000000, color: '#4CAF50', icon: 'cash-multiple', percentage: 75 },
    { name: 'Thưởng', amount: 3000000, color: '#8BC34A', icon: 'gift', percentage: 15 },
    { name: 'Đầu tư', amount: 2000000, color: '#66BB6A', icon: 'chart-line', percentage: 10 },
  ];

  const totalExpense = expenseCategories.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = incomeCategories.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpense;

  const DonutChart = ({ 
    data, 
    title, 
    total, 
    type 
  }: { 
    data: any[], 
    title: string, 
    total: number,
    type: 'expense' | 'income' 
  }) => {
    if (total === 0) {
      return (
        <View style={styles.chartContainer}>
          <View style={styles.emptyChartWrapper}>
            <View style={styles.emptyCircle}>
              <Icon name="chart-donut" size={48} color="#E0E0E0" />
            </View>
            <Text style={styles.emptyChartTitle}>{title}</Text>
            <Text style={styles.emptyChartText}>Chưa có dữ liệu</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartSectionTitle}>{title}</Text>
        
        {/* Donut Chart Visual */}
        <View style={styles.donutWrapper}>
          <View style={styles.outerCircle}>
            {/* Segments would be drawn here with actual chart library */}
            <View style={styles.donutSegments}>
              {data.map((item, index) => (
                <View 
                  key={index}
                  style={[
                    styles.segmentIndicator,
                    { backgroundColor: item.color }
                  ]}
                />
              ))}
            </View>
            
            <View style={styles.innerCircle}>
              <Text style={styles.totalLabel}>Tổng {type === 'expense' ? 'chi' : 'thu'}</Text>
              <Text style={[
                styles.totalAmount,
                type === 'expense' ? styles.expenseText : styles.incomeText
              ]}>
                {(total / 1000000).toFixed(1)}M
              </Text>
            </View>
          </View>
        </View>

        {/* Legend & Breakdown */}
        <View style={styles.legendContainer}>
          {data.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <View style={[styles.categoryIconSmall, { backgroundColor: item.color }]}>
                  <Icon name={item.icon} size={16} color="#fff" />
                </View>
                <View style={styles.legendTextWrapper}>
                  <Text style={styles.legendName}>{item.name}</Text>
                  <Text style={styles.legendPercentage}>{item.percentage}%</Text>
                </View>
              </View>
              <Text style={styles.legendAmount}>
                {(item.amount / 1000).toLocaleString()}K ₫
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const PeriodButton = ({ period, label }: { period: string, label: string }) => (
    <TouchableOpacity
      style={[
        styles.periodButton,
        selectedPeriod === period && styles.periodButtonActive
      ]}
      onPress={() => setSelectedPeriod(period)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.periodButtonText,
        selectedPeriod === period && styles.periodButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusBar}>
          <Text style={styles.statusTime}>09:47</Text>
          <View style={styles.statusIcons}>
            <Icon name="volume-variant-off" size={16} color="#fff" />
            <Icon name="signal-cellular-3" size={16} color="#fff" style={{ marginLeft: 6 }} />
            <Text style={styles.statusBattery}>58%</Text>
            <Icon name="battery-60" size={18} color="#fff" style={{ marginLeft: 2 }} />
          </View>
        </View>

        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Báo cáo & Thống kê</Text>
          <TouchableOpacity style={styles.moreButton} activeOpacity={0.8}>
            <Icon name="dots-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrapper}>
            <Icon name="arrow-up" size={24} color="#F44336" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Tổng chi tiêu</Text>
            <Text style={styles.summaryAmount}>
              {(totalExpense / 1000000).toFixed(1)}M ₫
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconWrapper, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
            <Icon name="arrow-down" size={24} color="#4CAF50" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Tổng thu nhập</Text>
            <Text style={styles.summaryAmount}>
              {(totalIncome / 1000000).toFixed(1)}M ₫
            </Text>
          </View>
        </View>

        <View style={[styles.summaryCard, styles.summaryCardWide]}>
          <View style={[
            styles.summaryIconWrapper, 
            { backgroundColor: balance >= 0 ? 'rgba(33, 150, 243, 0.15)' : 'rgba(244, 67, 54, 0.15)' }
          ]}>
            <Icon name="wallet" size={24} color={balance >= 0 ? '#1E88E5' : '#F44336'} />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Số dư</Text>
            <Text style={[
              styles.summaryAmount,
              { color: balance >= 0 ? '#1E88E5' : '#F44336' }
            ]}>
              {balance >= 0 ? '+' : ''}{(balance / 1000000).toFixed(1)}M ₫
            </Text>
          </View>
        </View>
      </View>

      {/* Period Filter */}
      <View style={styles.periodSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodScroll}
        >
          <PeriodButton period="week" label="Tuần" />
          <PeriodButton period="month" label="Tháng" />
          <PeriodButton period="quarter" label="Quý" />
          <PeriodButton period="year" label="Năm" />
          <TouchableOpacity style={styles.calendarButton} activeOpacity={0.7}>
            <Icon name="calendar-range" size={20} color="#1E88E5" />
            <Text style={styles.calendarButtonText}>Tùy chỉnh</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chart' && styles.activeTab]}
          onPress={() => setActiveTab('chart')}
          activeOpacity={0.7}
        >
          <Icon 
            name="chart-donut" 
            size={22} 
            color={activeTab === 'chart' ? '#1E88E5' : '#9E9E9E'} 
          />
          <Text style={[styles.tabText, activeTab === 'chart' && styles.activeTabText]}>
            Biểu đồ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
          onPress={() => setActiveTab('stats')}
          activeOpacity={0.7}
        >
          <Icon 
            name="chart-bar" 
            size={22} 
            color={activeTab === 'stats' ? '#1E88E5' : '#9E9E9E'} 
          />
          <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
            Thống kê
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <DonutChart 
          data={expenseCategories} 
          title="Phân loại chi tiêu" 
          total={totalExpense}
          type="expense"
        />
        <DonutChart 
          data={incomeCategories} 
          title="Phân loại thu nhập" 
          total={totalIncome}
          type="income"
        />
        
        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#1E88E5',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  statusTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBattery: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  summarySection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  summaryCard: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCardWide: {
    minWidth: '100%',
  },
  summaryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 4,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  periodSection: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  periodScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  periodButtonActive: {
    backgroundColor: '#1E88E5',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    gap: 6,
  },
  calendarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E88E5',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#1E88E5',
  },
  tabText: {
    fontSize: 14,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1E88E5',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  chartContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chartSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  donutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  outerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutSegments: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 4,
    top: 8,
    left: 8,
    right: 8,
  },
  segmentIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  innerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 4,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '700',
  },
  expenseText: {
    color: '#F44336',
  },
  incomeText: {
    color: '#4CAF50',
  },
  legendContainer: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  legendDot: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  categoryIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  legendTextWrapper: {
    flex: 1,
  },
  legendName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  legendPercentage: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '500',
  },
  legendAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#424242',
  },
  emptyChartWrapper: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyChartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  emptyChartText: {
    fontSize: 14,
    color: '#9E9E9E',
  },
});

export default ChartScreen;
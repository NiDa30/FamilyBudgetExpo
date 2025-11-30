/**
 * Export Service
 * Handles data export to CSV, PDF, and Excel formats
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import databaseService from '../database/databaseService';
import { auth } from '../firebaseConfig';

// Type fix for expo-file-system
const FS = FileSystem as any;

export interface ExportOptions {
  format: 'csv' | 'pdf' | 'json';
  type: 'transactions' | 'budget' | 'goals' | 'all' | 'monthly_report';
  startDate?: string;
  endDate?: string;
  month?: string; // YYYY-MM format
  includeSummary?: boolean;
  includeCharts?: boolean;
}

export interface TransactionExportData {
  date: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod?: string;
  tags?: string;
}

export interface MonthlyReportData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categoryBreakdown: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
  topExpenses: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
  budgetStatus: Array<{
    category: string;
    budgeted: number;
    spent: number;
    percentage: number;
  }>;
}

class ExportService {
  /**
   * Export data based on options
   */
  async export(options: ExportOptions): Promise<string> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      let fileUri: string;

      switch (options.format) {
        case 'csv':
          fileUri = await this.exportToCSV(options, user.uid);
          break;
        case 'pdf':
          fileUri = await this.exportToPDF(options, user.uid);
          break;
        case 'json':
          fileUri = await this.exportToJSON(options, user.uid);
          break;
        default:
          throw new Error('Unsupported export format');
      }

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: this.getMimeType(options.format),
          dialogTitle: 'Export dữ liệu',
        });
      }

      return fileUri;
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(options: ExportOptions, userID: string): Promise<string> {
    let csvContent = '';
    const fileName = `export_${options.type}_${Date.now()}.csv`;
    const fileUri = `${FS.documentDirectory}${fileName}`;

    if (options.type === 'transactions' || options.type === 'all') {
      const transactions = await this.getTransactionData(userID, options);
      csvContent += this.transactionsToCSV(transactions);
    }

    if (options.type === 'budget' || options.type === 'all') {
      const budgets = await this.getBudgetData(userID, options);
      if (csvContent) csvContent += '\n\n';
      csvContent += this.budgetsToCSV(budgets);
    }

    if (options.type === 'goals' || options.type === 'all') {
      const goals = await this.getGoalsData(userID);
      if (csvContent) csvContent += '\n\n';
      csvContent += this.goalsToCSV(goals);
    }

    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FS.EncodingType.UTF8,
    });

    return fileUri;
  }

  /**
   * Export to PDF format
   */
  private async exportToPDF(options: ExportOptions, userID: string): Promise<string> {
    const fileName = `report_${options.type}_${Date.now()}.pdf`;
    const fileUri = `${FS.documentDirectory}${fileName}`;

    if (options.type === 'monthly_report') {
      const reportData = await this.getMonthlyReportData(userID, options.month!);
      const pdfContent = await this.generateMonthlyReportPDF(reportData);
      
      await FileSystem.writeAsStringAsync(fileUri, pdfContent, {
        encoding: FS.EncodingType.Base64,
      });
    } else {
      // Simple PDF for other types (just text-based)
      const transactions = await this.getTransactionData(userID, options);
      const pdfContent = await this.generateSimplePDF(transactions, options.type);
      
      await FileSystem.writeAsStringAsync(fileUri, pdfContent, {
        encoding: FS.EncodingType.Base64,
      });
    }

    return fileUri;
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(options: ExportOptions, userID: string): Promise<string> {
    const fileName = `export_${options.type}_${Date.now()}.json`;
    const fileUri = `${FS.documentDirectory}${fileName}`;

    const data: any = {
      exportDate: new Date().toISOString(),
      type: options.type,
      data: {},
    };

    if (options.type === 'transactions' || options.type === 'all') {
      data.data.transactions = await this.getTransactionData(userID, options);
    }

    if (options.type === 'budget' || options.type === 'all') {
      data.data.budgets = await this.getBudgetData(userID, options);
    }

    if (options.type === 'goals' || options.type === 'all') {
      data.data.goals = await this.getGoalsData(userID);
    }

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2), {
      encoding: FS.EncodingType.UTF8,
    });

    return fileUri;
  }

  /**
   * Get transaction data
   */
  private async getTransactionData(
    userID: string,
    options: ExportOptions
  ): Promise<TransactionExportData[]> {
    const queryOptions: any = {};
    
    if (options.startDate) queryOptions.startDate = options.startDate;
    if (options.endDate) queryOptions.endDate = options.endDate;
    
    if (options.month) {
      const [year, month] = options.month.split('-');
      queryOptions.startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
      queryOptions.endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();
    }

    const transactions = await databaseService.getTransactionsByUser(userID, queryOptions);

    // Load categories for mapping
    const categories = await databaseService.getCategoriesByUser(userID);
    const categoryMap = new Map(categories.map((c: any) => [c.id, c.name]));

    return transactions.map((txn: any) => ({
      date: new Date(txn.date).toLocaleDateString('vi-VN'),
      type: txn.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu',
      category: categoryMap.get(txn.category_id || txn.categoryID) || 'Không phân loại',
      description: txn.description || '',
      amount: parseFloat(txn.amount),
      paymentMethod: txn.payment_method || txn.paymentMethod || '',
      tags: '', // TODO: Load tags if available
    }));
  }

  /**
   * Get budget data
   */
  private async getBudgetData(userID: string, options: ExportOptions): Promise<any[]> {
    // This would query budgets from database
    // For now, return empty array
    // TODO: Implement when budget table is ready
    return [];
  }

  /**
   * Get goals data
   */
  private async getGoalsData(userID: string): Promise<any[]> {
    // This would query goals from database
    // For now, return empty array
    // TODO: Implement when goals table is ready
    return [];
  }

  /**
   * Get monthly report data
   */
  private async getMonthlyReportData(
    userID: string,
    month: string
  ): Promise<MonthlyReportData> {
    const [year, monthNum] = month.split('-');
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toISOString();
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59).toISOString();

    const transactions = await databaseService.getTransactionsByUser(userID, {
      startDate,
      endDate,
    });

    const categories = await databaseService.getCategoriesByUser(userID);
    const categoryMap = new Map(categories.map((c: any) => [c.id, c.name]));

    // Calculate totals
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = new Map<string, number>();

    transactions.forEach((txn: any) => {
      const amount = parseFloat(txn.amount);
      if (txn.type === 'INCOME') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
        const categoryId = txn.category_id || txn.categoryID;
        const categoryName = categoryMap.get(categoryId) || 'Không phân loại';
        categoryTotals.set(categoryName, (categoryTotals.get(categoryName) || 0) + amount);
      }
    });

    // Category breakdown
    const categoryBreakdown = Array.from(categoryTotals.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Top expenses
    const topExpenses = transactions
      .filter((txn: any) => txn.type === 'EXPENSE')
      .sort((a: any, b: any) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 10)
      .map((txn: any) => ({
        date: new Date(txn.date).toLocaleDateString('vi-VN'),
        description: txn.description || 'Không có mô tả',
        amount: parseFloat(txn.amount),
      }));

    return {
      month,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      categoryBreakdown,
      topExpenses,
      budgetStatus: [], // TODO: Add budget status when available
    };
  }

  /**
   * Convert transactions to CSV
   */
  private transactionsToCSV(transactions: TransactionExportData[]): string {
    const headers = ['Ngày', 'Loại', 'Danh mục', 'Mô tả', 'Số tiền', 'Phương thức thanh toán'];
    const rows = transactions.map((txn) => [
      txn.date,
      txn.type,
      txn.category,
      this.escapeCsvField(txn.description),
      txn.amount.toString(),
      txn.paymentMethod || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Convert budgets to CSV
   */
  private budgetsToCSV(budgets: any[]): string {
    const headers = ['Danh mục', 'Ngân sách', 'Đã chi', 'Còn lại', 'Phần trăm'];
    const rows = budgets.map((budget) => [
      budget.category,
      budget.budgeted,
      budget.spent,
      budget.remaining,
      `${budget.percentage}%`,
    ]);

    return ['Ngân sách', '', ...headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Convert goals to CSV
   */
  private goalsToCSV(goals: any[]): string {
    const headers = ['Tên mục tiêu', 'Mục tiêu', 'Đã tiết kiệm', 'Tiến độ', 'Hạn'];
    const rows = goals.map((goal) => [
      goal.name,
      goal.target,
      goal.saved,
      `${goal.progress}%`,
      goal.deadline,
    ]);

    return ['Mục tiêu', '', ...headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Generate a simple PDF (text-based)
   */
  private async generateSimplePDF(data: any[], type: string): Promise<string> {
    // For a real PDF, you'd use a library like react-native-pdf or jspdf
    // This is a simplified HTML-to-PDF approach
    const html = this.generateHTMLReport(data, type);
    
    // Convert HTML to base64 (simplified - in real app use proper PDF library)
    const base64 = btoa(unescape(encodeURIComponent(html)));
    return base64;
  }

  /**
   * Generate monthly report PDF
   */
  private async generateMonthlyReportPDF(data: MonthlyReportData): Promise<string> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Báo cáo tháng ${data.month}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .summary-item { display: flex; justify-content: space-between; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #4CAF50; color: white; }
          .income { color: #4CAF50; font-weight: bold; }
          .expense { color: #F44336; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Báo cáo Tháng ${data.month}</h1>
        
        <div class="summary">
          <div class="summary-item">
            <span>Tổng thu nhập:</span>
            <span class="income">${this.formatMoney(data.totalIncome)}</span>
          </div>
          <div class="summary-item">
            <span>Tổng ch tiêu:</span>
            <span class="expense">${this.formatMoney(data.totalExpense)}</span>
          </div>
          <div class="summary-item">
            <span>Còn lại:</span>
            <span>${this.formatMoney(data.balance)}</span>
          </div>
        </div>

        <h2>Phân bổ theo Danh mục</h2>
        <table>
          <thead>
            <tr>
              <th>Danh mục</th>
              <th>Số tiền</th>
              <th>Phần trăm</th>
            </tr>
          </thead>
          <tbody>
            ${data.categoryBreakdown.map(cat => `
              <tr>
                <td>${cat.name}</td>
                <td>${this.formatMoney(cat.amount)}</td>
                <td>${cat.percentage.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Top Chi tiêu</h2>
        <table>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Mô tả</th>
              <th>Số tiền</th>
            </tr>
          </thead>
          <tbody>
            ${data.topExpenses.map(expense => `
              <tr>
                <td>${expense.date}</td>
                <td>${expense.description}</td>
                <td class="expense">${this.formatMoney(expense.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p style="text-align: center; color: #999; margin-top: 40px;">
          Xuất lúc ${new Date().toLocaleString('vi-VN')}
        </p>
      </body>
      </html>
    `;

    const base64 = btoa(unescape(encodeURIComponent(html)));
    return base64;
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(data: any[], type: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Báo cáo ${type}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #4CAF50; color: white; }
        </style>
      </head>
      <body>
        <h1>Báo cáo ${type}</h1>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body>
      </html>
    `;
  }

  /**
   * Escape CSV field
   */
  private escapeCsvField(field: string): string {
    if (!field) return '';
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Format money
   */
  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  /**
   * Get MIME type
   */
  private getMimeType(format: string): string {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'pdf':
        return 'application/pdf';
      case 'json':
        return 'application/json';
      default:
        return 'text/plain';
    }
  }

  /**
   * Quick export transactions for current month
   */
  async exportCurrentMonthTransactions(format: 'csv' | 'pdf' | 'json' = 'csv'): Promise<string> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.export({
      format,
      type: 'transactions',
      month,
      includeSummary: true,
    });
  }

  /**
   * Quick export monthly report
   */
  async exportMonthlyReport(month?: string): Promise<string> {
    const targetMonth = month || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();

    return this.export({
      format: 'pdf',
      type: 'monthly_report',
      month: targetMonth,
      includeSummary: true,
      includeCharts: true,
    });
  }

  /**
   * Export all data
   */
  async exportAllData(format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.export({
      format,
      type: 'all',
    });
  }
}

export default new ExportService();

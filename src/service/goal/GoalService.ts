// src/service/goal/GoalService.ts
import { Goal } from "../../domain/types";
import { databaseService } from "../../database/databaseService";
import FirebaseService from "../firebase/FirebaseService";
import { authInstance as auth } from "../../firebaseConfig";

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  contributionType: "manual" | "automatic" | "transaction";
  sourceTransactionId?: string;
  note?: string;
  contributedAt: string;
}

export interface GoalProgress {
  goal: Goal;
  progress: number; // 0-100
  daysRemaining: number;
  monthlyContributionNeeded: number;
  isOnTrack: boolean;
  estimatedCompletionDate: string;
}

class GoalService {
  /**
   * 目標を作成
   */
  async createGoal(
    name: string,
    targetAmount: number,
    endDate: string,
    monthlyContribution?: number
  ): Promise<string> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startDate = new Date().toISOString();

      // SQLiteに保存
      await databaseService.ensureInitialized();
      await databaseService.db.runAsync(
        `INSERT INTO GOAL (goalID, userID, name, targetAmount, savedAmount, startDate, endDate, monthlyContribution, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          goalId,
          user.uid,
          name,
          targetAmount,
          0,
          startDate,
          endDate,
          monthlyContribution || 0,
          "ACTIVE",
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      // Firebaseに同期
      try {
        await FirebaseService.addGoal(user.uid, {
          name,
          targetAmount,
          savedAmount: 0,
          startDate,
          endDate,
          monthlyContribution: monthlyContribution || 0,
          status: "ACTIVE",
        });
      } catch (firebaseError) {
        console.warn("Failed to sync goal to Firebase:", firebaseError);
      }

      return goalId;
    } catch (error) {
      console.error("Error creating goal:", error);
      throw error;
    }
  }

  /**
   * 目標一覧を取得
   */
  async getGoals(status?: "ACTIVE" | "COMPLETED" | "CANCELLED"): Promise<Goal[]> {
    try {
      const user = auth.currentUser;
      if (!user) return [];

      await databaseService.ensureInitialized();
      let query = `SELECT * FROM GOAL WHERE userID = ?`;
      const params: any[] = [user.uid];

      if (status) {
        query += ` AND status = ?`;
        params.push(status);
      }

      query += ` ORDER BY createdAt DESC`;

      const goals = await databaseService.db.getAllAsync<{
        goalID: string;
        name: string;
        targetAmount: number;
        savedAmount: number;
        startDate: string;
        endDate: string;
        monthlyContribution: number;
        status: string;
      }>(query, params);

      return goals.map((g) => ({
        id: g.goalID,
        userId: user.uid,
        name: g.name,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount || 0,
        startDate: g.startDate,
        endDate: g.endDate,
        monthlyContribution: g.monthlyContribution || 0,
        status: (g.status as "ACTIVE" | "COMPLETED" | "CANCELLED") || "ACTIVE",
      }));
    } catch (error) {
      console.error("Error getting goals:", error);
      return [];
    }
  }

  /**
   * 目標への貢献を追加
   */
  async addContribution(
    goalId: string,
    amount: number,
    contributionType: "manual" | "automatic" | "transaction" = "manual",
    sourceTransactionId?: string,
    note?: string
  ): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      // 目標を取得
      const goal = await this.getGoalById(goalId);
      if (!goal) throw new Error("Goal not found");
      if (goal.status !== "ACTIVE") throw new Error("Goal is not active");

      const newSavedAmount = (goal.savedAmount || 0) + amount;
      const isCompleted = newSavedAmount >= goal.targetAmount;

      // 目標の保存額を更新
      await databaseService.db.runAsync(
        `UPDATE GOAL 
         SET savedAmount = ?, status = ?, updatedAt = ?
         WHERE goalID = ?`,
        [
          newSavedAmount,
          isCompleted ? "COMPLETED" : "ACTIVE",
          new Date().toISOString(),
          goalId,
        ]
      );

      // 貢献記録を追加
      const contributionId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await databaseService.db.runAsync(
        `INSERT INTO GOAL_CONTRIBUTION (contributionID, goalID, userID, amount, contributionType, sourceTransactionID, note, contributedAt, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contributionId,
          goalId,
          user.uid,
          amount,
          contributionType,
          sourceTransactionId || null,
          note || null,
          new Date().toISOString(),
          user.uid,
        ]
      );

      // Firebaseに同期
      try {
        await FirebaseService.updateGoal(goalId, {
          savedAmount: newSavedAmount,
          status: isCompleted ? "COMPLETED" : "ACTIVE",
        });
      } catch (firebaseError) {
        console.warn("Failed to sync goal update to Firebase:", firebaseError);
      }
    } catch (error) {
      console.error("Error adding contribution:", error);
      throw error;
    }
  }

  /**
   * 目標IDで取得
   */
  private async getGoalById(goalId: string): Promise<Goal | null> {
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const result = await databaseService.db.getFirstAsync<{
        goalID: string;
        name: string;
        targetAmount: number;
        savedAmount: number;
        startDate: string;
        endDate: string;
        monthlyContribution: number;
        status: string;
      }>(`SELECT * FROM GOAL WHERE goalID = ? AND userID = ?`, [goalId, user.uid]);

      if (!result) return null;

      return {
        id: result.goalID,
        userId: user.uid,
        name: result.name,
        targetAmount: result.targetAmount,
        savedAmount: result.savedAmount || 0,
        startDate: result.startDate,
        endDate: result.endDate,
        monthlyContribution: result.monthlyContribution || 0,
        status: (result.status as "ACTIVE" | "COMPLETED" | "CANCELLED") || "ACTIVE",
      };
    } catch (error) {
      console.error("Error getting goal by ID:", error);
      return null;
    }
  }

  /**
   * 目標の進捗を計算
   */
  async calculateGoalProgress(goalId: string): Promise<GoalProgress | null> {
    try {
      const goal = await this.getGoalById(goalId);
      if (!goal) return null;

      const now = new Date();
      const endDate = new Date(goal.endDate);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // 進捗率
      const progress = goal.targetAmount > 0 
        ? Math.min((goal.savedAmount || 0) / goal.targetAmount * 100, 100)
        : 0;

      // 残りの金額
      const remainingAmount = Math.max(0, goal.targetAmount - (goal.savedAmount || 0));

      // 月次必要額を計算
      const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
      const monthlyContributionNeeded = remainingAmount / monthsRemaining;

      // 目標達成の見込み日を計算
      let estimatedCompletionDate = goal.endDate;
      if (goal.monthlyContribution > 0) {
        const monthsToComplete = remainingAmount / goal.monthlyContribution;
        const estimatedDate = new Date(now);
        estimatedDate.setMonth(estimatedDate.getMonth() + Math.ceil(monthsToComplete));
        estimatedCompletionDate = estimatedDate.toISOString();
      }

      // 順調かどうかを判定（月次必要額と実際の月次貢献額を比較）
      const isOnTrack = goal.monthlyContribution >= monthlyContributionNeeded * 0.9; // 90%以上なら順調

      return {
        goal,
        progress,
        daysRemaining,
        monthlyContributionNeeded,
        isOnTrack,
        estimatedCompletionDate,
      };
    } catch (error) {
      console.error("Error calculating goal progress:", error);
      return null;
    }
  }

  /**
   * 目標の月次必要額を自動計算（期限と目標額から）
   */
  calculateMonthlyContributionNeeded(
    targetAmount: number,
    savedAmount: number,
    endDate: string
  ): number {
    const now = new Date();
    const end = new Date(endDate);
    const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));

    const remainingAmount = Math.max(0, targetAmount - savedAmount);
    return remainingAmount / monthsRemaining;
  }

  /**
   * 目標を更新
   */
  async updateGoal(
    goalId: string,
    updates: {
      name?: string;
      targetAmount?: number;
      endDate?: string;
      monthlyContribution?: number;
      status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
    }
  ): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const updateFields: string[] = [];
      const params: any[] = [];

      if (updates.name !== undefined) {
        updateFields.push("name = ?");
        params.push(updates.name);
      }
      if (updates.targetAmount !== undefined) {
        updateFields.push("targetAmount = ?");
        params.push(updates.targetAmount);
      }
      if (updates.endDate !== undefined) {
        updateFields.push("endDate = ?");
        params.push(updates.endDate);
      }
      if (updates.monthlyContribution !== undefined) {
        updateFields.push("monthlyContribution = ?");
        params.push(updates.monthlyContribution);
      }
      if (updates.status !== undefined) {
        updateFields.push("status = ?");
        params.push(updates.status);
      }

      if (updateFields.length === 0) return;

      updateFields.push("updatedAt = ?");
      params.push(new Date().toISOString());
      params.push(goalId);

      await databaseService.db.runAsync(
        `UPDATE GOAL SET ${updateFields.join(", ")} WHERE goalID = ?`,
        params
      );

      // Firebaseに同期
      try {
        await FirebaseService.updateGoal(goalId, updates);
      } catch (firebaseError) {
        console.warn("Failed to sync goal update to Firebase:", firebaseError);
      }
    } catch (error) {
      console.error("Error updating goal:", error);
      throw error;
    }
  }

  /**
   * 目標を削除（キャンセル）
   */
  async cancelGoal(goalId: string): Promise<void> {
    await this.updateGoal(goalId, { status: "CANCELLED" });
  }
}

export default new GoalService();


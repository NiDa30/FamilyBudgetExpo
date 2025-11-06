# 📊 家計管理アプリケーション - アーキテクチャ分析と実装計画

## 📋 プロジェクト概要

**Family Budget Expo** - React Nativeベースの家計管理アプリケーション
- **オフライン優先アーキテクチャ**: SQLite（ローカル）↔ Firebase（クラウド）双方向同期
- **多機能**: 取引管理、OCRレシートスキャン、統計分析、予算推奨エンジン
- **セキュリティ**: パスワードハッシュ化、データ暗号化、RBAC

---

## 🔍 現状分析

### ✅ 実装済み機能

| コンポーネント | 状態 | 詳細 |
|--------------|------|------|
| **モバイルアプリ** | ✅ 実装済み | React Native (Expo)、取引追跡、カテゴリ管理 |
| **バックエンド** | ✅ 実装済み | Firebase Functions、Express.js API |
| **Web Admin** | ✅ 実装済み | React/Vite、Ant Design UI |
| **データベース** | ✅ 実装済み | Firebase Firestore、完全なデータモデル |
| **サンプルデータ** | ✅ 実装済み | 20+世帯の詳細CSVデータ |
| **セキュリティ** | ✅ 実装済み | Bcryptパスワードハッシュ化 |
| **OCR** | ✅ 実装済み | Tesseract.js統合（レシートスキャン） |
| **テスト** | ⚠️ 最小限 | Jest設定済み、カバレッジ低 |

### 📁 現在のコードベース構造

```
src/
├── 🎨 メイン画面 (15+画面)
│   ├── Trangchu.tsx (ホーム)
│   ├── Login.tsx, Signup.tsx
│   ├── Quethoadon.tsx (OCR)
│   ├── Bieudo.tsx (統計)
│   └── ...
├── 🗄️ データベース層
│   ├── databaseService.js (SQLite管理)
│   ├── repositories.ts (リポジトリパターン)
│   └── migrations.js
├── 🔥 Firebase統合
│   ├── FirebaseService.js
│   └── adapter.ts
├── 🔄 同期サービス
│   ├── SyncEngine.js
│   └── SyncService.ts
└── 📊 ドメインモデル
    ├── types.ts
    └── mappers.ts
```

---

## 🏗️ 8モジュール実装計画

### 📦 Module 1: 家計支出研究データセット

**目的**: 多様な世帯データの収集と標準化

**実装タスク**:
- [ ] 10+世帯のサンプルデータ設計（収入レベル、家族規模、地理的分布）
- [ ] データフィールド標準化:
  - `Household_ID`, `Transaction_ID`, `Date & Time`
  - `Amount (VND)`, `Type`, `Category`
  - `User_Input_Desc`, `Income_Level`, `Family_Size`
- [ ] データクリーニングと検証スクリプト
- [ ] 統計分析: 月次合計/平均、カテゴリ分布、トレンド分析

**現在の状態**: ✅ CSVデータ存在、標準化が必要

---

### 🗄️ Module 2: データベース設計と同期

**目的**: オフライン優先の双方向同期システム

**実装タスク**:

#### 2.1 SQLiteローカルスキーマ
```sql
-- 主要テーブル
- users (user_id PK, email, password_hash, ...)
- categories (id PK, user_id FK, name, type, ...)
- transactions (id PK, user_id FK, category_id FK, amount, ...)
- budgets (id PK, user_id FK, category_id FK, ...)
- goals (id PK, user_id FK, target_amount, ...)
- sync_logs (id PK, user_id FK, sync_time, status, ...)
```

#### 2.2 Firebaseクラウドスキーマ
- Collections: `USERS`, `TRANSACTIONS`, `CATEGORIES`, `BUDGETS`
- 既存構造を維持

#### 2.3 同期エンジン設計
- ✅ **実装済み**: `SyncEngine.js`, `SyncService.ts`
- 🔄 **改善必要**: 
  - 競合解決: Last-Write-Wins (タイムスタンプベース)
  - 同期トリガー: ネットワーク変更、アプリ切り替え、手動、定期

**現在の状態**: ✅ 基本実装済み、競合解決の強化が必要

---

### 📱 Module 3: モバイルアプリ開発

**目的**: React Nativeによるクロスプラットフォームアプリ

**実装タスク**:

#### 3.1 アーキテクチャ
- ✅ ディレクトリ構造: `components/`, `screens/`, `services/`
- ✅ Navigation: React Navigation実装済み

#### 3.2 コア機能
- ✅ **認証**: Email/Google OAuth、Bcryptハッシュ化
- ✅ **CRUD**: 取引、カテゴリ、予算、目標の管理
- ✅ **OCR**: Expo Camera + Tesseract.js統合済み

#### 3.3 技術スタック
- ✅ State Management: Context API (Redux Toolkit推奨)
- ✅ UI: React Native Paper推奨
- ⚠️ **改善提案**: Redux Toolkitへの移行検討

**現在の状態**: ✅ 主要機能実装済み、状態管理の最適化が必要

---

### 📊 Module 4: 分析とレポート

**目的**: 財務データの可視化と分析

**実装タスク**:

#### 4.1 チャートライブラリ
- モバイル: Victory Native
- Web Admin: Recharts

#### 4.2 チャートタイプ
- ✅ 棒グラフ: 支出/収入比較 (`Bieudo.tsx`に実装済み)
- ✅ 折れ線グラフ: 支出トレンド
- ✅ 円グラフ: カテゴリ別支出分布

#### 4.3 AnalyticsService設計
```typescript
class AnalyticsService {
  calculateTotals(userId, dateRange)
  getCategoryDistribution(userId, dateRange)
  analyzeTrends(userId, period)
  compareBudget(userId, month)
}
```

#### 4.4 レポート生成
- 月次サマリー
- カテゴリ分析
- トレンドレポート
- 目標進捗

**現在の状態**: ✅ 基本チャート実装済み、サービス層の拡張が必要

---

### 💡 Module 5: 予算推奨エンジン

**目的**: インテリジェントな予算管理システム

**実装タスク**:

#### 5.1 50/30/20ルール
- ✅ **実装済み**: `utils/budgetRules.ts`
- コア: 税後収入を50%必要、30%欲求、20%貯蓄/返済に分配
- 動的調整: 収入変更時の自動再計算
- カテゴリマッピング: カテゴリを3グループに分類

#### 5.2 目標エンジン
- 計算: 目標金額と期限に基づく月次貯蓄額計算
- 機能: 進捗追跡、支出閾値アラート、予算調整提案

**現在の状態**: ✅ 基本ルール実装済み、エンジンの拡張が必要

---

### 🔔 Module 6: 通知とバックアップ

**目的**: ユーザー更新とデータ保護

**実装タスク**:

#### 6.1 通知システム
- タイプ:
  - 予算閾値超過アラート
  - 目標更新
  - 週次支出サマリー
  - 支払いリマインダー
- チャネル:
  - Push通知: Firebase Cloud Messaging (FCM)
  - Email: Nodemailer
  - In-app通知

#### 6.2 バックアップとエクスポート
- ✅ **実装済み**: `Saoluu.tsx`, `XuatExcel.tsx`
- エクスポート形式: CSV、PDF
- バックアップ: 暗号化された自動日次バックアップ → Cloud Storage

**現在の状態**: ✅ 基本機能実装済み、通知システムの統合が必要

---

### 🔒 Module 7: セキュリティと権限

**目的**: エンタープライズレベルのセキュリティ

**実装タスク**:

#### 7.1 コアセキュリティ対策
- ✅ データ暗号化: AES-256（SQLiteローカル）
- ✅ 認証: Bcryptハッシュ化実装済み
- ⚠️ **追加必要**: 
  - デバイスKeystoreでのキー保存
  - MFA (多要素認証)
  - 安全なトークン保存
- 入力検証: クライアントとサーバー側の検証
- コンプライアンス: OWASP Mobile標準

#### 7.2 ロールベースアクセス制御 (RBAC)
- ロール定義:
  - `USER`: 自分のデータのみアクセス
  - `ADMIN`: システム管理権限
- ✅ **実装済み**: `role`フィールド存在

**現在の状態**: ✅ 基本セキュリティ実装済み、強化が必要

---

### 🧪 Module 8: テストと評価

**目的**: 品質と効果の検証

**実装タスク**:

#### 8.1 テストフレームワーク
- ✅ Jest設定済み
- ⚠️ **追加必要**:
  - Unit/Component: Jest
  - Backend API: Mocha/Chai
  - Web: Cypress
  - E2E Mobile: Detox

#### 8.2 評価結果
- パイロット研究: 20世帯で4週間の試行
- 満足度: Likertスケール（またはSUS）調査
- 効果: 予算遵守の改善測定

**現在の状態**: ⚠️ テストカバレッジ低、包括的テストスイートが必要

---

## 📊 データベーススキーマ完全構造

### 主要テーブル関係図

```
USER (1) ──┬── (N) TRANSACTION
           ├── (N) CATEGORY
           ├── (N) BUDGET
           ├── (N) GOAL
           ├── (N) DEVICE
           └── (N) NOTIFICATION

CATEGORY (1) ── (N) TRANSACTION
              └── (N) BUDGET

TRANSACTION (N) ── (N) TAG (多対多)
                ├── (1) PAYMENT_METHOD
                ├── (1) ATTACHMENT
                └── (1) RECURRING_TXN

GOAL (1) ── (N) GOAL_CONTRIBUTION
```

### 主要テーブル一覧

| テーブル | 主キー | 主要フィールド | 状態 |
|---------|--------|--------------|------|
| **USER** | userID | email, passwordHash, role, monthlyIncome | ✅ |
| **CATEGORY** | categoryID | name, type, icon, color | ✅ |
| **TRANSACTION** | transactionID | amount, type, date, categoryID | ✅ |
| **BUDGET** | budgetID | categoryID, monthYear, budgetAmount | ✅ |
| **GOAL** | goalID | targetAmount, savedAmount, status | ✅ |
| **PAYMENT_METHOD** | methodID | methodType, name, balance | ⚠️ |
| **ATTACHMENT** | attachmentID | fileURL, ocrRawText | ✅ |
| **RECURRING_TXN** | recurTxnID | frequency, nextDueDate | ⚠️ |
| **NOTIFICATION** | notificationID | type, title, isRead | ⚠️ |
| **SYNC_LOG** | logID | syncTime, status, conflictDetails | ✅ |
| **DEVICE** | deviceID | deviceUUID, fcmToken | ⚠️ |
| **TAG** | tagID | name, color | ⚠️ |
| **MERCHANT** | merchantID | name, category, location | ⚠️ |

**凡例**: ✅ 実装済み | ⚠️ 部分実装 | ❌ 未実装

---

## 🎯 優先実装ロードマップ

### Phase 1: 基盤強化 (1-2週間)
1. ✅ データベース同期エンジンの改善
2. ⚠️ 競合解決ロジックの実装
3. ⚠️ エラーハンドリングの強化

### Phase 2: 機能拡張 (2-3週間)
1. ⚠️ AnalyticsServiceの実装
2. ⚠️ 通知システムの統合
3. ⚠️ 予算推奨エンジンの拡張

### Phase 3: セキュリティ強化 (1-2週間)
1. ⚠️ AES-256暗号化の実装
2. ⚠️ MFAの追加
3. ⚠️ RBACの完全実装

### Phase 4: テストと最適化 (2-3週間)
1. ⚠️ 包括的テストスイート
2. ⚠️ パフォーマンス最適化
3. ⚠️ ユーザビリティテスト

---

## 📝 次のステップ

1. **即座に実装**: Module 2の同期エンジン改善
2. **短期**: Module 4のAnalyticsService実装
3. **中期**: Module 6の通知システム統合
4. **長期**: Module 8の包括的テストスイート

---

## 🔗 関連ファイル

- `src/database/databaseService.js` - SQLite管理
- `src/service/sync/SyncEngine.js` - 同期エンジン
- `src/utils/budgetRules.ts` - 予算ルール
- `src/service/firebase/FirebaseService.js` - Firebase統合
- `src/domain/types.ts` - 型定義

---

**最終更新**: 2024年
**バージョン**: 1.0.0


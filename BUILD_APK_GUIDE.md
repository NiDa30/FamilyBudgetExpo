# APKビルドガイド - FamilyBudgetExpo

## 概要
このガイドでは、Expo EAS Buildを使用してAndroid APKを作成する方法を説明します。

## 前提条件
- ✅ EAS CLIがインストールされている（確認済み: v16.26.0）
- ✅ `eas.json`ファイルが設定されている（確認済み）
- ✅ `app.json`ファイルが設定されている（確認済み）

## 利用可能なビルドプロファイル

### 1. `development` - 開発用APK（Debug）
- **用途**: 開発・テスト用
- **ビルドタイプ**: Debug APK
- **特徴**: デバッグシンボル付き、開発クライアント有効

### 2. `preview` - プレビュー用APK（Release）
- **用途**: 内部テスト・配布用
- **ビルドタイプ**: Release APK
- **特徴**: 最適化済み、内部配布用

### 3. `production` - 本番用APK（Release）
- **用途**: 本番環境・Google Play Store提出用
- **ビルドタイプ**: Release APK
- **特徴**: 最適化済み、自動バージョン増分

## ビルド手順

### ステップ1: EASアカウントにログイン

```bash
eas login
```

既にログインしている場合は、このステップをスキップできます。

### ステップ2: ビルドを実行

#### オプションA: プレビュー用APK（推奨）
内部テストやエミュレーター/実機へのインストール用：

```bash
eas build -p android --profile preview
```

#### オプションB: 開発用APK
開発・デバッグ用：

```bash
eas build -p android --profile development
```

#### オプションC: 本番用APK
本番環境用：

```bash
eas build -p android --profile production
```

### ステップ3: ビルドの完了を待つ
ビルドはクラウドで実行されます。通常、15-30分かかります。

ビルドが完了すると、以下の情報が表示されます：
- ビルドID
- ダウンロードURL
- インストール手順

## APKのインストール

### エミュレーター（仮想デバイス）へのインストール

#### 方法1: 自動インストール
ビルド完了時にプロンプトが表示されたら、`Y`を押して自動インストール：

```bash
eas build:run -p android
```

#### 方法2: 最新ビルドを自動インストール
```bash
eas build:run -p android --latest
```

### 実機（物理デバイス）へのインストール

#### 方法1: 直接ダウンロード
1. ビルド完了時に表示されるURLをコピー
2. デバイスでURLを開く（メールなどで送信）
3. APKをダウンロードしてインストール

#### 方法2: ADBを使用
1. ADBをインストール（まだの場合）
2. デバイスをPCに接続し、USBデバッグを有効化
3. APKをダウンロード
4. 以下のコマンドを実行：

```bash
adb install path/to/the/file.apk
```

## トラブルシューティング

### ビルドエラーが発生した場合

1. **ログを確認**
   ```bash
   eas build:list
   ```
   ビルドIDを確認し、詳細ログを表示：
   ```bash
   eas build:view [BUILD_ID]
   ```

2. **キャッシュをクリア**
   `eas.json`のキャッシュキーを変更して再ビルド

3. **依存関係を確認**
   ```bash
   npm install
   ```

### インストールエラーが発生した場合

1. **不明なソースを許可**
   Android設定 > セキュリティ > 不明なソースのアプリを許可

2. **APKの整合性を確認**
   ダウンロードが完了しているか確認

3. **デバイスの互換性を確認**
   Androidバージョンとアーキテクチャを確認

## 現在の設定

### eas.json
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### app.json
- **パッケージ名**: `com.quocdien.familybudget`
- **バージョン**: `1.0.0`
- **プロジェクトID**: `626a9819-90ff-4981-a1f9-64af861a38d5`

## 次のステップ

1. **ビルドを実行**: `eas build -p android --profile preview`
2. **ビルドの完了を待つ**: 15-30分
3. **APKをダウンロード**: ビルド完了後にURLが表示されます
4. **インストール**: エミュレーターまたは実機にインストール

## 参考リンク

- [EAS Build ドキュメント](https://docs.expo.dev/build/introduction/)
- [APKビルドガイド](https://docs.expo.dev/build/building-on-ci/#building-apks-for-android)
- [EAS CLI コマンドリファレンス](https://docs.expo.dev/build-reference/eas-json/)

---

**最終更新**: 2024年
**プロジェクト**: FamilyBudgetExpo


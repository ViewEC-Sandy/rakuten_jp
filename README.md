# Japan EC Dashboard V5

V5 是可部署在 GitHub Pages 的 Workspace 型 CSV BI 儀表板。

## 功能

- Firebase Email / Password 登入
- 忘記密碼
- Admin / Manager / Viewer 角色顯示控制
- 多 Workspace
- CSV 自訂欄位對應
- 欄位模板
- KPI 卡片
- 趨勢圖
- 排行圖
- 圓餅圖／長條圖／折線圖
- 全域篩選
- 可拖曳儀表板元件
- 儲存每個 Workspace 的版面
- 深色模式
- 明細搜尋
- 響應式手機版

## 重要限制

1. CSV 與分析資料儲存在瀏覽器 localStorage／目前工作階段，不會同步到其他電腦。
2. Firebase 負責登入、使用者角色與 Workspace 名稱。
3. 若要跨裝置同步 CSV 資料，需要另外加入 Firestore 或雲端儲存資料流程。
4. GitHub Pages 專案程式碼仍是公開的，但 Firebase 不會把密碼寫在程式碼中。

## 第一步：建立 Firebase 專案

1. 進入 Firebase Console。
2. 建立專案。
3. 建立 Web App。
4. 開啟 Authentication。
5. Sign-in method 開啟 Email/Password。
6. 建立第一個登入帳號。

## 第二步：設定 firebase-config.js

將：

`firebase-config.example.js`

複製並改名為：

`firebase-config.js`

填入 Firebase Web App 的設定。

## 第三步：建立 Firestore

建立 Firestore Database，並建立以下集合。

### users

文件 ID 必須是 Firebase Authentication 使用者 UID。

範例：

```json
{
  "email": "admin@example.com",
  "role": "admin"
}
```

role 可使用：

- admin
- manager
- viewer

### workspaces

文件名稱可自訂，例如：

`rakuten`

內容：

```json
{
  "name": "Rakuten"
}
```

## Firestore Rules 範例

以下規則適合初期測試。正式使用前應依公司需求調整。

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    match /workspaces/{workspaceId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
      allow update, delete: if request.auth != null
                    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
  }
}
```

## GitHub Pages 部署

將以下檔案上傳到 Repository 根目錄：

- index.html
- style.css
- app.js
- firebase-config.js
- README.md
- sample-sales.csv

GitHub Pages 設定：

- Source: Deploy from a branch
- Branch: main
- Folder: / (root)

## 權限說明

### Admin

- 查看 Dashboard
- 匯入 CSV
- 修改模板
- 建立 Workspace
- 查看使用者清單

### Manager

- 查看 Dashboard
- 匯入 CSV
- 修改模板

### Viewer

- 查看 Dashboard

前端權限主要控制介面顯示。真正的資料安全仍必須搭配 Firestore Security Rules。

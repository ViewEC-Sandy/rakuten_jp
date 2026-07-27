# V7 Enterprise 更新步驟

## 重要：先修正權限，再更新網站

目前錯誤 `FirebaseError: Missing or insufficient permissions.` 代表 Firestore Rules 尚未允許目前帳號讀取或寫入資料。

### 1. 發布 Firestore Rules

1. 開啟 Firebase Console。
2. 進入 **Cloud Firestore → 規則**。
3. 打開 ZIP 裡的 `firestore.rules.txt`。
4. 將規則頁原有內容全部取代。
5. 按 **發布**。

### 2. 確認管理員角色

進入 **Cloud Firestore → 資料 → users → 你的 UID**。

確認：

- `email`：你的登入 Email
- `role`：`admin`

`role` 必須是字串且全小寫。修改後登出，再重新登入。

若 users 中沒有你的 UID：先登入網站一次，系統會自動建立 `viewer` 文件，再回 Firebase 改成 `admin`。

### 3. 更新 GitHub Pages

上傳並覆蓋：

- `index.html`
- `style.css`
- `app.js`
- `README.md`

保留原本已設定成功的 `firebase-config.js`，不要用範例檔覆蓋。

完成後按 **Commit changes**。

### 4. 強制重新整理

- Windows：`Ctrl + F5`
- Mac：`Command + Shift + R`

或直接用無痕視窗測試。

### 5. 測試順序

1. 登入。
2. 商品主檔：上傳 `sample-products.csv`。
3. 資料匯入：平台填 `Rakuten`，上傳 `sample-sales-rakuten.csv`。
4. 平台改 `Amazon`，上傳 `sample-sales-amazon.csv`。
5. 到「商品跨平台」搜尋 `TW001`。
6. 到「平台比較」確認 Rakuten 與 Amazon。
7. 到「商品分組」確認各分組營收。

### 6. 權限說明

- `admin`：查詢、匯入、管理
- `manager`：查詢、匯入
- `viewer`：只能查詢

### 7. V7 Enterprise 與原 V7 的差異

- 初始化失敗時會直接顯示錯誤，不會永久卡在「登入中」。
- Firestore Rules 支援首次登入自動建立 viewer。
- 管理員可以讀取使用者資料。
- 商品、銷售、平台與匯入紀錄的權限分開管理。

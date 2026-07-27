# Japan EC Dashboard V8 Core

這是由既有 V7 專案修正而成的 V8 Core 版，重點更新商品主檔為 10 欄，並修正商品主檔表格顯示與跨平台商品對照。

## 使用步驟

1. 編輯 `firebase-config.js`，貼入自己的 Firebase Web App 設定。
2. Firebase Authentication 啟用 Email/Password。
3. 建立 Firestore Database，將 `firestore.rules` 內容發布到 Rules。
4. 第一次登入後，系統會建立 `users/{UID}`，預設角色為 `viewer`。
5. 到 Firestore 將該使用者的 `role` 手動改為 `manager` 或 `admin`，才可匯入資料。
6. 將整個資料夾上傳到 GitHub Pages。

## 商品主檔欄位

- 商品管理番号（Firestore 文件 ID）
- 商品番号（銷售 CSV 的跨平台對照碼）
- 商品名
- 專案名稱
- 廠商名
- 商品供應價
- 樂天日幣售價
- NETSEA日幣售價
- Shopify售價
- 商品條碼

## 注意

- 銷售 CSV 的「商品編號」應填商品主檔的「商品番号」。
- 初次使用 Firestore 複合查詢時，Firebase 可能提示建立索引，請依錯誤訊息中的連結建立。
- 此版本為現有 V7 的完整修正版，不是先前規劃中的大型模組化重寫版。

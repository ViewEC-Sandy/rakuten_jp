# Japan EC Dashboard V8.1 Core

## V8.1 主要變更

- `商品番号` 為 Firestore `products` collection 的 Document ID，也是所有銷售資料的唯一關聯鍵。
- `商品管理番号` 為輔助管理編號，可修改，不影響歷史銷售資料。
- 商品主檔支援兩種匯入方式：
  - 更新／新增商品：相同商品番号覆蓋更新，其他既有商品保留。
  - 完全取代商品主檔：刪除 products collection 後匯入本次 CSV，需輸入 `DELETE` 確認。
- 銷售 CSV 必須以 `商品番号` 對應商品主檔。

## 商品主檔欄位

1. 商品番号（唯一 ID，必填）
2. 商品管理番号（輔助編號）
3. 商品名
4. 專案名稱
5. 廠商名
6. 商品供應價
7. 樂天日幣售價
8. NETSEA日幣售價
9. Shopify售價
10. 商品條碼

## Firestore 結構

```text
products/{商品番号}
sales/{平台_訂單編號_商品番号_明細序號}
platforms/{平台名稱}
imports/{自動產生 ID}
users/{Firebase Auth UID}
```

## 安裝

1. 將 `firebase-config.js` 內容改成你的 Firebase Web App 設定。
2. 在 Firebase Authentication 啟用 Email/Password。
3. 建立 Firestore Database。
4. 將 `firestore.rules` 發布到 Firestore Rules。
5. 把整個資料夾上傳到 GitHub Pages。
6. 第一次登入後，到 Firestore 的 `users/{UID}` 將 `role` 改為 `admin` 或 `manager`，才能匯入資料。

## 注意

- 不要任意修改既有商品的 `商品番号`。更換商品番号等同建立新商品，舊銷售資料不會自動轉移。
- 完全取代商品主檔不會刪除 sales collection。

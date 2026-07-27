# Japan EC Dashboard V7 操作指南

V7 將銷售 CSV 與商品主檔寫入 Cloud Firestore，可跨電腦定期更新及查詢。

## 1. 更新 GitHub

保留你現在已設定好的 `firebase-config.js`，再將 V7 的以下檔案上傳並覆蓋 Repository 根目錄：

- index.html
- style.css
- app.js
- README.md

不要只上傳資料夾；`index.html` 必須直接位於 Repository 根目錄。

## 2. 更新 Firestore 規則

Firebase Console → Cloud Firestore → 規則。

將 `firestore.rules.txt` 全部貼上，按「發布」。

## 3. 設定帳號角色

Firestore：

```text
users
└── 你的 UID
    ├── email = 你的 Email
    └── role = admin
```

可用角色：

- admin：查詢、匯入、刪除與管理
- manager：查詢及匯入
- viewer：只能查詢

修改後登出再登入。

## 4. 先上傳商品主檔

進入「商品主檔」，上傳 `sample-products.csv` 測試。

最低必要欄位：

```text
商品編號,商品名稱,分組
```

可加入：

```text
品牌,大分類,中分類
```

商品編號是所有平台共用的唯一鍵。

## 5. 上傳各平台銷售資料

進入「資料匯入」。

1. 輸入平台名稱，例如 Rakuten。
2. 選擇「跳過重複」。
3. 上傳該平台 CSV。
4. Amazon、Shopify 等平台依序重複操作。

最低必要欄位：

```text
日期,訂單編號,商品編號,商品名稱,數量,營收
```

推薦加入：

```text
明細序號
```

唯一鍵：

```text
平台 + 訂單編號 + 商品編號 + 明細序號
```

## 6. 查詢與比較

頁面上方可設定：

- 全部平台或指定平台
- 開始日期
- 結束日期
- 去年同期
- 前一期間
- 不比較

按「套用」後，營運總覽、平台比較、商品跨平台與商品分組會一起更新。

## 7. 定期更新

每次取得新資料時：

1. 輸入正確平台名稱。
2. 上傳增量 CSV。
3. 使用「跳過重複」。
4. 到「匯入紀錄」確認讀取、寫入與跳過筆數。
5. 回報表按「重新整理」。

平台提供修正版資料時，改用「覆蓋既有」。

## 8. 第一次查詢若出現索引錯誤

瀏覽器 Console 可能顯示 Firestore 需要索引，錯誤訊息會附建立索引連結。點連結建立 `sales.saleDate` 索引，等待完成後重新整理。

## 9. 資料庫集合

V7 會使用：

```text
users
products
sales
platforms
imports
```

## 10. 規模提醒

目前版本適合初期與中小量資料。若累積到數十萬筆銷售明細，建議新增每日／每月彙總集合，減少 Firestore 讀取量與費用。

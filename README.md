# Japan EC Dashboard V9.1

## V9 新增
- Rakuten / Shopify 不同格式銷售 CSV 匯入 Profile
- Shopify `Paid at` 僅讀取年月日
- Shopify `Total` 優先作為營收；缺少時以單價 × 數量計算
- 商品主檔支援中文商品名與日文商品名
- 銷售資料以 `商品番号` 關聯商品主檔，報表自動顯示中文商品名
- 樂天廣告 CSV 匯入與廣告分析
- 廣告資料透過 `商品管理番号` 對應商品主檔
- 自動計算 CVR 與 ROAS
- 廣告分析支援月份、專案、文字搜尋、欄位及升降冪排序

## 樂天廣告 CSV 欄位
- 日付
- 商品管理番号
- CTR(%)
- クリック数(合計)
- 実績額(合計)
- 売上金額(合計720時間)
- 売上件数(合計720時間)

## 計算公式
- CVR = 銷售訂單數 ÷ 點擊數 × 100%
- ROAS = 銷售額 ÷ 廣告花費 × 100%

## 部署提醒
請將 `firestore.rules` 更新至 Firebase Console，V9 新增 `ads` collection 權限。


## V9.1 更新
- 支援樂天廣告日期區間（例：2026年07月01日～2026年07月27日）
- 廣告資料依「月份＋商品管理番号」彙整並建立固定文件 ID，避免重複累積
- 商品管理番号改用 Map 快速對應商品主檔
- Shopify Paid at 僅取年月日
- CSV 錯誤提示會顯示列號
- 樂天廣告欄位名稱增加容錯


## V9.2
- Rakuten status 900 and Shopify Financial Status refunded are excluded from sales imports.
- Added monthly Rakuten product analytics CSV import and product analysis page.
- Added automatic table search and sorting controls.
- Firestore collection: productAnalytics.

# Japan EC Dashboard V10.1

以 V9.1 穩定架構為基礎整合的正式版本。

## 主要更新
- 營運總覽：流量、廣告 KPI、流量趨勢、商品 TOP10
- 商品分析：月份匯入、商品頁流量、RPP 流量、自然流量、CVR、新客／回購與收藏數
- 商品跨平台與專案分析：搜尋、篩選與彙總 KPI
- 平台名稱統一：`rakuten` / `Rakuten` 顯示為 `Rakuten`
- 隱藏專案：`GOOD LIFE`、`Taiwan Pavilion`、`未設定專案`
- 銷售匯入排除：Rakuten `ステータス=900`、Shopify `Financial Status=refunded`
- Rakuten 銷售額：匯入時自動扣除 `店舗発行クーポン利用額`
- 商品主檔：商品供應價顯示為新台幣 NT$，各平台售價維持日圓 ¥
- 無 MutationObserver，避免持續重排造成瀏覽器卡死

## 部署
將本資料夾所有檔案上傳至 GitHub Repository 根目錄，並由 GitHub Pages 部署。

## Firestore
請同步套用 `firestore.rules`，其中包含 `productAnalytics` collection 權限。

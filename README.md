# Japan EC Dashboard V9.2.4

以 V9.1 穩定版功能為基礎，補入：

- Rakuten 銷售 CSV：ステータス = 900 自動排除
- Shopify 銷售 CSV：Financial Status = refunded 自動排除
- 商品分析頁及月份指定匯入
- 商品分析與樂天廣告資料串接
- 各資料表搜尋及排序
- 已移除會造成瀏覽器卡死的 MutationObserver

部署時請保留你目前正常使用的 firebase-config.js。

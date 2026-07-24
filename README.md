# 日本電商營運儀表板

這是一個可部署在 GitHub Pages 的前端 CSV 分析工具。

## 功能

- 上傳日文 CSV
- 自動讀取所有欄位
- 自動判斷常見日文欄位名稱
- 手動選擇欄位對應
- 儲存欄位設定到瀏覽器
- 顯示總營收、訂單數、平均客單價、銷售數量、商品數
- 有廣告費欄位時，自動計算 ROAS 與 TACoS
- 顯示每日營收趨勢
- 顯示商品營收 Top 10
- 顯示與搜尋資料明細

## 使用方式

1. 開啟網站。
2. 上傳 CSV。
3. 確認欄位對應。
4. 按下「開始分析」。

CSV 只會在目前使用者的瀏覽器內處理，不會自動上傳到 GitHub 或其他伺服器。

## GitHub 上傳步驟

1. 先將下載的 ZIP 解壓縮。
2. 打開 GitHub Repository。
3. 點選 `uploading an existing file`，或 `Add file` → `Upload files`。
4. 將解壓縮後的以下檔案拖入：
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
   - `sample-sales.csv`
5. 不要直接上傳 ZIP。
6. 點擊 `Commit changes`。

## 啟用 GitHub Pages

1. 進入 Repository 的 `Settings`。
2. 左側選擇 `Pages`。
3. `Source` 選擇 `Deploy from a branch`。
4. Branch 選擇 `main`。
5. Folder 選擇 `/ (root)`。
6. 點擊 `Save`。

網站網址通常是：

`https://你的GitHub帳號.github.io/rakuten_jp/`

## CSV 必要欄位

程式不要求固定名稱，但分析前至少要指定：

- 日期
- 訂單編號
- 商品名稱
- 數量
- 營收

可選欄位：

- SKU／商品管理編號
- 平台
- 店鋪
- 廣告費

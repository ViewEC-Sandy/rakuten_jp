# Japan EC Dashboard V6

V6 修正 V5 登入後空白與權限不明確的問題。

## 主要升級

- 首次登入自動建立 `users/{uid}`
- 新帳號預設角色為 `viewer`
- 登入後初始化錯誤會顯示，不再直接白畫面
- Viewer 顯示權限提示
- Admin / Manager 可匯入 CSV
- Admin 可建立 Workspace 與查看使用者
- 每個 Workspace 的 CSV、模板與版面分開儲存

## 更新方式

1. 解壓縮 ZIP。
2. 保留你目前已設定好的 `firebase-config.js`。
3. 將 V6 的 `index.html`、`style.css`、`app.js`、`README.md` 上傳 GitHub 並覆蓋。
4. 將 `firestore.rules.txt` 的內容貼到 Cloud Firestore → 規則 → 發布。
5. 重新登入。

## 角色

- `admin`：可查看、匯入 CSV、新增 Workspace、查看使用者。
- `manager`：可查看與匯入 CSV。
- `viewer`：只能查看。

第一次登入若自動建立為 viewer，請到 Firestore：

```text
users / 你的 UID / role
```

把 role 改成 `admin` 或 `manager`，再登出並重新登入。

## 資料儲存

CSV 仍儲存在瀏覽器 localStorage，不會上傳 Firebase，也不會跨裝置同步。

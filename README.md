# 台股股票研究

追蹤順序：鼎元 2426、富采 3714、友達 2409。包含中長期基本面、估值試算、30 分／日／週／月 K 線、5／10／20 期均線、近 10 個交易日券資比及注意／處置警示。

網站：https://liaob890.github.io/tw-stock-research/ 。網站是否已發布以 Actions 部署結果為準。

## 雲端更新

GitHub Actions 在台北時間週一至週五 09:00–13:30 每半小時擷取行情，18:00 核對收盤行情、營收與注意／處置名單。GitHub 排程可能延遲，頁面保留實際資料日期及時間；不表示即時串流。電腦關機不影響已啟用的 GitHub 排程。

排程以儲存庫變數 `ENABLE_UPDATES=true` 啟用。可在 Actions 手動選擇 `publish`、`intraday` 或 `close`。只有測試與建置通過才發布，成功後才把新快照提交為下次比較基準。失敗步驟與每次成功摘要可在 Actions 查看；開啟的網頁每分鐘檢查新版並顯示更新提示。

## 研究核對

門檻在 `settings/alerts.json`，基準為 `data/last-successful-snapshot.json`，去重狀態在 `data/change-state.json`。保留每日報告、歷史變化及原始來源。休市沿用實際交易日；缺資料不補零；股價波動不直接改寫基本面結論。

18:00 使用免費的證交所、公開資訊觀測站與公司官方公開資料，由固定規則核對收盤行情、月營收、融資融券、注意／處置與既有重要變化門檻。流程不使用 OpenAI API，不需要 API 金鑰，也不產生 OpenAI API 費用。

新季報與公司事件只有在固定程式能從官方欄位完成核對時才更新；目前無法自動判讀的敘述維持「待確認」，不補零、不猜測，也不宣稱沒有變化。

## 本機開發與驗證

```text
cd site
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm build
pnpm dev
```

Node.js 22、pnpm 11.19.0。網站為 React + Vite 靜態頁面，重新整理按鈕讀取同目錄 `update-status.json`。GitHub Pages 只發布 `site/dist`；儲存庫公開程式及已授權的公開研究資料。帳號憑證、Sites 設定與本機部署權杖不包含在搬移內容中。

# 交通費申報表

每月交通費 claim 工具：港鐵站到站成人八達通票價自動計算（MTR Open Data），巴士手動輸入金額。

## 功能

- 月份選擇，自動生成 28–31 日表格，週六日淺黃底
- 每日行程：第一程、第二程……可逐日無限加程（＋ 加一程）
- 每程先選「港鐵 / 巴士」：
  - 港鐵：起點、終點用下拉選站（按綫分組），自動計成人八達通票價
  - 巴士：路線（選填）+ 手動輸入金額
- 常用行程：設定一次，套用到全部日子或只套用到工作日
- 本月合計、港鐵小計、巴士小計、有申報日數
- 資料只存喺瀏覽器 localStorage，唔會上傳去伺服器
- 列印 / 存為 PDF：橫向 A4，autofit，連簽署欄
- 匯出 CSV（Excel 友善，UTF-8 BOM）

## 即刻試

解壓後雙擊 `index.html` 就開到，唔使 server。

## 上 Render（免費 Static Site）

1. 將呢個資料夾 push 去 GitHub repo
2. Render → New → Static Site → 揀呢個 repo
3. Publish Directory 留空（即係 `.`），Build Command 留空
4. Deploy，之後每次 push 去 main 就自動重新部署

## 注意

- 港鐵票價來源：港鐵 Open Data `mtr_lines_fares.csv`（2026-10-26 下載），僅供參考，申報前請自行核對
- 機場快綫、輕鐵不在此表內，如需申報請用「巴士」欄手動輸入金額

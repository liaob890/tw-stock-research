// 研究敘述由核對流程維護；價格與估值輸入同步已核對快照。
export const sources = {
  "quote2426": {
    "label": "鼎元官方收盤價",
    "detail": "TWSE · 2026-09-10",
    "url": "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20260910&stockNo=2426"
  },
  "quote2409": {
    "label": "友達官方收盤價",
    "detail": "TWSE · 2026-09-10",
    "url": "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20260910&stockNo=2409"
  },
  "value2426": {
    "label": "鼎元官方估值",
    "detail": "TWSE · 本益比、淨值比、殖利率",
    "url": "https://www.twse.com.tw/exchangeReport/BWIBBU?response=json&date=20260910&stockNo=2426"
  },
  "value2409": {
    "label": "友達官方估值",
    "detail": "TWSE · 本益比、淨值比、殖利率",
    "url": "https://www.twse.com.tw/exchangeReport/BWIBBU?response=json&date=20260910&stockNo=2409"
  },
  "income": {
    "label": "證交所綜合損益表",
    "detail": "官方開放資料 · 連結隨公告更新",
    "url": "https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci"
  },
  "balance": {
    "label": "證交所資產負債表",
    "detail": "官方開放資料 · 連結隨公告更新",
    "url": "https://openapi.twse.com.tw/v1/opendata/t187ap07_L_ci"
  },
  "revenue": {
    "label": "證交所月營收",
    "detail": "首版保存 2026 年 7 月數據",
    "url": "https://openapi.twse.com.tw/v1/opendata/t187ap05_L"
  },
  "tynProduct": {
    "label": "鼎元技術發展",
    "detail": "公司官網 · 開發不等於量產營收",
    "url": "https://www.tyntek.com.tw/about_01.php"
  },
  "tynQ2": {
    "label": "鼎元 Q2 損益",
    "detail": "玉山證券轉載觀測站 · 2026/08/12",
    "url": "https://m.esunsec.com.tw/news/instant-detail.aspx?id=%7BFB2BF080-377E-4A74-9FE3-39E6E675E2B9%7D"
  },
  "tynCapex": {
    "label": "鼎元擴產公告",
    "detail": "玉山證券轉載重訊 · 2026/08/10",
    "url": "https://m.esunsec.com.tw/news/instant-detail.aspx?id=%7B3043ED0A-9FB1-4304-B6A7-8824DEFC82B6%7D"
  },
  "tynIssue": {
    "label": "鼎元現金增資公告",
    "detail": "玉山證券轉載重訊 · 2026/08/10",
    "url": "https://m.esunsec.com.tw/news/instant-detail.aspx?id=%7B4D216291-17A0-4134-B78A-AE462238A778%7D"
  },
  "tynCash": {
    "label": "鼎元現金流",
    "detail": "富聯網 · 2026 H1，次級資料",
    "url": "https://ww2.money-link.com.tw/TWStock/StockBasic.aspx?SymId=2426&TWMId=Basic_IIAM2"
  },
  "auoQ2": {
    "label": "友達 Q2 營運說明",
    "detail": "公司公告 · 2026/07/30",
    "url": "https://www.auo.com/zh-TW/News_Archive/detail/news_IR_20260730"
  },
  "auoCash": {
    "label": "友達 Q2 財務摘要",
    "detail": "官方 PDF · 頁 3–4，金額百萬元",
    "url": "https://www.auo.com/upload/media/ir/Financial_Information/2Q26_Finance_Statement_Chinese.pdf"
  },
  "quote3714": {
    "label": "富采官方收盤價",
    "detail": "TWSE · 2026-09-10",
    "url": "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20260910&stockNo=3714"
  },
  "value3714": {
    "label": "富采官方估值",
    "detail": "TWSE · 本益比未公布，並非零倍",
    "url": "https://www.twse.com.tw/exchangeReport/BWIBBU?response=json&date=20260910&stockNo=3714"
  },
  "ennIdentity": {
    "label": "富采公司基本資料",
    "detail": "上市公司富采控股股份有限公司 · 3714",
    "url": "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"
  },
  "ennH1": {
    "label": "富采2026上半年合併財報",
    "detail": "公司官方PDF · 損益頁9–10；現金流頁12–13；減資頁40",
    "url": "https://www.ennostar.com/uploads/files/shares/Investors/financial-report/115年度/115Q2合併(上傳版).pdf"
  },
  "ennFY": {
    "label": "富采2025全年合併財報",
    "detail": "公司官方PDF · 損益頁12",
    "url": "https://www.ennostar.com/uploads/files/shares/Investors/financial-report/114年度/114Q4合併(上傳版).pdf"
  },
  "enn9m": {
    "label": "富采2025前三季合併財報",
    "detail": "公司官方PDF · 損益頁9",
    "url": "https://www.ennostar.com/uploads/files/shares/Investors/financial-report/114年度/114Q3合併(上傳版).pdf"
  },
  "ennQ2": {
    "label": "富采Q2營運說明",
    "detail": "公司公告 · 2026/08/07",
    "url": "https://www.ennostar.com/news/news/6a7574ddd7614"
  },
  "ennMonthly": {
    "label": "富采官方月營收",
    "detail": "公司官方月報 · 最新2026年8月；金額千元",
    "url": "https://www.ennostar.com/monthly-report"
  },
  "ennMicroLED": {
    "label": "富采Micro LED光通訊技術進度",
    "detail": "公司公告 · 2026/08/05 · 技術成果不等同量產收入",
    "url": "https://www.ennostar.com/news/news/6a72d45d24fe3"
  },
  "ennCapital": {
    "label": "富采現金減資案",
    "detail": "公司4/9董事會公告；5/26股東會通過另見H1財報",
    "url": "https://www.ennostar.com/news/news/69dc4b8a376bd"
  }
};
export const stocks = [
  {
    "id": "2426",
    "name": "鼎元",
    "english": "TYNTEK",
    "business": "光電半導體",
    "price": 96.1,
    "change": -3.4,
    "changePct": -3.4170854271356785,
    "pe": 961,
    "pb": 7.53,
    "yield": 0.1,
    "revenue": 1237137,
    "gross": 262632,
    "operating": 72356,
    "profit": 83159,
    "eps": 0.28,
    "bvps": 12.76,
    "assets": 4744116,
    "liabilities": 908978,
    "currentAssets": 2805108,
    "currentLiabilities": 840895,
    "yoy": 36.31696631072261,
    "ytdYoy": 2.305503158448851,
    "verdict": "營運回升，估值期待偏高",
    "headline": "光通訊轉型，還要通過獲利的考驗。",
    "thesis": "既有 LED、紅外線及感測元件業務，正加入高速光通訊的成長機會。毛利率改善已有數據支持；未來訂單、量產規模與擴產效益，仍需要逐季驗證。",
    "findings": [
      {
        "title": "本業改善已出現",
        "body": "第二季營收 6.92 億元，毛利率 22.49%、營業利益率 8.04%，EPS 0.22 元。上半年有效稅率僅約 1.67%；低稅負可能放大稅後獲利，不能直接把單季 EPS 乘四作長期預測。",
        "source": "tynQ2"
      },
      {
        "title": "技術進度與商業成果需分開看",
        "body": "官網列出 2026 年開發 200G/lane PD、應用於 1.6T 高速光模組。這能支持技術方向，尚不能證明具體客戶、出貨量或未來營收占比。",
        "source": "tynProduct"
      },
      {
        "title": "擴產規模大，需要現金支持",
        "body": "公告投資機器設備與無塵室 12.61 億元，自第三季起陸續投入，約相當於六月底母公司權益的 32.88%。應關注投產時間、良率、折舊與資金回收。",
        "source": "tynCapex"
      },
      {
        "title": "現增稀釋應納入每股估值",
        "body": "董事會決議現增上限 1,500 萬股。以目前約 3.006 億股估算，股數最多增加約 4.99%；若獲利不變且全數發行，EPS 約稀釋 4.75%。尚非已完成發行，價格與時程待確認。",
        "source": "tynIssue"
      },
      {
        "title": "現金流為正，擴產將增加資金需求",
        "body": "次級資料顯示上半年營業現金流 1.606 億元、期末現金約 5.003 億元。負債占資產 19.16%，財務槓桿相對低；現金不能視為全數可用於擴產，仍需保留營運資金。",
        "source": "tynCash"
      }
    ],
    "watch": [
      "高速 PD 的量產收入與產品占比，有沒有具體揭露。",
      "營收成長能否延續，毛利及本業利益是否同步提升。",
      "12.61 億元擴產的執行、資金到位與產能利用率。",
      "現增股數、訂價及低稅率的可持續性。"
    ],
    "conclusion": "研究判斷：列入成長觀察，現有獲利尚難支撐價格；等待量產與獲利證據再重新評估。",
    "takeawayTitle": "成長要夠快，才能追上期待",
    "takeaway": "低負債與毛利改善是優點，但目前淨值評價反映較高期待。優先驗證光通訊量產、擴產回報與現金增資稀釋。",
    "priceDate": "2026-09-10"
  },
  {
    "id": "3714",
    "name": "富采",
    "english": "ENNOSTAR",
    "business": "光電半導體與感測",
    "price": 62,
    "priceDate": "2026-09-10",
    "change": -1.7,
    "changePct": -2.668759811616954,
    "pe": null,
    "pb": 1.05,
    "yield": 1.45,
    "revenue": 11569048,
    "gross": 1270535,
    "operating": -685091,
    "profit": 1095834,
    "eps": 1.49,
    "bvps": 58.81,
    "assets": 54424632,
    "liabilities": 10037205,
    "currentAssets": 30239815,
    "currentLiabilities": 8511068,
    "yoy": 14.233651516410827,
    "ytdYoy": 6.216052734434818,
    "monthlyPeriod": "2026-08",
    "financialPeriod": "2026H1",
    "verdict": "處分收益帶動轉盈，本業仍待修復",
    "headline": "從光電整合，走向能持續獲利的高值應用。",
    "thesis": "富采以車用、先進顯示、智能感測及新領域為轉型方向。營收回升已有資料支持，但第二季本業仍虧損，稅後轉盈主要由業外收益帶動；技術進展須繼續驗證量產收入與資本回報。",
    "findings": [
      {
        "title": "官方事實｜淨利轉正，本業尚未轉盈",
        "body": "第二季單季營收63.24億元、毛利率10.85%、營業損失3.79億元，歸母淨利12.45億元、EPS 1.69元。上半年營業損失6.85億元，不能將處分資產等業外收益視為持續本業獲利。",
        "source": "ennH1"
      },
      {
        "title": "官方事實｜營收增長，成長率回落",
        "body": "8月營收21.72億元、年增14.23%，前8月年增6.22%；相較7月年增24.92%放緩10.69個百分點。營收成長是否轉化為毛利與營業利益，需持續核對。",
        "source": "ennMonthly"
      },
      {
        "title": "公司展望｜高值應用維持出貨",
        "body": "公司對第三季車用與感測出貨持穩、Micro LED營收增長抱持期待。這是管理層展望，尚不能替代後續分產品營收、獲利或量產規模的正式揭露。",
        "source": "ennQ2"
      },
      {
        "title": "官方事實｜光通訊仍須區分技術與量產",
        "body": "公司8月公布藍光Micro LED在指定電流密度下達2.1 GHz調變頻寬，屬技術成果。該公告未提供光通訊量產收入與占比，研究上仍列為待驗證項目。",
        "source": "ennMicroLED"
      },
      {
        "title": "官方事實與研究推論｜減資及現金流影響估值",
        "body": "H1財報載明5月26日股東會通過約45.80%現金減資，基準日另訂；最新執行狀態仍待核對。上半年營業現金流1.57億元，低於設備支出7.91億元。研究上應追蹤資金用途及減資後每股基準，不將返還股款當作新增獲利。",
        "source": "ennH1"
      }
    ],
    "watch": [
      "本業虧損能否縮小、轉盈，並連續維持獲利。",
      "車用、感測與Micro LED的量產營收、利潤占比及客戶導入進度。",
      "光通訊技術成果能否形成正式量產訂單與收入，而非只看展示或頻寬。",
      "現金減資的核准、基準日、換股與資金用途；同步調整股數、淨值及K線比較基準。"
    ],
    "conclusion": "研究判斷：列入轉型觀察。先驗證本業獲利與現金流修復，並扣除一次性處分影響；現金減資後須重算每股估值。",
    "takeawayTitle": "淨利轉正，還要追蹤本業修復",
    "takeaway": "第二季仍有營業虧損，資產處分使稅後獲利回升。高值應用與光通訊具觀察價值，量產收入、現金流及減資後估值須逐項驗證。"
  },
  {
    "id": "2409",
    "name": "友達",
    "english": "AUO",
    "business": "顯示科技與解決方案",
    "price": 31.2,
    "change": 0.7,
    "changePct": 2.2950819672131146,
    "pe": 130,
    "pb": 1.52,
    "yield": 1.28,
    "revenue": 139922549,
    "gross": 17431638,
    "operating": -417279,
    "profit": 199555,
    "eps": 0.03,
    "bvps": 20.46,
    "assets": 377676390,
    "liabilities": 210774202,
    "currentAssets": 144236082,
    "currentLiabilities": 123417456,
    "yoy": -2.641163488049543,
    "ytdYoy": -1.213273334386655,
    "verdict": "單季轉盈，仍待本業持續改善",
    "headline": "從面板循環，走向可持續的獲利。",
    "thesis": "顯示科技、智慧移動與垂直場域構成轉型主軸。觀察重點是非消費應用能否穩定貢獻本業獲利，並讓投入資本獲得足夠回報。",
    "findings": [
      {
        "title": "第二季轉盈，尚未代表全年改善",
        "body": "公司公布第二季營收 708.9 億元、營業淨利約 2.2 億元、歸母淨利 13.4 億元，EPS 0.18 元。但上半年本業累計虧損 4.17 億元、EPS 僅 0.03 元；兩種期間不能混用。",
        "source": "auoQ2"
      },
      {
        "title": "淨利與本業獲利落差值得追蹤",
        "body": "官方損益表顯示上半年業外收入及支出淨額約 26.67 億元；合併淨利 10.81 億元中，歸母僅約 2.00 億元。估算股東獲利時，不能把非控制權益的淨利一併算入。",
        "source": "income"
      },
      {
        "title": "轉型有進展，也有需求壓力",
        "body": "公司說明第二季智慧移動營收季增 3%、垂直場域增 11%，顯示科技微減 0.3%。對第三季消費性電子需求看法仍偏弱。凌華自 2025 年六月底納入合併，年增比較須注意範圍變化。",
        "source": "auoQ2"
      },
      {
        "title": "現金流改善，持續投資仍必要",
        "body": "官方摘要以百萬元列示：上半年營業現金流約 68.77 億元，取得固定資產支出 55.50 億元。簡化相減為 13.27 億元，尚未扣無形資產與其他投入，非完整自由現金流。期末現金約 537.92 億元。",
        "source": "auoCash"
      },
      {
        "title": "淨值不是價格保證",
        "body": "每股淨值20.46元，與最新收盤價格的比較見估值卡片。負債占資產55.81%、流動比率116.87%；資產密集企業需觀察中期ROE、折舊與減損，不能只因低於昔日高點便認為便宜。",
        "source": "balance"
      }
    ],
    "watch": [
      "本業是否連續數季獲利，並降低對業外收益的依賴。",
      "智慧移動與垂直場域的利潤貢獻，而非只看營收規模。",
      "面板需求、庫存天數、資本支出及借款變動。",
      "資產處分與一次性利益，是否被誤當成持續獲利。"
    ],
    "conclusion": "研究判斷：列入轉型觀察。估值壓力小於鼎元，但仍缺支持穩定高 ROE 的本業紀錄。",
    "takeawayTitle": "轉盈只是開始，持續性才是關鍵",
    "takeaway": "第二季轉盈，上半年本業仍虧損。目前淨值評價需要車用與垂直場域改善持續獲利；無法只憑資產規模認定低估。",
    "priceDate": "2026-09-10"
  }
];

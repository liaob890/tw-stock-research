export const STOCK_CONFIG=[
  {id:'2426',name:'鼎元',theme:'blue',accent:'#4768e2',symbol:'T',tabNote:'光通訊 · 轉型觀察',defaultPe:30,quarterMethod:'Q4由全年減前三季、Q2由半年減Q1；毛利率以單季毛利除營收重算。'},
  {id:'3714',name:'富采',theme:'violet',accent:'#8554c5',symbol:'E',tabNote:'光電平台 · 獲利修復',defaultPe:20,quarterMethod:'Q4以全年減前三季；Q1由半年累計減財報直接列示的Q2單季；毛利率由單季金額重算。'},
  {id:'2409',name:'友達',theme:'teal',accent:'#258b80',symbol:'A',tabNote:'顯示 · 獲利修復',defaultPe:20,quarterMethod:'採官方單季財務摘要，原始金額以百萬元四捨五入；毛利率採官方公布百分比。'}
];
export const WATCHLIST=STOCK_CONFIG.map(({id,name})=>({id,name}));
export const stockConfig=id=>STOCK_CONFIG.find(s=>s.id===id)??STOCK_CONFIG[0];

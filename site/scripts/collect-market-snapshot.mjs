import {chooseMonthly,parseCompanyMonthly} from './monthly-source-core.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {rocDates} from './surveillance-core.mjs';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.resolve(site,'..');
const args=process.argv.slice(2),i=args.indexOf('--date'),date=i<0?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()):args[i+1];
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('使用 --date YYYY-MM-DD');
const baseline=JSON.parse((await readFile(path.join(root,'data','last-successful-snapshot.json'),'utf8')).replace(/^\uFEFF/,''));
const candidate=structuredClone(baseline);candidate.asOf=date;candidate.checkedAt=new Date().toISOString();candidate.verification='verified';
const runId=candidate.checkedAt.replaceAll(/[:.]/g,'-'),relativeRaw=`data/raw/${date}/market-${runId}`;
await mkdir(path.join(root,relativeRaw),{recursive:true});
const get=async(name,url)=>{const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`${name} HTTP ${response.status}`);const data=await response.json();await writeFile(path.join(root,relativeRaw,name+'.json'),JSON.stringify({source_url:url,retrieved_at:new Date().toISOString(),response:data},null,2));return data;};
const num=v=>{if(typeof v!=='number'&&typeof v!=='string')return null;const clean=String(v).replaceAll(',','').trim();if(!/^[+-]?\d+(\.\d+)?$/.test(clean))return null;const n=Number(clean);return Number.isFinite(n)?n:null;};
const period=s=>/^\d{5}$/.test(s)?`${Number(s.slice(0,3))+1911}-${s.slice(3)}`:null;
const failures=[];
let revenues;
try{revenues=await get('monthly_revenue','https://openapi.twse.com.tw/v1/opendata/t187ap05_L');if(!Array.isArray(revenues))throw new Error('月營收格式不符');}catch(e){failures.push(e.message);}
let companyMonths=[];
if(candidate.stocks.some(s=>s.id==='3714'))try{
  const source={label:'富采官方月營收',url:'https://www.ennostar.com/monthly-report'};
  const r=await fetch(source.url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('公司月報HTTP '+r.status);
  const html=await r.text(),rawFile=relativeRaw+'/3714-monthly.html';await writeFile(path.join(root,rawFile),html);
  companyMonths=parseCompanyMonthly(html,Number(date.slice(0,4)),source).filter(m=>m.period<date.slice(0,7)).map(m=>({...m,rawFile}));
}catch(e){candidate.companyRevenueCheck={status:'pending',message:e.message};}
for(const stock of candidate.stocks){
  try{
    const compact=date.replaceAll('-',''),quoteURL=`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${compact}&stockNo=${stock.id}`,valueURL=`https://www.twse.com.tw/exchangeReport/BWIBBU?response=json&date=${compact}&stockNo=${stock.id}`;
    const quotes=await get(stock.id+'_STOCK_DAY',quoteURL),values=await get(stock.id+'_BWIBBU',valueURL);
    if(quotes.stat!=='OK'||values.stat!=='OK'||!Array.isArray(quotes.data)||!Array.isArray(values.data))throw new Error('行情或估值來源不完整');
    const rows=quotes.data.filter(row=>rocDates(row[0])[0]&&rocDates(row[0])[0]<=date),last=rows.at(-1),previous=rows.at(-2),tradeDate=rocDates(last?.[0])[0],valuation=values.data.find(row=>rocDates(row[0])[0]===tradeDate);
    const close=num(last?.[6]),change=num(last?.[7]),previousClose=close!==null&&change!==null?close-change:null;
    if(close===null||change===null||previousClose===null||previousClose<=0||!tradeDate||!valuation)throw new Error('交易日、價格或同日估值無法核對');
    const previousDate=previous?rocDates(previous[0])[0]:stock.quote.tradingDate<tradeDate?stock.quote.tradingDate:null;
    stock.quote={verified:true,tradingDate:tradeDate,previousTradingDate:previousDate,close,previousClose,dailyChangePct:change/previousClose*100,volume:num(last[1]),pe:num(valuation[3]),pb:num(valuation[4]),dividendYieldPct:num(valuation[1]),source:{label:'證交所每日行情',url:quoteURL},valuationSource:{label:'證交所估值',url:valueURL},rawFile:`${relativeRaw}/${stock.id}_STOCK_DAY.json`,valuationRawFile:`${relativeRaw}/${stock.id}_BWIBBU.json`};
    const history=[...(stock.quoteHistory||[]),...rows.map(r=>({date:rocDates(r[0])[0],close:num(r[6]),volume:num(r[1])}))];
    stock.quoteHistory=[...new Map(history.map(r=>[r.date,r])).values()].filter(r=>r.close!==null).sort((a,b)=>a.date.localeCompare(b.date)).slice(-60);
  }catch(e){stock.quote={...stock.quote,verified:false};failures.push(`${stock.id}：${e.message}`);}
  const rev=revenues?.find(r=>String(r['公司代號'])===stock.id),month=rev?period(String(rev['資料年月'])):null;
  if(!rev||!month||num(rev['營業收入-去年同月增減(%)'])===null){stock.monthly={...stock.monthly,verified:false};failures.push(`${stock.id}：月營收待確認`);}
  else {stock.monthlyHistory=[...(stock.monthlyHistory||[]),stock.monthly].filter((m,i,a)=>a.findIndex(n=>n.period===m.period)===i);stock.monthly=chooseMonthly(stock.monthly,{verified:true,period:month,yoyPct:num(rev['營業收入-去年同月增減(%)']),ytdYoyPct:num(rev['累計營業收入-前期比較增減(%)']),revenue:num(rev['營業收入-當月營收']),source:{label:'證交所月營收',url:'https://openapi.twse.com.tw/v1/opendata/t187ap05_L'},rawFile:relativeRaw+'/monthly_revenue.json'});}
  if(stock.id==='3714'&&companyMonths.length){stock.monthly=chooseMonthly(stock.monthly,companyMonths.at(-1));stock.monthlyHistory=[...new Map([...(stock.monthlyHistory||[]),...companyMonths].map(m=>[m.period,m])).values()];}
  stock.eventCoverage=stock.eventCoverage.map(c=>({...c,status:'pending',detail:'本次公司公告尚待研究流程查核。前次追蹤：'+c.detail.replace(/^本次公司公告尚待研究流程查核。前次追蹤：/,'' )}));
}
candidate.marketOpen=candidate.stocks.some(s=>s.quote.verified&&s.quote.tradingDate===date);
candidate.verification=failures.length?'partial':'verified';candidate.collectionFailures=failures;
candidate.reviewNote='行情與月營收已依來源核對；發布前仍須檢查新季報、公司事件、研究判斷與處置公告，並補齊候選快照。';
const destination=path.join(root,'data','incoming',date+'.json');await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,JSON.stringify(candidate,null,2)+'\n');
console.log(JSON.stringify({candidate:destination,verification:candidate.verification,tradeDates:candidate.stocks.map(s=>({id:s.id,date:s.quote.tradingDate})),failures}));
if(failures.length)process.exitCode=1;

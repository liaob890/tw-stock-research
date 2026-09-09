import {addMovingAverages} from './chart-series-core.mjs';
export const TIMEFRAMES=[{value:'30m',label:'30分',title:'30 分 K 線',unit:'×30分',count:27},{value:'day',label:'日',title:'日 K 線',unit:'日',count:10},{value:'week',label:'週',title:'週 K 線',unit:'週',count:26},{value:'month',label:'月',title:'月 K 線',unit:'月',count:24}];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const dayMs=86400000;
export const taipeiTime=t=>new Date(t+28800000).toISOString().slice(0,16).replace('T',' ');
const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s).toISOString().slice(0,10)===s;
export function validOHLC(row){return ['open','high','low','close'].every(k=>finite(row[k])&&row[k]>0)&&row.low<=Math.min(row.open,row.close)&&row.high>=Math.max(row.open,row.close);}
export function aggregateCandles(history,period,asOf){
  if(!['day','week','month'].includes(period))throw new Error('不支援的K線週期');
  const rows=[...history].sort((a,b)=>a.date.localeCompare(b.date));
  if(rows.some(r=>!dateValid(r.date))||new Set(rows.map(r=>r.date)).size!==rows.length)throw new Error('K線日期無效或重複');
  const groups=new Map();
  for(const row of rows.filter(r=>r.date<=asOf)){
    const at=new Date(row.date+'T00:00:00Z'),monday=new Date(at.getTime()-((at.getUTCDay()+6)%7)*dayMs).toISOString().slice(0,10);
    const key=period==='month'?row.date.slice(0,7):period==='week'?monday:row.date;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  return [...groups].map(([key,items])=>{
    const first=items[0],last=items.at(-1),end=period==='month'?new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).toISOString().slice(0,10):period==='week'?new Date(Date.parse(key)+4*dayMs).toISOString().slice(0,10):key;
    const missing=items.some(r=>r.missing||!validOHLC(r));
    const base={date:period==='month'?key:period==='week'?key:first.date,from:first.date,to:last.date,partial:period!=='day'&&asOf<end,source:last.source,missing};
    return missing?base:{...base,open:first.open,high:Math.max(...items.map(r=>r.high)),low:Math.min(...items.map(r=>r.low)),close:last.close,volumeShares:items.every(r=>finite(r.volumeShares))?items.reduce((sum,r)=>sum+r.volumeShares,0):null};
  });
}
export function timeframeSeries(stock,period,asOf){
  const config=TIMEFRAMES.find(p=>p.value===period);if(!config)throw new Error('不支援的K線週期');
  const rows=period==='30m'?stock.intraday:aggregateCandles(stock.daily,period,asOf);
  return addMovingAverages(rows,'close').slice(-config.count);
}
export function reconcileIntradayClosing(history,daily){
  const out=structuredClone(history),byDate=new Map(daily.map(r=>[r.date,r]));
  for(const row of out){if(!row.date.endsWith(' 13:00')||row.missing)continue;
    const official=byDate.get(row.date.slice(0,10));
    if(official&&validOHLC(official)){row.close=official.close;row.high=Math.max(row.high,official.close);row.low=Math.min(row.low,official.close);row.closingSource=official.source;row.closingAuctionMerged=true;row.volumeShares=null;}
    else if(!row.closingAuctionMerged){row.missing=true;row.reason='收盤撮合資料待確認';for(const key of ['open','high','low','close'])delete row[key];}
  }
  for(const [date,official] of byDate){
    const bars=out.filter(r=>r.date.startsWith(date));
    if(bars.length!==9||bars.some(r=>r.missing))continue;
    const match=Math.abs(bars[0].open-official.open)<.015&&Math.abs(Math.max(...bars.map(r=>r.high))-official.high)<.015&&Math.abs(Math.min(...bars.map(r=>r.low))-official.low)<.015&&Math.abs(bars.at(-1).close-official.close)<.015;
    if(!match)for(const row of bars){row.missing=true;row.reason='分時與官方日開高低收不符';for(const key of ['open','high','low','close'])delete row[key];}
  }
  return out;
}
export function parseIntraday(envelope,id,checkedAt,calendar,delayMinutes=20){
  const result=envelope.payload?.chart?.result?.[0],meta=result?.meta,q=result?.indicators?.quote?.[0];
  if(envelope.payload?.chart?.error||meta?.symbol!==id+'.TW'||meta.exchangeTimezoneName!=='Asia/Taipei'||meta.dataGranularity!=='30m'||!Array.isArray(result.timestamp)||!q)throw new Error(id+' 30分K來源代碼、時區或格式不符');
  const cutoff=Math.min(Math.min(Date.parse(checkedAt),Date.parse(envelope.fetchedAt??checkedAt))-delayMinutes*60000,meta.regularMarketTime*1000);
  if(!finite(cutoff))throw new Error('30分K來源時間無效');
  const rows=new Map(),closing=[];
  result.timestamp.forEach((t,i)=>{
    if(!finite(t))throw new Error('30分K時間無效');
    const date=taipeiTime(t*1000),day=date.slice(0,10),time=date.slice(11),row={date,from:date,to:day+' '+(time==='13:00'?'13:30':taipeiTime(t*1000+1800000).slice(11)),open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volumeShares:q.volume?.[i],source:envelope.url};
    if(time==='13:30'){if(t*1000<=cutoff&&validOHLC(row))closing.push(row);return;}
    if(!/^(09|10|11|12):(00|30)$|^13:00$/.test(time))return;
    if(t*1000+1800000>cutoff)return;
    if(rows.has(date))throw new Error('30分K來源有重複時間');
    rows.set(date,validOHLC(row)?row:{date,from:date,to:row.to,missing:true,source:envelope.url});
  });
  // Yahoo may emit the closing auction as a separate zero-volume 13:30 point.
  // It belongs to the 13:00–13:30 bar, never to a fictional 13:30–14:00 session.
  for(const close of closing){const row=rows.get(close.date.slice(0,10)+' 13:00');if(row&&!row.missing){row.high=Math.max(row.high,close.high);row.low=Math.min(row.low,close.low);row.close=close.close;row.closingAuctionMerged=true;row.volumeShares=null;}}
  if(!rows.size)throw new Error(id+' 尚無已完成且來源已更新的30分K');
  const sorted=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)),first=sorted[0].date,last=sorted.at(-1).date,out=[];
  for(let day=Date.parse(first.slice(0,10));day<=Date.parse(last.slice(0,10));day+=dayMs){
    const date=new Date(day).toISOString().slice(0,10);
    if([0,6].includes(new Date(day).getUTCDay())||(calendar.year===Number(date.slice(0,4))&&calendar.holidayDates.includes(date)))continue;
    for(let slot=0;slot<9;slot++){const minute=540+slot*30,key=date+' '+String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');if(key<first||key>last)continue;out.push(rows.get(key)??{date:key,missing:true,source:envelope.url});}
  }
  return {history:out,lastCompletedAt:out.at(-1).to??out.at(-1).date,delayMinutes,missingBars:out.filter(r=>r.missing).length,source:envelope.url};
}

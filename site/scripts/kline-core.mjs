import {addMovingAverages} from './chart-series-core.mjs';

export const TIMEFRAMES=[
  {value:'5m',label:'5分',title:'5 分 K 線',unit:'×5分',count:54,intervalMinutes:5},
  {value:'15m',label:'15分',title:'15 分 K 線',unit:'×15分',count:54,intervalMinutes:15},
  {value:'30m',label:'30分',title:'30 分 K 線',unit:'×30分',count:54,intervalMinutes:30},
  {value:'60m',label:'60分',title:'60 分 K 線',unit:'×60分',count:54,intervalMinutes:60},
  {value:'day',label:'日',title:'日 K 線',unit:'日',count:10},
  {value:'week',label:'週',title:'週 K 線',unit:'週',count:26},
  {value:'month',label:'月',title:'月 K 線',unit:'月',count:24}
];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const dayMs=86400000,sessionStart=9*60,sessionEnd=13*60+30;
export const taipeiTime=t=>new Date(t+28800000).toISOString().slice(0,16).replace('T',' ');
const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s).toISOString().slice(0,10)===s;
const minuteLabel=minute=>String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
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

export function aggregateIntraday(history,intervalMinutes){
  if(![10,15,30,60].includes(intervalMinutes))throw new Error('不支援的分時彙整週期');
  const groups=new Map();
  for(const row of [...history].sort((a,b)=>a.date.localeCompare(b.date))){
    const match=/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/.exec(row.date);
    if(!match)throw new Error('分時K線時間無效');
    const minute=Number(match[2])*60+Number(match[3]);
    if(minute<sessionStart||minute>=sessionEnd||(minute-sessionStart)%5)throw new Error('5分K時間不在交易區間');
    const start=sessionStart+Math.floor((minute-sessionStart)/intervalMinutes)*intervalMinutes;
    const key=match[1]+' '+minuteLabel(start);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  const out=[];
  for(const [key,items] of groups){
    const start=Number(key.slice(11,13))*60+Number(key.slice(14,16)),end=Math.min(start+intervalMinutes,sessionEnd),expected=(end-start)/5;
    if(items.length!==expected)continue;
    const first=items[0],last=items.at(-1),day=key.slice(0,10);
    const missing=items.some(r=>r.missing||!validOHLC(r));
    const base={date:key,from:key,to:day+' '+minuteLabel(end),source:last.source,missing};
    if(last.closingSource)base.closingSource=last.closingSource;
    if(last.closingAuctionMerged)base.closingAuctionMerged=true;
    out.push(missing?base:{...base,open:first.open,high:Math.max(...items.map(r=>r.high)),low:Math.min(...items.map(r=>r.low)),close:last.close,volumeShares:items.every(r=>finite(r.volumeShares))?items.reduce((sum,r)=>sum+r.volumeShares,0):null});
  }
  return out;
}

export function timeframeSeries(stock,period,asOf){
  const config=TIMEFRAMES.find(p=>p.value===period);if(!config)throw new Error('不支援的K線週期');
  const stored=stock.intradayByInterval?.[period]??(period==='30m'?stock.intraday:undefined),five=stock.intradayByInterval?.['5m']??[];
  const rows=config.intervalMinutes?(stored??(config.intervalMinutes===5?[]:aggregateIntraday(five,config.intervalMinutes))):aggregateCandles(stock.daily,period,asOf);
  return addMovingAverages(rows,'close').slice(-config.count);
}

export function reconcileIntradayClosing(history,daily,intervalMinutes=5){
  if(![5,10,15,30].includes(intervalMinutes))throw new Error('不支援的分時核對週期');
  const out=structuredClone(history),byDate=new Map(daily.map(r=>[r.date,r])),lastSlot=minuteLabel(sessionEnd-intervalMinutes),expected=(sessionEnd-sessionStart)/intervalMinutes;
  for(const row of out){if(!row.date.endsWith(' '+lastSlot)||row.missing)continue;
    const official=byDate.get(row.date.slice(0,10));
    if(official&&validOHLC(official)){row.close=official.close;row.high=Math.max(row.high,official.close);row.low=Math.min(row.low,official.close);row.closingSource=official.source;row.closingAuctionMerged=true;row.volumeShares=null;}
    else if(!row.closingAuctionMerged){row.missing=true;row.reason='收盤撮合資料待確認';for(const key of ['open','high','low','close'])delete row[key];}
  }
  for(const [date,official] of byDate){
    const bars=out.filter(r=>r.date.startsWith(date));
    if(bars.length!==expected||bars.some(r=>r.missing))continue;
    const match=Math.abs(bars[0].open-official.open)<.015&&Math.abs(Math.max(...bars.map(r=>r.high))-official.high)<.015&&Math.abs(Math.min(...bars.map(r=>r.low))-official.low)<.015&&Math.abs(bars.at(-1).close-official.close)<.015;
    if(!match)for(const row of bars){row.missing=true;row.reason='分時與官方日開高低收不符';for(const key of ['open','high','low','close'])delete row[key];}
  }
  return out;
}

export function parseIntraday(envelope,id,checkedAt,calendar,intervalMinutes=5,delayMinutes=20){
  if(intervalMinutes!==5)throw new Error('分時來源必須使用5分K');
  const result=envelope.payload?.chart?.result?.[0],meta=result?.meta,q=result?.indicators?.quote?.[0],granularity=intervalMinutes+'m';
  if(envelope.payload?.chart?.error||meta?.symbol!==id+'.TW'||meta.exchangeTimezoneName!=='Asia/Taipei'||meta.dataGranularity!==granularity||!Array.isArray(result.timestamp)||!q)throw new Error(id+' '+intervalMinutes+'分K來源代碼、時區或格式不符');
  const cutoff=Math.min(Math.min(Date.parse(checkedAt),Date.parse(envelope.fetchedAt??checkedAt))-delayMinutes*60000,meta.regularMarketTime*1000);
  if(!finite(cutoff))throw new Error(intervalMinutes+'分K來源時間無效');
  const rows=new Map(),closing=[],barMs=intervalMinutes*60000;
  result.timestamp.forEach((t,i)=>{
    if(!finite(t))throw new Error(intervalMinutes+'分K時間無效');
    const date=taipeiTime(t*1000),day=date.slice(0,10),time=date.slice(11),minute=Number(time.slice(0,2))*60+Number(time.slice(3));
    const row={date,from:date,to:day+' '+minuteLabel(Math.min(minute+intervalMinutes,sessionEnd)),open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volumeShares:q.volume?.[i],source:envelope.url};
    if(minute===sessionEnd){if(t*1000<=cutoff&&validOHLC(row))closing.push(row);return;}
    if(minute<sessionStart||minute>=sessionEnd||(minute-sessionStart)%intervalMinutes)return;
    if(t*1000+barMs>cutoff)return;
    if(rows.has(date))throw new Error(intervalMinutes+'分K來源有重複時間');
    rows.set(date,validOHLC(row)?row:{date,from:date,to:row.to,missing:true,source:envelope.url});
  });
  for(const close of closing){const key=close.date.slice(0,10)+' '+minuteLabel(sessionEnd-intervalMinutes),row=rows.get(key);if(row&&!row.missing){row.high=Math.max(row.high,close.high);row.low=Math.min(row.low,close.low);row.close=close.close;row.closingAuctionMerged=true;row.volumeShares=null;}}
  if(!rows.size)return {history:[],lastCompletedAt:null,delayMinutes,missingBars:0,source:envelope.url};
  const sorted=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)),first=sorted[0].date,last=sorted.at(-1).date,out=[];
  for(let day=Date.parse(first.slice(0,10));day<=Date.parse(last.slice(0,10));day+=dayMs){
    const date=new Date(day).toISOString().slice(0,10);
    if([0,6].includes(new Date(day).getUTCDay())||(calendar.year===Number(date.slice(0,4))&&calendar.holidayDates.includes(date)))continue;
    for(let minute=sessionStart;minute<sessionEnd;minute+=intervalMinutes){const key=date+' '+minuteLabel(minute);if(key<first||key>last)continue;out.push(rows.get(key)??{date:key,from:key,to:date+' '+minuteLabel(minute+intervalMinutes),missing:true,source:envelope.url});}
  }
  return {history:out,lastCompletedAt:out.at(-1).to,delayMinutes,missingBars:out.filter(r=>r.missing).length,source:envelope.url};
}

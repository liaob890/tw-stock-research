import {WATCHLIST} from '../lib/watchlist.mjs';
export {WATCHLIST};
export const INTRADAY_SLOT_MINUTES=Array.from({length:55},(_,index)=>540+index*5);
export const SLOT_MINUTES=[...INTRADAY_SLOT_MINUTES,1080];
export const schedule={timezone:'Asia/Taipei',startDate:'2026-09-08',weekdays:[1,2,3,4,5],intradayStart:'09:00',intradayEnd:'13:30',intervalMinutes:5,disposalTime:'18:00',maxQuoteAgeMinutes:20};
export const taipeiDate=now=>new Date(new Date(now).getTime()+28800000).toISOString().slice(0,10);
export function nextSlots(now,count=1){
  const result=[],base=new Date(taipeiDate(now)+'T00:00:00Z');
  for(let i=0;result.length<count&&i<370;i++){
    const day=new Date(base.getTime()+i*86400000),date=day.toISOString().slice(0,10);
    if(date<schedule.startDate||!schedule.weekdays.includes(day.getUTCDay()))continue;
    for(const minute of SLOT_MINUTES){const at=`${date}T${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}:00+08:00`;if(Date.parse(at)>new Date(now).getTime())result.push(at);if(result.length===count)break;}
  }return result;
}
export function validDate(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;}
export function marketDayState(now,calendar){const date=taipeiDate(now);if([0,6].includes(new Date(date).getUTCDay()))return 'closed';if(calendar?.year!==Number(date.slice(0,4)))return 'unknown';return calendar.holidayDates.includes(date)?'closed':'weekday';}
const numeric=(value,label,{positive=false}={})=>{if(value===null||value===undefined||!/^\d+(?:\.\d+)?$/.test(String(value).replaceAll(',','').trim()))throw new Error(label+'缺少有效數值');const n=Number(String(value).replaceAll(',',''));if(!Number.isFinite(n)||(positive&&n<=0))throw new Error(label+'無效');return n;};
export const payload=envelope=>envelope?.payload??envelope?.response??envelope;
export function parseQuotes(envelope,checkedAt=new Date().toISOString(),maxAgeMinutes=20){
  const response=payload(envelope);if(response?.rtcode!=='0000'||!Array.isArray(response.msgArray))throw new Error('MIS行情回應不完整');
  return WATCHLIST.map(stock=>{
    const matches=response.msgArray.filter(row=>row.c===stock.id&&row.ex==='tse');if(matches.length!==1)throw new Error(stock.id+'行情缺漏或重複');
    const r=matches[0],date=String(r.d).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
    if(!validDate(date)||!/^\d{2}:\d{2}:\d{2}$/.test(r.t)||r.t<'09:00:00'||r.t>'13:30:00')throw new Error(stock.id+'一般交易成交時間無效');
    const timestamp=`${date}T${r.t}+08:00`,time=Date.parse(timestamp),now=Date.parse(checkedAt);
    if(!Number.isFinite(time)||time>now+60000)throw new Error(stock.id+'行情時間超前');
    const last=numeric(r.z,'成交价',{positive:true}),previousClose=numeric(r.y,'昨收',{positive:true}),volumeLots=numeric(r.v,'成交張數');
    const today=taipeiDate(checkedAt),localTime=new Date(now+28800000).toISOString().slice(11,19);
    const state=date!==today?'awaiting':localTime>='13:30:00'?'closed':now-time>maxAgeMinutes*60000?'stale':'intraday';
    return {...stock,tradingDate:date,time:r.t,timestamp,last,previousClose,change:last-previousClose,changePct:(last/previousClose-1)*100,volumeLots,state,source:envelope.url??envelope.source??'https://mis.twse.com.tw/stock/index.jsp'};
  });
}
const MARGIN_FIELDS=['代號','名稱','買進','賣出','現金償還','前日餘額','今日餘額','次一營業日限額','買進','賣出','現券償還','前日餘額','今日餘額','次一營業日限額','資券互抵','註記'];
export function parseMargins(envelope,requestedDate){
  const r=payload(envelope),date=String(r?.date).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
  if(r?.stat!=='OK'||!validDate(date)||date!==requestedDate)throw new Error('融資融券資料日期或回應不符');
  const tables=r.tables?.filter(t=>t.title?.includes('融資融券彙總'));
  if(tables?.length!==1)throw new Error('缺少融資融券彙總表');
  const table=tables[0],titleDate=`${Number(date.slice(0,4))-1911}年${date.slice(5,7)}月${date.slice(8)}日`;
  if(!table.title.includes(titleDate)||JSON.stringify(table.fields)!==JSON.stringify(MARGIN_FIELDS)||!Array.isArray(table.data))throw new Error('融資融券表格格式或標題變更');
  return WATCHLIST.map(stock=>{
    const rows=table.data.filter(row=>row[0]===stock.id);if(rows.length!==1)throw new Error(stock.id+'融資融券缺漏或重複');const row=rows[0];
    const financingPrevious=numeric(row[5],'融資前日'),financing=numeric(row[6],'融資餘額'),shortPrevious=numeric(row[11],'融券前日'),short=numeric(row[12],'融券餘額');
    if(![financingPrevious,financing,shortPrevious,short].every(Number.isInteger))throw new Error('交易單位非整數');
    return {...stock,date,financing,financingChange:financing-financingPrevious,short,shortChange:short-shortPrevious,ratioPct:financing>0?short/financing*100:null,ratioStatus:financing>0?'verified':'not_applicable',unit:'張',source:envelope.url??envelope.source??`https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date=${date.replaceAll('-','')}&selectType=ALL&response=html`};
  });
}
export function mergeMarginHistory(previous,rows){
  return WATCHLIST.map(s=>{const old=previous?.stocks?.find(x=>x.id===s.id)?.history??[];const combined=new Map(old.map(x=>[x.date,x]));for(const row of rows.filter(x=>x.id===s.id))combined.set(row.date,row);return {...s,history:[...combined.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-60)};});
}

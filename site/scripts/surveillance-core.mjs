import {WATCHLIST} from '../lib/watchlist.mjs';
export {WATCHLIST};
export const clean = value => String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').trim();
export function rocDates(text) {
  return [...clean(text).matchAll(/(\d{3})[年/.](\d{1,2})[月/.](\d{1,2})日?/g)].map(m=>`${Number(m[1])+1911}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`);
}
export function sourceRows(envelope, required, date, kind) {
  const r=envelope?.response;
  if(r?.stat!=='OK' || !Array.isArray(r.fields) || !Array.isArray(r.data)) throw new Error(`${kind}：官方回應不完整，不能判定未列入`);
  if(!required.every(f=>r.fields.includes(f))) throw new Error(`${kind}：欄位格式已變更`);
  const dates=rocDates(r.title);
  if(kind==='notetrans' && dates[0]!==date) throw new Error('可能達處置名單日期不符');
  if(kind==='notice' && (dates[0]!==date || dates[1]!==date)) throw new Error('注意名單查詢日期不符');
  if(kind==='punish' && !dates.includes(date)) throw new Error('處置名單查詢日期不符');
  if(r.total!=null && Number(r.total)!==r.data.length) throw new Error(`${kind}：資料可能不完整`);
  return r.data.map(row=>Object.fromEntries(r.fields.map((f,i)=>[f,clean(row[i])])));
}
export function buildSurveillance(input,date,checkedAt) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error('日期格式錯誤');
  const attention=sourceRows(input.notice,['證券代號','注意交易資訊','日期'],date,'notice');
  const imminent=sourceRows(input.notetrans,['證券代號','近期達本公司「公布注意交易資訊」標準之情形'],date,'notetrans');
  const disposal=sourceRows(input.punish,['證券代號','公布日期','處置起迄時間','處置條件','處置措施','處置內容'],date,'punish');
  const records=WATCHLIST.map(stock=>{
    const notices=attention.filter(r=>r['證券代號']===stock.id).map(r=>({date:rocDates(r['日期'])[0]||date,reason:r['注意交易資訊']}));
    const trigger=imminent.find(r=>r['證券代號']===stock.id);
    const punishments=disposal.filter(r=>r['證券代號']===stock.id).map(r=>{
      const [start,end]=rocDates(r['處置起迄時間']);
      if(!start || !end || start>end) throw new Error(`${stock.id}：處置期間無法解析`);
      return {announcedOn:rocDates(r['公布日期'])[0]||null,start,end,period:r['處置起迄時間'],reason:r['處置條件'],measure:r['處置措施'],detail:r['處置內容'],state:start>date?'scheduled':end<date?'ended':'active'};
    });
    const level=punishments.some(r=>r.state==='active')?'active':punishments.some(r=>r.state==='scheduled')?'scheduled':trigger?'imminent':notices.length?'attention':'clear';
    return {...stock,level,notices,punishments,trigger:trigger?{summary:trigger['近期達本公司「公布注意交易資訊」標準之情形']}:null};
  });
  return {asOf:date,checkedAt,status:'verified',sources:Object.fromEntries(Object.entries(input).map(([key,e])=>[key,{url:e.source,title:e.response.title,rows:e.response.data.length}])),records};
}
export function surveillanceChanges(previous,next) {
  return next.records.flatMap(record=>{
    const before=previous?.records?.find(r=>r.id===record.id);
    if(!before) return [{id:record.id,name:record.name,kind:'baseline',before:null,after:record}];
    return JSON.stringify(before)===JSON.stringify(record)?[]:[{id:record.id,name:record.name,kind:'changed',before,after:record}];
  });
}
export function freshness(asOf,now) {
  if(!asOf || Number.isNaN(Date.parse(asOf))) return 'unknown';
  let next=Date.parse(asOf+'T18:00:00+08:00')+86400000;
  while([0,6].includes(new Date(next+28800000).getUTCDay()))next+=86400000;
  return now>=next?'overdue':'current';
}

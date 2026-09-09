const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const numeric=(n,label)=>{const s=String(n??'').replaceAll(',','').trim();if(!/^\d+(\.\d+)?$/.test(s))throw new Error(label+'缺少有效數值');return Number(s);};
export function parsePriceMonth(envelope,id,month,asOf){
  const r=envelope.payload??envelope.response,fields=['日期','成交股數','成交金額','開盤價','最高價','最低價','收盤價','漲跌價差','成交筆數'];
  if(r?.stat!=='OK'||!r.title?.includes(id)||r.date?.slice(0,6)!==month||JSON.stringify(r.fields?.slice(0,9))!==JSON.stringify(fields)||!Array.isArray(r.data))throw new Error(id+'日K來源格式、月份或代碼不符');
  const rows=r.data.map(row=>{
    const m=/^(\d{3})\/(\d{2})\/(\d{2})$/.exec(row[0]),date=m?`${Number(m[1])+1911}-${m[2]}-${m[3]}`:'';
    if(!validDate(date)||date.replaceAll('-','').slice(0,6)!==month)throw new Error('日K日期不符');
    const open=numeric(row[3],'開盤'),high=numeric(row[4],'最高'),low=numeric(row[5],'最低'),close=numeric(row[6],'收盤'),volumeShares=numeric(row[1],'成交股數');
    if(low<=0||low>Math.min(open,close)||high<Math.max(open,close)||!Number.isInteger(volumeShares))throw new Error('日K價格範圍或成交股數無效');
    return {date,open,high,low,close,volumeShares,source:envelope.url??envelope.source_url};
  }).filter(row=>row.date<=asOf);
  if(new Set(rows.map(r=>r.date)).size!==rows.length)throw new Error('日K來源有重複日期');
  return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
export function alignTradingDays(history,asOf,calendar){
  if(!validDate(asOf))throw new Error('圖表基準日期無效');
  const rows=[...new Map(history.filter(r=>validDate(r.date)&&r.date<=asOf).map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(!rows.length)return [];
  const byDate=new Map(rows.map(r=>[r.date,r])),out=[];
  for(let at=Date.parse(rows[0].date);at<=Date.parse(asOf);at+=86400000){
    const date=new Date(at).toISOString().slice(0,10),weekend=[0,6].includes(new Date(at).getUTCDay()),holiday=calendar?.year===Number(date.slice(0,4))&&calendar.holidayDates.includes(date);
    if(weekend||holiday)continue;
    out.push(byDate.get(date)??{date,missing:true});
  }return out;
}
export function addMovingAverages(rows,key,periods=[5,10,20]){
  return rows.map((row,index)=>({...row,...Object.fromEntries(periods.map(period=>{
    if(!Number.isInteger(period)||period<1)throw new Error('均線天數無效');
    const values=rows.slice(Math.max(0,index-period+1),index+1).map(r=>r[key]);
    return ['ma'+period,values.length===period&&values.every(finite)?values.reduce((sum,n)=>sum+n,0)/period:null];
  }))}));
}
export function chartWindow(history,key,asOf,calendar,settings){
  return addMovingAverages(alignTradingDays(history,asOf,calendar),key,settings.maPeriods).slice(-settings.displayTradingDays);
}
export function candleGeometry({x,y,width,height,open,high,low,close}){
  if(![x,y,width,height,open,high,low,close].every(finite))return null;
  const toY=value=>high===low?y:y+(high-value)/(high-low)*height;
  const bodyWidth=Math.min(6,width*.6);
  return {center:x+width/2,wickTop:y,wickBottom:y+height,bodyX:x+(width-bodyWidth)/2,bodyWidth,bodyY:toY(Math.max(open,close)),bodyHeight:Math.max(1,Math.abs(toY(open)-toY(close))),rising:close>=open};
}

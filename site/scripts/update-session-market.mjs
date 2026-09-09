import {readFile,writeFile,mkdir,rename,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WATCHLIST,parseQuotes,parseMargins,mergeMarginHistory,payload,taipeiDate,schedule,marketDayState} from './market-session-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
const fixtures=args.includes('--input-dir')?arg('--input-dir'):null;
const checkedAt=new Date().toISOString(),date=taipeiDate(checkedAt),stamp=checkedAt.replaceAll(':','-');
const rawDir=path.join(root,'..','data','raw',date,'session',stamp);
const read=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const atomic=async(file,data)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(file+'.tmp',file);};
const jsonFile=name=>path.join(root,'lib',name+'.json');
const misUrl='https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch='+WATCHLIST.map(s=>'tse_'+s.id+'.tw').join('%7C')+'&json=1&delay=0';
const fetchJson=async(url,name)=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/json','User-Agent':'StockAnalysis/1.0'}});if(!r.ok)throw new Error('HTTP '+r.status);const envelope={url,fetchedAt:new Date().toISOString(),payload:await r.json()};await atomic(path.join(rawDir,name+'.json'),envelope);return envelope;};
let oldMargins=null;try{oldMargins=await read(jsonFile('margin-data'));}catch(e){if(e.code!=='ENOENT')throw e;}
const check={checkedAt,quotes:'pending',margins:'pending',messages:[]};
try{
  const envelope=fixtures?await read(path.join(fixtures,`mis-${date.replaceAll('-','')}.json`)):await fetchJson(misUrl,'mis');
  let quotes=parseQuotes(envelope,checkedAt,schedule.maxQuoteAgeMinutes);
  try{const previous=await read(jsonFile('session-market'));quotes=quotes.map(q=>{const prior=previous.quotes.find(p=>p.id===q.id);return prior&&prior.timestamp>q.timestamp?{...prior,state:'awaiting'}:q;});}catch(e){if(e.code!=='ENOENT')throw e;}
  const snapshot={checkedAt,fetchedAt:envelope.fetchedAt??checkedAt,quotes};
  await atomic(jsonFile('session-market'),snapshot);await atomic(path.join(root,'..','data','sessions',stamp+'.json'),snapshot);
  check.quotes=quotes.every(q=>q.state==='intraday'||q.state==='closed')?'verified':'awaiting';
}catch(e){check.quotes='failed';check.messages.push('行情待確認：'+e.message);}
try{
  const all=[];
  if(fixtures){for(const name of (await readdir(fixtures)).filter(n=>/^margin-\d{8}\.json$/.test(n)).sort()){
    const requested=name.slice(7,15).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');if(requested>date)continue;
    const envelope=await read(path.join(fixtures,name));all.push(...parseMargins(envelope,requested));
  }}else{
    for(let days=0;days<=10;days++){
      const day=new Date(Date.parse(date+'T00:00:00Z')-days*86400000);if([0,6].includes(day.getUTCDay()))continue;
      const requested=day.toISOString().slice(0,10),compact=requested.replaceAll('-','');
      const envelope=await fetchJson(`https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date=${compact}&selectType=ALL&response=json`,'margin-'+compact);
      if(/沒有符合條件|很抱歉/.test(payload(envelope)?.stat??''))continue;
      all.push(...parseMargins(envelope,requested));break;
    }
  }
  if(!all.length)throw new Error('沒有已公布的有效融資融券資料');
  const settings=await read(jsonFile('chart-settings')),calendar=await read(jsonFile('trading-calendar'));
  const required=settings.displayTradingDays+Math.max(...settings.maPeriods)-1;
  const latestDate=all.map(r=>r.date).sort().at(-1);
  const known=new Set([...(oldMargins?.stocks??[]).flatMap(s=>s.history.map(r=>s.id+':'+r.date)),...all.map(r=>r.id+':'+r.date)]);
  let covered=0;
  for(let offset=0;offset<80&&covered<required;offset++){
    const day=new Date(Date.parse(latestDate+'T00:00:00Z')-offset*86400000),requested=day.toISOString().slice(0,10);
    if([0,6].includes(day.getUTCDay())||(calendar.year===day.getUTCFullYear()&&calendar.holidayDates.includes(requested)))continue;
    if(!WATCHLIST.every(s=>known.has(s.id+':'+requested))){
      if(fixtures)throw new Error('資券歷史不足以計算完整20日均線：'+requested);
      const compact=requested.replaceAll('-','');
      const envelope=await fetchJson('https://www.twse.com.tw/rwd/zh/marginTrading/MI_MARGN?date='+compact+'&selectType=ALL&response=json','margin-'+compact);
      const extra=parseMargins(envelope,requested);all.push(...extra);extra.forEach(r=>known.add(r.id+':'+r.date));
    }
    covered++;
  }
  if(covered<required)throw new Error('融資融券歷史不足，保留前次成功資料');
  const stocks=mergeMarginHistory(oldMargins,all),asOf=stocks[0].history.at(-1).date;
  await atomic(jsonFile('margin-data'),{checkedAt,asOf,formula:'融券餘額 ÷ 融資餘額 × 100%',stocks});
  await atomic(path.join(root,'..','data','margin',asOf+'.json'),{checkedAt,asOf,stocks});check.margins='verified';
}catch(e){check.margins='failed';check.messages.push('融資融券待確認：'+e.message);}
await atomic(jsonFile('session-check'),check);
await atomic(path.join(root,'..','data','session-publication.json'),{status:'pending',checkedAt,quotes:check.quotes,margins:check.margins,note:'部署成功後才標記 published；失敗保留线上成功版本。'});
console.log(JSON.stringify(check));if(check.quotes==='failed'||check.margins==='failed')process.exitCode=1;

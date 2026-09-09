import {readFile,writeFile,mkdir,rename,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parsePriceMonth,alignTradingDays} from './chart-series-core.mjs';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.resolve(site,'..');
const args=process.argv.slice(2),arg=key=>args[args.indexOf(key)+1];
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const market=await read(path.join(site,'lib/market-snapshot.json')),calendar=await read(path.join(site,'lib/trading-calendar.json'));
const asOf=args.includes('--date')?arg('--date'):market.stocks.map(s=>s.quote.tradingDate).sort()[0];
if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||asOf>market.stocks.map(s=>s.quote.tradingDate).sort()[0])throw new Error('日K基準不能晚於已核對收盤日期');
const inputDir=args.includes('--input-dir')?arg('--input-dir'):null,checkedAt=new Date().toISOString();
const save=async(file,data)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(file+'.tmp',file);};
const stocks=[];
// Fetch three calendar months for 20-day averages; never calculate from only the visible ten bars.
for(const stock of market.stocks){
  const rows=[];
  const base=new Date(asOf.slice(0,7)+'-01T00:00:00Z');
  for(let offset=2;offset>=0;offset--){
    const month=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()-offset,1)).toISOString().slice(0,7).replace('-','');
    const url=`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${month}01&stockNo=${stock.id}`;
    let envelope;
    if(inputDir)envelope=await read(path.join(inputDir,`stock-day-${stock.id}-${month}.json`));
    else{const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/json'}});if(!r.ok)throw new Error('日K HTTP '+r.status);envelope={url,fetchedAt:new Date().toISOString(),payload:await r.json()};}
    await save(path.join(root,'data','raw',asOf,'price-history',`${stock.id}-${month}.json`),envelope);
    rows.push(...parsePriceMonth(envelope,stock.id,month,asOf));
  }
  const chartSettings=await read(path.join(site,'lib/chart-settings.json'));
  const required=chartSettings.displayTradingDays+Math.max(...chartSettings.maPeriods)-1;
  const history=alignTradingDays(rows,asOf,calendar).slice(-required);
  if(history.length<required||history.some(r=>r.missing))throw new Error(stock.id+'日K歷史不足或缺少交易日，保留上次版本');
  const last=history.at(-1);if(last.date!==stock.quote.tradingDate||last.close!==stock.quote.close)throw new Error(stock.id+'日K與正式收盤基準不一致');
  stocks.push({id:stock.id,name:stock.name,history:history.slice(-90)});
}
const result={asOf,checkedAt,adjustment:'unadjusted',stocks};
await save(path.join(site,'lib/price-history.json'),result);await save(path.join(root,'data','price-history',asOf+'.json'),result);
console.log(JSON.stringify({asOf,stocks:stocks.map(s=>({id:s.id,days:s.history.length,from:s.history[0].date,to:s.history.at(-1).date})),status:'verified'}));

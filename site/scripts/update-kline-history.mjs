import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {WATCHLIST} from '../lib/watchlist.mjs';
import {parsePriceMonth} from './chart-series-core.mjs';
import {aggregateIntraday,parseIntraday,reconcileIntradayClosing} from './kline-core.mjs';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.resolve(site,'..');
const args=process.argv.slice(2),arg=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const intradayOnly=args.includes('--intraday-only'),dailyInput=arg('--daily-input-dir'),intradayInput=arg('--intraday-input-dir');
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const save=async(p,v)=>{await mkdir(path.dirname(p),{recursive:true});await writeFile(p+'.tmp',JSON.stringify(v,null,2)+'\n');await rename(p+'.tmp',p);};
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 StockAnalysis/1.0'}});if(!r.ok)throw new Error('K線 HTTP '+r.status);return {url,fetchedAt:new Date().toISOString(),payload:await r.json()};};
const intradayPeriods=['5m','15m','30m','60m'];
const market=await read(path.join(site,'lib/market-snapshot.json')),calendar=await read(path.join(site,'lib/trading-calendar.json'));
let prior;try{prior=await read(path.join(site,'lib/kline-history.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
const checkedAt=new Date().toISOString(),asOf=intradayOnly?prior?.asOf:market.stocks.map(s=>s.quote.tradingDate).sort()[0];
if(!asOf)throw new Error('請先建立日K歷史基準');
const stocks=[],check={checkedAt,status:'verified',messages:[]};
try{
  for(const stock of WATCHLIST){
    const previous=prior?.stocks.find(s=>s.id===stock.id);let daily=previous?.daily;
    if(!intradayOnly){
      daily=[];const base=new Date(asOf.slice(0,7)+'-01T00:00:00Z');
      for(let offset=44;offset>=0;offset--){
        const month=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()-offset,1)).toISOString().slice(0,7).replace('-','');
        const cache=path.join(root,'data/raw/kline/daily',stock.id+'_'+month+'.json');let envelope;
        if(dailyInput)envelope=await read(path.join(dailyInput,stock.id+'_'+month+'.json'));
        else{if(offset>0){try{envelope=await read(cache);}catch(e){if(e.code!=='ENOENT')throw e;}}if(!envelope)envelope=await get(`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${month}01&stockNo=${stock.id}`);}
        envelope.url??=envelope.sourceUrl;
        daily.push(...parsePriceMonth(envelope,stock.id,month,asOf));await save(cache,envelope);
      }
      const quote=market.stocks.find(s=>s.id===stock.id).quote;
      if(daily.length<800||daily.at(-1).date!==quote.tradingDate||daily.at(-1).close!==quote.close)throw new Error(stock.id+' 長期日K不足或與正式收盤基準不符');
    }
    if(!daily?.length)throw new Error(stock.id+' 缺少已核對日K歷史');
    const url=`https://query1.finance.yahoo.com/v8/finance/chart/${stock.id}.TW?interval=5m&range=1mo`;
    const envelope=intradayInput?await read(path.join(intradayInput,`yahoo-chart-${stock.id}-5m-1mo.json`)):await get(url);
    await save(path.join(root,'data/raw/kline/intraday',checkedAt.replaceAll(':','-'),stock.id+'.json'),envelope);
    const result=parseIntraday(envelope,stock.id,checkedAt,calendar,5,20),previousIntervals=previous?.intradayByInterval??{'30m':previous?.intraday??[]};
    let intradayByInterval;
    if(result.history.length){
      const five=reconcileIntradayClosing(result.history,daily,5);
      intradayByInterval={'5m':five,'15m':aggregateIntraday(five,15),'30m':aggregateIntraday(five,30),'60m':aggregateIntraday(five,60)};
      for(const period of intradayPeriods)if(previousIntervals[period]?.at(-1)?.date>intradayByInterval[period]?.at(-1)?.date)throw new Error(stock.id+' '+period+' 資料時間倒退，保留前次成功版本');
    }else{
      const five=previousIntervals['5m']??[];
      intradayByInterval={'5m':five,'15m':previousIntervals['15m']??aggregateIntraday(five,15),'30m':previousIntervals['30m']??aggregateIntraday(five,30),'60m':previousIntervals['60m']??aggregateIntraday(five,60)};
      check.status='pending';check.messages.push(stock.name+' 尚無新的已完成5分K，沿用上次成功資料');
    }
    const intradayMetaByInterval={};
    for(const period of intradayPeriods){
      const history=intradayByInterval[period],missingBars=history.filter(r=>r.missing).length;
      intradayMetaByInterval[period]={checkedAt,fetchedAt:envelope.fetchedAt,lastCompletedAt:history.at(-1)?.to??history.at(-1)?.date??null,delayMinutes:20,missingBars,source:url};
      if(missingBars){check.status='pending';check.messages.push(stock.name+' '+period.replace('m','分K')+' 有 '+missingBars+' 根資料待確認，不繪製該棒與涉及的均線');}
    }
    const intraday=intradayByInterval['30m'],intradayMeta=intradayMetaByInterval['30m'];
    stocks.push({...stock,daily,intraday,intradayMeta,intradayByInterval,intradayMetaByInterval});
  }
  const dateSets=stocks.map(s=>s.daily.map(r=>r.date).join(','));
  if(new Set(dateSets).size!==1)throw new Error('三股長期日K日期覆蓋不一致，須核對停牌或缺資料');
  const result={asOf,checkedAt,dailyCheckedAt:intradayOnly?prior.dailyCheckedAt:checkedAt,adjustment:'unadjusted',timezone:'Asia/Taipei',stocks};
  await save(path.join(site,'lib/kline-history.json'),result);
  await save(path.join(root,'data/kline',checkedAt.replaceAll(':','-')+'.json'),result);
  await save(path.join(root,'data/kline-publication.json'),{publicationStatus:'pending',checkedAt,asOf});
}catch(e){check.status='failed';check.messages.push(e.message);process.exitCode=1;}
await save(path.join(site,'lib/kline-check.json'),check);
console.log(JSON.stringify({...check,stocks:stocks.map(s=>({id:s.id,daily:s.daily.length,intervals:Object.fromEntries(Object.entries(s.intradayByInterval).map(([period,rows])=>[period,rows.length])),missing:Object.fromEntries(Object.entries(s.intradayMetaByInterval).map(([period,meta])=>[period,meta.missingBars]))}))}));

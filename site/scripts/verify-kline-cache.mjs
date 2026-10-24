import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {canReuseDailyMonth,assertDailyPriceMatch} from './kline-daily-core.mjs';
import {parsePriceMonth} from './chart-series-core.mjs';
import {WATCHLIST} from '../lib/watchlist.mjs';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const checkedAt='2027-01-05T12:00:00Z';
const reusable=stamp=>canReuseDailyMonth({fetchedAt:stamp},'202609','2026-10-20',checkedAt);
assert.equal(reusable('2026-09-29T16:22:33.455Z'),false); // Sept 30 Taipei, still provisional.
assert.equal(reusable('2026-09-30T15:59:59.999Z'),false);
assert.equal(reusable('2026-09-30T16:00:00.000Z'),true); // Oct 1 Taipei, exact boundary.
assert.equal(reusable('2026-10-01T00:00:00+08:00'),true);
for(const stamp of [undefined,null,'','invalid','2026-10-01','2026-10-01T00:00:00','2027-01-06T00:00:00Z','2026-09-31T00:00:00Z','2027-02-30T00:00:00Z','2026-09-30T24:00:00Z'])assert.equal(reusable(stamp),false);
assert.equal(canReuseDailyMonth({fetchedAt:'2026-02-30T00:00:00Z'},'202602','2026-10-20',checkedAt),false);
assert.equal(canReuseDailyMonth({fetchedAt:'2026-10-21T00:00:00Z'},'202610','2026-10-20',checkedAt),false);
assert.equal(canReuseDailyMonth({fetchedAt:'2026-12-31T16:00:00Z'},'202612','2027-01-05',checkedAt),true);
assert.equal(canReuseDailyMonth({fetchedAt:'2026-12-31T15:59:59Z'},'202612','2027-01-05',checkedAt),false);
// A weekend month-end needs no invented Sunday candle.
assert.equal(canReuseDailyMonth({fetchedAt:'2026-05-31T16:00:00Z'},'202605','2026-10-20',checkedAt),true);
const row={date:'2026-09-30',open:10,high:12,low:9,close:11};
assert.throws(()=>assertDailyPriceMatch('2426',[],[row]),/2426 2026-09-30.*缺少日期/);
assert.throws(()=>assertDailyPriceMatch('3714',[{...row,close:10}],[row]),/3714 2026-09-30 close.*price-history=11.*daily=10/);
assert.throws(()=>assertDailyPriceMatch('2409',[row],undefined),/2409.*短期/);
assertDailyPriceMatch('2426',[row],[row]);

// Exercise the real updater, with all network traffic replaced by deterministic
// fixtures. This is the shared September gap that row counts/date-set parity miss.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'stock-kline-cache-test-'));
const resolved=path.resolve(temp);
if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('stock-kline-cache-test-'))throw new Error('Unsafe test cleanup path');
const testSite=path.join(temp,'site'),cacheDir=path.join(temp,'data/raw/kline/daily');
const save=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
try{
  fs.mkdirSync(path.join(testSite,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(testSite,'lib'),{recursive:true});
  for(const file of ['update-kline-history.mjs','kline-core.mjs','kline-daily-core.mjs','chart-series-core.mjs'])fs.copyFileSync(path.join(site,'scripts',file),path.join(testSite,'scripts',file));
  fs.copyFileSync(path.join(site,'lib/watchlist.mjs'),path.join(testSite,'lib/watchlist.mjs'));
  const calendar=read(path.join(site,'lib/trading-calendar.json')),asOf='2026-10-20';
  save(path.join(testSite,'lib/trading-calendar.json'),calendar);
  const fields=['日期','成交股數','成交金額','開盤價','最高價','最低價','收盤價','漲跌價差','成交筆數'];
  const stocks=[],staleCaches=new Map();
  for(const stock of WATCHLIST){
    const history=[];
    for(let offset=44;offset>=0;offset--){
      const start=new Date(Date.UTC(2026,9-offset,1)),month=start.toISOString().slice(0,7).replace('-',''),data=[];
      for(let at=start.getTime();new Date(at).getUTCMonth()===start.getUTCMonth();at+=86400000){
        const d=new Date(at),date=d.toISOString().slice(0,10);
        if(date>asOf||[0,6].includes(d.getUTCDay())||(d.getUTCFullYear()===calendar.year&&calendar.holidayDates.includes(date)))continue;
        data.push([`${d.getUTCFullYear()-1911}/${date.slice(5,7)}/${date.slice(8)}`,'100','1000','10','12','9','11','0','10']);
      }
      const envelope={url:`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${month}01&stockNo=${stock.id}`,fetchedAt:'2026-10-20T12:00:00Z',payload:{stat:'OK',date:month+'01',title:stock.id,fields,data}};
      history.push(...parsePriceMonth(envelope,stock.id,month,asOf));
      save(path.join(temp,'responses',stock.id+'_'+month+'.json'),envelope.payload);
      const cached=structuredClone(envelope);
      if(month==='202609'){
        cached.fetchedAt='2026-09-29T16:22:33.455Z';
        cached.payload.data=cached.payload.data.filter(r=>r[0]!=='115/09/30');
        staleCaches.set(stock.id,cached);
      }
      save(path.join(cacheDir,stock.id+'_'+month+'.json'),cached);
    }
    stocks.push({...stock,history:history.slice(-29),quote:{tradingDate:asOf,close:11}});
    save(path.join(temp,'intraday',`yahoo-chart-${stock.id}-5m-1mo.json`),{
      fetchedAt:'2026-10-20T12:00:00Z',payload:{chart:{error:null,result:[{meta:{symbol:stock.id+'.TW',exchangeTimezoneName:'Asia/Taipei',dataGranularity:'5m',regularMarketTime:Date.parse('2026-10-20T05:30:00Z')/1000},timestamp:[],indicators:{quote:[{}]}}]}}
    });
  }
  save(path.join(testSite,'lib/market-snapshot.json'),{stocks});
  save(path.join(testSite,'lib/price-history.json'),{asOf,stocks});
  const snapshotPath=path.join(testSite,'lib/kline-history.json');
  save(snapshotPath,{asOf:'2026-09-29',dailyCheckedAt:'2026-09-29T16:00:00Z',stocks:stocks.map(s=>({id:s.id,daily:s.history.filter(r=>r.date<='2026-09-29'),intraday:[],intradayByInterval:{'5m':[],'15m':[],'30m':[],'60m':[]}}))});
  const preserved=fs.readFileSync(snapshotPath,'utf8');
  const mock=path.join(temp,'mock-fetch.mjs'),callsPath=path.join(temp,'calls.jsonl');
  fs.writeFileSync(mock,`import fs from 'node:fs';
import path from 'node:path';
globalThis.fetch=async url=>{
  const u=new URL(url),id=u.searchParams.get('stockNo'),month=u.searchParams.get('date')?.slice(0,6);
  if(u.hostname!=='www.twse.com.tw'||u.pathname!=='/exchangeReport/STOCK_DAY')throw new Error('Unexpected network: '+url);
  fs.appendFileSync(${JSON.stringify(callsPath)},JSON.stringify({id,month})+'\\n');
  if(process.env.CACHE_TEST_MODE==='http-failure')return {ok:false,status:503};
  const payload=JSON.parse(fs.readFileSync(path.join(${JSON.stringify(temp)},'responses',id+'_'+month+'.json'),'utf8'));
  if(process.env.CACHE_TEST_MODE==='bad-format')payload.stat='ERROR';
  if(month==='202609'&&(process.env.CACHE_TEST_MODE==='incomplete'||(process.env.CACHE_TEST_MODE==='late-incomplete'&&id==='3714')))payload.data=payload.data.filter(r=>r[0]!=='115/09/30');
  if(month==='202609'&&process.env.CACHE_TEST_MODE==='mismatch')payload.data.find(r=>r[0]==='115/09/30')[6]='10';
  return {ok:true,json:async()=>payload};
};
`);
  const run=(mode,...args)=>{
    fs.writeFileSync(callsPath,'');
    const result=spawnSync(process.execPath,['--import',mock,path.join(testSite,'scripts/update-kline-history.mjs'),'--intraday-input-dir',path.join(temp,'intraday'),...args],{encoding:'utf8',env:{...process.env,CACHE_TEST_MODE:mode}});
    if(result.error)throw result.error;
    return {...result,calls:fs.readFileSync(callsPath,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)};
  };
  for(const [mode,diagnostic] of [['http-failure',/HTTP 503/],['bad-format',/2426.*來源格式/],['incomplete',/2426 2026-09-30.*缺少日期/],['late-incomplete',/3714 2026-09-30.*缺少日期/],['mismatch',/2426 2026-09-30 close.*price-history=11.*daily=10/]]){
    const result=run(mode);
    assert.equal(result.status,1,result.stderr||result.stdout);
    assert.match(result.stdout,diagnostic);
    assert.equal(fs.readFileSync(snapshotPath,'utf8'),preserved);
    assert.equal(read(path.join(testSite,'lib/kline-check.json')).status,'failed');
    for(const stock of WATCHLIST)assert.deepEqual(read(path.join(cacheDir,stock.id+'_202609.json')),staleCaches.get(stock.id));
  }
  const fixed=run('success');
  assert.equal(fixed.status,0,fixed.stderr||fixed.stdout);
  assert.deepEqual(fixed.calls,WATCHLIST.flatMap(({id})=>[{id,month:'202609'},{id,month:'202610'}]));
  for(const stock of read(snapshotPath).stocks){
    assertDailyPriceMatch(stock.id,stock.daily,stocks.find(s=>s.id===stock.id).history);
    assert.ok(stock.daily.some(r=>r.date==='2026-09-30'));
  }
  const repeated=run('success');
  assert.equal(repeated.status,0,repeated.stderr||repeated.stdout);
  assert.deepEqual(repeated.calls,WATCHLIST.map(({id})=>({id,month:'202610'})));
  const replay=run('http-failure','--daily-input-dir',cacheDir);
  assert.equal(replay.status,0,replay.stderr||replay.stdout);assert.deepEqual(replay.calls,[]);
  // Intraday-only never acquires/reconciles daily data, even if price history advanced.
  const previousDaily=read(snapshotPath).stocks.map(s=>s.daily);
  save(path.join(testSite,'lib/price-history.json'),{asOf:'2026-10-21',stocks:[]});
  const intraday=run('http-failure','--intraday-only');
  assert.equal(intraday.status,0,intraday.stderr||intraday.stdout);assert.deepEqual(intraday.calls,[]);
  assert.deepEqual(read(snapshotPath).stocks.map(s=>s.daily),previousDaily);
}finally{
  fs.rmSync(resolved,{recursive:true});
}
console.log('PASS: finalized-month cache boundaries, rollover refetch/reuse, precise date/OHLC diagnostics, failed refresh retention, retry recovery and intraday isolation.');

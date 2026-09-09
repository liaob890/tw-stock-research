import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {aggregateCandles,timeframeSeries,parseIntraday,reconcileIntradayClosing,validOHLC} from './kline-core.mjs';
import {WATCHLIST} from '../lib/watchlist.mjs';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(site,name),'utf8'));
const daily=[{date:'2025-12-29',open:10,high:14,low:9,close:12,volumeShares:100},{date:'2025-12-31',open:12,high:16,low:11,close:15,volumeShares:200},{date:'2026-01-02',open:15,high:17,low:13,close:14,volumeShares:300},{date:'2026-01-05',open:14,high:15,low:10,close:11,volumeShares:400}];
const weeks=aggregateCandles(daily,'week','2026-01-05');
assert.equal(weeks.length,2);assert.equal(weeks[0].date,'2025-12-29');assert.deepEqual([weeks[0].open,weeks[0].high,weeks[0].low,weeks[0].close,weeks[0].volumeShares],[10,17,9,14,600]);assert.equal(weeks[0].partial,false);assert.equal(weeks[1].partial,true);
const months=aggregateCandles(daily,'month','2026-01-05');assert.equal(months[0].close,15);assert.equal(months[1].open,15);assert.equal(months[1].partial,true);
assert.throws(()=>aggregateCandles([...daily,daily[0]],'week','2026-01-05'));
assert.equal(aggregateCandles([daily[0],{date:'2025-12-30',missing:true}],'week','2026-01-05')[0].close,undefined);
const epoch=s=>Date.parse(s+'+08:00')/1000;
const quote={open:[10,11,12,12.5],high:[12,13,14,12.5],low:[9,10,11,12.5],close:[11,12,12.3,12.5],volume:[10,20,30,0]};
const envelope={url:'https://query1.finance.yahoo.com/v8/finance/chart/2426.TW',fetchedAt:'2026-09-08T06:00:00Z',payload:{chart:{result:[{meta:{symbol:'2426.TW',exchangeTimezoneName:'Asia/Taipei',dataGranularity:'30m',regularMarketTime:epoch('2026-09-08T13:30:00')},timestamp:['09:00','09:30','13:00','13:30'].map(t=>epoch('2026-09-08T'+t+':00')),indicators:{quote:[quote]}}],error:null}}};
const cal={year:2026,holidayDates:['2026-09-07']};
const early=structuredClone(envelope);early.fetchedAt='2026-09-08T01:49:59Z';assert.throws(()=>parseIntraday(early,'2426',early.fetchedAt,cal));
early.fetchedAt='2026-09-08T01:50:00Z';const boundary=parseIntraday(early,'2426',early.fetchedAt,cal);assert.equal(boundary.history.length,1);assert.equal(boundary.history[0].date,'2026-09-08 09:00');
const parsed=parseIntraday(envelope,'2426',envelope.fetchedAt,cal);assert.equal(parsed.history.length,9);assert.equal(parsed.history.filter(r=>r.missing).length,6);assert.equal(parsed.history.at(-1).date,'2026-09-08 13:00');assert.equal(parsed.history.at(-1).close,12.5);assert.equal(parsed.history.at(-1).volumeShares,null);
const official=[{date:'2026-09-08',open:10,high:14,low:9,close:12.8,source:'https://www.twse.com.tw/'}];const merged=reconcileIntradayClosing(parsed.history,official);assert.equal(merged.at(-1).close,12.8);assert.equal(merged.at(-1).closingSource,official[0].source);
const noAuction=structuredClone(envelope);noAuction.payload.chart.result[0].timestamp.pop();const pending=reconcileIntradayClosing(parseIntraday(noAuction,'2426',noAuction.fetchedAt,cal).history,[]);assert.equal(pending.at(-1).missing,true);assert.equal(pending.at(-1).close,undefined);
const dup=structuredClone(envelope);dup.payload.chart.result[0].timestamp[1]=dup.payload.chart.result[0].timestamp[0];assert.throws(()=>parseIntraday(dup,'2426',dup.fetchedAt,cal));
const wrong=structuredClone(envelope);wrong.payload.chart.result[0].meta.symbol='2409.TW';assert.throws(()=>parseIntraday(wrong,'2426',wrong.fetchedAt,cal));
const nulls=structuredClone(envelope);nulls.payload.chart.result[0].indicators.quote[0].close[0]=null;assert.equal(parseIntraday(nulls,'2426',nulls.fetchedAt,cal).history[0].missing,true);
const holiday=structuredClone(envelope);const r=holiday.payload.chart.result[0];r.timestamp=[epoch('2026-09-04T13:00:00'),epoch('2026-09-08T09:00:00')];Object.keys(r.indicators.quote[0]).forEach(k=>r.indicators.quote[0][k]=r.indicators.quote[0][k].slice(0,2));assert.equal(parseIntraday(holiday,'2426',holiday.fetchedAt,cal).history.length,2);
const data=read('lib/kline-history.json'),prices=read('lib/price-history.json');assert.deepEqual(data.stocks.map(s=>s.id),WATCHLIST.map(s=>s.id));
for(const stock of data.stocks){
  assert.ok(stock.daily.every(validOHLC));
  for(const row of prices.stocks.find(s=>s.id===stock.id).history){const other=stock.daily.find(r=>r.date===row.date);assert.ok(other);for(const k of ['open','high','low','close'])assert.equal(other[k],row[k]);}
  for(const period of ['day','week','month','30m']){
    const series=timeframeSeries(stock,period,data.asOf);assert.ok(series.length>0);assert.ok(series.every(row=>row.missing||validOHLC(row)));
    const full=period==='30m'?stock.intraday:aggregateCandles(stock.daily,period,data.asOf),last20=full.slice(-20);
    const expected=last20.length===20&&last20.every(r=>Number.isFinite(r.close))?last20.reduce((sum,r)=>sum+r.close,0)/20:null;
    expected===null?assert.equal(series.at(-1).ma20,null):assert.ok(Math.abs(series.at(-1).ma20-expected)<1e-8);
  }
  assert.equal(timeframeSeries(stock,'month',data.asOf).length,24);
  assert.ok(stock.intraday.every(row=>!row.date.endsWith('13:30')));
}
// A failed acquisition must not replace the last good OHLC snapshot.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'stock-kline-test-')),testSite=path.join(temp,'site');
fs.mkdirSync(path.join(testSite,'scripts'),{recursive:true});fs.mkdirSync(path.join(testSite,'lib'));
for(const f of ['update-kline-history.mjs','kline-core.mjs','chart-series-core.mjs'])fs.copyFileSync(path.join(site,'scripts',f),path.join(testSite,'scripts',f));
fs.copyFileSync(path.join(site,'lib/watchlist.mjs'),path.join(testSite,'lib/watchlist.mjs'));
for(const name of ['market-snapshot.json','trading-calendar.json'])fs.copyFileSync(path.join(site,'lib',name),path.join(testSite,'lib',name));
const preserved=JSON.stringify({...data,stocks:data.stocks.map(s=>({...s,daily:s.daily.slice(-30),intraday:s.intraday.slice(-30)}))});fs.writeFileSync(path.join(testSite,'lib/kline-history.json'),preserved);
const failure=spawnSync(process.execPath,[path.join(testSite,'scripts/update-kline-history.mjs'),'--intraday-only','--intraday-input-dir',path.join(temp,'missing-input')],{encoding:'utf8'});assert.equal(failure.status,1);assert.equal(fs.readFileSync(path.join(testSite,'lib/kline-history.json'),'utf8'),preserved);
assert.equal(JSON.parse(fs.readFileSync(path.join(testSite,'lib/kline-check.json'),'utf8')).status,'failed');
const resolved=path.resolve(temp);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('stock-kline-test-'))throw new Error('Unsafe test cleanup path');fs.rmSync(resolved,{recursive:true});
console.log('PASS: 30-minute boundaries, delayed feed, closing auction reconciliation, holidays, nulls/duplicates, week/year and month aggregation, 5/10/20-period averages, official OHLC and failure retention.');

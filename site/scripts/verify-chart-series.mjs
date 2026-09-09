import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chartWindow,addMovingAverages,alignTradingDays,candleGeometry,parsePriceMonth} from './chart-series-core.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const calendar=read('../lib/trading-calendar.json'),settings=read('../lib/chart-settings.json');
const margin=read('../lib/margin-data.json'),prices=read('../lib/price-history.json');
const rows=Array.from({length:25},(_,i)=>({date:String(i),value:i+1})),ma=addMovingAverages(rows,'value');
assert.equal(ma[3].ma5,null);assert.equal(ma[4].ma5,3);assert.equal(ma[9].ma10,5.5);assert.equal(ma[18].ma20,null);assert.equal(ma[19].ma20,10.5);assert.equal(ma[24].ma20,15.5);
const missing=structuredClone(rows);missing[10].value=null;assert.equal(addMovingAverages(missing,'value')[19].ma20,null);assert.equal(addMovingAverages(missing,'value')[15].ma5,14);
const holiday=[{date:'2026-09-24',value:1},{date:'2026-09-29',value:2}];assert.equal(alignTradingDays(holiday,'2026-09-29',calendar).length,2);
const gap=alignTradingDays([{date:'2026-09-07',value:1},{date:'2026-09-09',value:3}],'2026-09-09',calendar);assert.equal(gap[1].missing,true);assert.equal(addMovingAverages(gap,'value',[3])[2].ma3,null);
const repeated=alignTradingDays([{date:'2026-09-07',value:1},{date:'2026-09-07',value:2}],'2026-09-07',calendar);assert.equal(repeated.length,1);assert.equal(repeated[0].value,2);
const candle=candleGeometry({x:10,y:20,width:20,height:80,open:8,high:10,low:2,close:4});assert.deepEqual(candle,{center:20,wickTop:20,wickBottom:100,bodyX:17,bodyWidth:6,bodyY:40,bodyHeight:40,rising:false});
assert.equal(candleGeometry({x:0,y:10,width:10,height:0,open:2,high:2,low:2,close:2}).bodyHeight,1);
assert.equal(candleGeometry({x:0,y:10,width:10,height:0,open:null,high:2,low:2,close:2}),null);
for(const s of margin.stocks){
  const visible=chartWindow(s.history,'ratioPct',margin.asOf,calendar,settings);
  assert.equal(visible.length,10);assert.ok(visible.every(r=>r.ma20!==null));
  const expected=s.history.slice(-20).reduce((sum,r)=>sum+r.short/r.financing*100,0)/20;
  assert.ok(Math.abs(visible.at(-1).ma20-expected)<1e-10);
  if(margin.asOf==='2026-09-08'){assert.equal(visible[0].date,'2026-08-26');assert.equal(visible.at(-1).date,'2026-09-08');}
}
for(const s of prices.stocks){
  const visible=chartWindow(s.history,'close',prices.asOf,calendar,settings);
  assert.equal(visible.length,10);assert.ok(visible.every(r=>r.ma5!==null&&r.ma10!==null&&r.ma20!==null));
  for(const row of s.history)assert.ok(row.low<=Math.min(row.open,row.close)&&row.high>=Math.max(row.open,row.close));
  const expected=s.history.slice(-20).reduce((sum,r)=>sum+r.close,0)/20;assert.ok(Math.abs(visible.at(-1).ma20-expected)<1e-8);
}
const fake={url:'https://www.twse.com.tw/exchangeReport/STOCK_DAY',payload:{stat:'OK',date:'20260901',title:'115年09月 2426 各日成交資訊',fields:['日期','成交股數','成交金額','開盤價','最高價','最低價','收盤價','漲跌價差','成交筆數'],data:[['115/09/08','1000','9000','8','10','7','9','+1','1']]}};
assert.equal(parsePriceMonth(fake,'2426','202609','2026-09-08')[0].open,8);
const bad=structuredClone(fake);bad.payload.data[0][5]='11';assert.throws(()=>parsePriceMonth(bad,'2426','202609','2026-09-08'));
assert.throws(()=>parsePriceMonth(fake,'2409','202609','2026-09-08'));
console.log('PASS: two-week windows, exact 5/10/20-day SMA, missing data/holidays/duplicates, official price and ratio reconciliation, OHLC geometry.');

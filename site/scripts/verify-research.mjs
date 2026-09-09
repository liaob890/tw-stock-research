import {parseCompanyMonthly} from './monthly-source-core.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,'');
const researchUrl='data:text/javascript;base64,'+Buffer.from(read('../lib/research.ts')).toString('base64');
const {stocks}=await import(researchUrl);
const valuationJs=ts.transpileModule(read('../lib/valuation.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./research'",JSON.stringify(researchUrl));
const {calculateValuation}=await import('data:text/javascript;base64,'+Buffer.from(valuationJs).toString('base64'));
assert.ok(Math.abs(calculateValuation({stockId:'2426',pe:30}).impliedAnnualEps-stocks.find(s=>s.id==='2426').price/30)<1e-10);
assert.ok(Math.abs(calculateValuation({stockId:'2409',pe:20}).impliedAnnualEps-stocks.find(s=>s.id==='2409').price/20)<1e-10);
for(const bad of [null,[],{}, {stockId:'2330',pe:20},{stockId:'2426',pe:0},{stockId:'2426',pe:9},{stockId:'2426',pe:61},{stockId:'2426',pe:20.5},{stockId:'2426',pe:'30'},{stockId:'2426',pe:NaN},{stockId:'2426',pe:Infinity},{stockId:'2426',pe:30,extra:true}]) assert.throws(()=>calculateValuation(bad));
for(const pe of [10,60]) assert.ok(calculateValuation({stockId:'2426',pe}).impliedAnnualEps>0);
const raw=(name)=>JSON.parse(read('../../data/raw/2026-09-07/'+name+'.json'));
const incomes=raw('t187ap06_L_ci').records;
const balances=raw('t187ap07_L_ci').records;
const market=JSON.parse(read('../lib/market-snapshot.json'));
const sourceRaw=relative=>JSON.parse(read('../../'+relative));
for(const s of stocks){
 const current=market.stocks.find(m=>m.id===s.id),income=(current.financialRawFiles?sourceRaw(current.financialRawFiles.income).records:incomes).find(r=>r['公司代號']===s.id),balance=(current.financialRawFiles?sourceRaw(current.financialRawFiles.balance).records:balances).find(r=>r['公司代號']===s.id);
 let rev;if(current.monthly.rawFile.endsWith('.html')){const c=parseCompanyMonthly(read('../../'+current.monthly.rawFile),Number(current.monthly.period.slice(0,4)),current.monthly.source).find(m=>m.period===current.monthly.period);rev={'資料年月':String(Number(c.period.slice(0,4))-1911)+c.period.slice(5),'營業收入-去年同月增減(%)':c.yoyPct,'累計營業收入-前期比較增減(%)':c.ytdYoyPct};}else{const r=sourceRaw(current.monthly.rawFile);rev=(r.records||r.response).find(r=>r['公司代號']===s.id);}
 const latestQuarter=current.quarters.at(-1).period;assert.equal(String(Number(income['年度'])+1911)+'Q'+income['季別'],latestQuarter);assert.equal(String(Number(balance['年度'])+1911)+'Q'+balance['季別'],latestQuarter);assert.equal(Number(rev['資料年月'].slice(0,3))+1911,Number(current.monthly.period.slice(0,4)));assert.equal(rev['資料年月'].slice(3),current.monthly.period.slice(5));
 for(const [local,key] of Object.entries({revenue:'營業收入',gross:'營業毛利（毛損）',operating:'營業利益（損失）',profit:'淨利（淨損）歸屬於母公司業主',eps:'基本每股盈餘（元）'}))assert.equal(s[local],Number(income[key]),s.id+' '+key);
 for(const [local,key] of Object.entries({bvps:'每股參考淨值',assets:'資產總計',liabilities:'負債總計',currentAssets:'流動資產',currentLiabilities:'流動負債'}))assert.equal(s[local],Number(balance[key]),s.id+' '+key);
 const rawPrice=sourceRaw(current.quote.rawFile),rawValue=sourceRaw(current.quote.valuationRawFile); const price=(rawPrice.response??rawPrice).data.at(-1),value=(rawValue.response??rawValue).data.at(-1);
 const [year,month,day]=current.quote.tradingDate.split('-');
 assert.equal(price[0],`${Number(year)-1911}/${month}/${day}`);assert.equal(s.price,Number(price[6]));assert.equal(s.change,Number(price[7]));
 assert.equal(value[0],`${Number(year)-1911}年${month}月${day}日`);assert.equal(s.pe,value[3]==='-'?null:Number(value[3].replaceAll(',','')));assert.equal(s.pb,Number(value[4]));assert.equal(s.yield,Number(value[1]));
 assert.ok(Math.abs(s.yoy-Number(rev['營業收入-去年同月增減(%)']))<1e-7);
 assert.ok(Math.abs(s.ytdYoy-Number(rev['累計營業收入-前期比較增減(%)']))<1e-7);
}
console.log('PASS: valuation boundaries, invalid inputs, and all tracked stocks reconciled to dated TWSE source snapshots.');

import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {detectChanges,finite} from './change-engine.mjs';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),project=path.resolve(site,'..');
const args=process.argv.slice(2),arg=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
if(!arg('--snapshot'))throw new Error('需要 --snapshot 指向本次已核對快照');
const read=async(file,fallback)=>{try{return JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e.code==='ENOENT'&&fallback!==undefined)return fallback;throw e;}};
const save=async(file,data)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(file+'.tmp',file);};
const config=await read(path.join(project,'settings','alerts.json'));
const current=await read(path.resolve(arg('--snapshot')));
const previous=await read(path.join(project,'data','last-successful-snapshot.json'),null);
const state=await read(path.join(project,'data','change-state.json'),{});
const detected=detectChanges(previous,current,config,state);
const changesDir=path.join(project,'data','changes'),todayFile=path.join(changesDir,'important-'+current.asOf+'.json');
const existing=await read(todayFile,null);
const surveillance=await read(path.join(changesDir,current.asOf+'-surveillance.json'),null);
const official=await read(path.join(site,'lib','surveillance.json'),null);
const labels={active:'處置中',scheduled:'已公告待處置',imminent:'可能觸發處置',attention:'公布注意',clear:'本次名單未列入'};
if(official?.asOf===current.asOf)for(const c of surveillance?.changes||[]){
  if(c.kind!=='changed')continue;
  const digest=createHash('sha256').update(JSON.stringify(c.after)).digest('hex').slice(0,16);
  const eventId='surveillance-'+current.asOf+'-'+c.id+'-'+digest;
  if(existing?.events?.some(e=>e.id===eventId))continue;
  detected.events.push({id:eventId,stockId:c.id,stock:c.name,item:'注意／處置狀態變化',before:labels[c.before.level],after:labels[c.after.level],period:current.asOf,reason:'與前次成功核對的證交所注意、處置及可能達處置標準名單比較，官方狀態或公告內容已改變。',classification:'官方事實',sources:Object.values(official.sources).map(v=>({url:v.url,label:v.title})),impact:{status:'交易風險更新',reason:'官方名單變化影響交易風險追蹤；不直接代表基本面改善或惡化，原中長期研究仍依財報與營運證據判斷。'}});
}
const events=[...(existing?.events||[]),...detected.events].filter((e,i,all)=>all.findIndex(other=>other.id===e.id)===i);
const today={...detected,events,settings:config,baselineDate:existing?.baselineDate||previous?.asOf||null};delete today.nextState;
await save(todayFile,today);
const history=[];
for(const name of (await readdir(changesDir)).filter(f=>/^important-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(0,config.historyDaysOnWebsite||60))history.push(await read(path.join(changesDir,name)));
await save(path.join(site,'lib','changes.json'),{today,history});
const canPromote=current.verification==='verified'&&!detected.checks.some(c=>c.item==='行情'&&c.status==='pending')&&current.stocks.every(s=>s.quote?.verified&&finite(s.quote.close)&&s.quote.close>0&&s.monthly?.verified&&finite(s.monthly.yoyPct)&&s.quarters?.length&&s.quarters.every(q=>q.verified&&q.basis==='single_quarter'&&finite(q.revenue)&&q.revenue>0&&finite(q.grossProfit)&&finite(q.operatingProfit)));
if(canPromote){
  await save(path.join(site,'lib','market-snapshot.json'),current);
  const researchFile=path.join(site,'lib','research.ts');
  const research=await import('data:text/javascript;base64,'+Buffer.from(await readFile(researchFile,'utf8')).toString('base64'));
  const stocks=structuredClone(research.stocks),sources=structuredClone(research.sources);
  for(const stock of stocks){const fresh=current.stocks.find(s=>s.id===stock.id);if(!fresh)continue;
    Object.assign(stock,{price:fresh.quote.close,priceDate:fresh.quote.tradingDate,change:Number((fresh.quote.close-fresh.quote.previousClose).toFixed(2)),changePct:fresh.quote.dailyChangePct});
    for(const [target,field] of [['pe','pe'],['pb','pb'],['yield','dividendYieldPct']])stock[target]=finite(fresh.quote[field])?fresh.quote[field]:null;
    if(fresh.monthly.verified){stock.yoy=fresh.monthly.yoyPct;if(finite(fresh.monthly.ytdYoyPct))stock.ytdYoy=fresh.monthly.ytdYoyPct;}
    if(sources['quote'+stock.id])sources['quote'+stock.id]={...sources['quote'+stock.id],url:fresh.quote.source.url,detail:'TWSE · '+fresh.quote.tradingDate};
    if(fresh.quote.valuationSource&&sources['value'+stock.id])sources['value'+stock.id].url=fresh.quote.valuationSource.url;
  }
  await writeFile(researchFile,'// 研究敘述由核對流程維護；價格與估值輸入同步已核對快照。\nexport const sources = '+JSON.stringify(sources,null,2)+';\nexport const stocks = '+JSON.stringify(stocks,null,2)+';\n');
}
const report=['# 每日重要變化｜'+current.asOf,'',`查核狀態：${today.status==='complete'?'完成':'部分項目待確認'}；比較基準：${previous?.asOf||'首次建立'}。`,'',...(events.length?events.flatMap(e=>[`## ${e.stock}｜${e.item}`,`前值：${e.before}；新值：${e.after}。`,`資料期間：${e.period}。`,`觸發原因：${e.reason}`,`研究判斷：${e.impact.status}。${e.impact.reason}`,`來源：${e.sources.map(s=>`[${s.label||'官方來源'}](${s.url})`).join('、')}`,'']):[today.status==='complete'?'今日無新增重要變化':'目前沒有已確認的新觸發，部分項目待確認。','']),'## 待確認項目',...today.checks.filter(c=>c.status==='pending').map(c=>`- ${c.stock}｜${c.item}：${c.detail}`),''];
await mkdir(path.join(project,'reports'),{recursive:true});await writeFile(path.join(project,'reports',current.asOf+'-changes.md'),report.join('\n'));
await save(path.join(project,'data','change-state.json'),detected.nextState);
if(canPromote){
  await save(path.join(project,'data','snapshots',current.asOf+'.json'),current);
  await save(path.join(project,'data','last-successful-snapshot.json'),current);
}
const publicationFile=path.join(project,'data','changes-publication.json'),publication=await read(publicationFile,{});
await save(publicationFile,{...publication,publicationStatus:'pending',asOf:current.asOf,newEventIds:[...new Set([...(publication.publicationStatus==='pending'?publication.newEventIds||[]:[]),...detected.events.map(e=>e.id)])]});
console.log(JSON.stringify({asOf:current.asOf,status:today.status,newEvents:detected.events.length,visibleToday:events.length,pendingChecks:today.checks.filter(c=>c.status==='pending').length,baselinePromoted:canPromote}));

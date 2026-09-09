export const finite=value=>typeof value==='number'&&Number.isFinite(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fmt=(value,d=2)=>finite(value)?value.toLocaleString('zh-TW',{maximumFractionDigits:d}):'待確認';
const sourceList=value=>(Array.isArray(value)?value:[value]).filter(v=>v&&typeof v.url==='string'&&v.url.startsWith('https://'));
const validSource=value=>sourceList(value).length>0;
const announcementKey=e=>{const url=new URL(e.source.url);url.hash='';for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_')||['fbclid','gclid'].includes(key))url.searchParams.delete(key);url.searchParams.sort();return `${e.publishedOn}:${e.topic}:${url.toString()}`;};
const quarterIndex=p=>{const m=/^(\d{4})Q([1-4])$/.exec(p||'');return m?Number(m[1])*4+Number(m[2])-1:null;};
const monthIndex=p=>{const m=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(p||'');return m?Number(m[1])*12+Number(m[2])-1:null;};
const quarters=stock=>[...(stock?.quarters||[])].sort((a,b)=>(quarterIndex(a.period)??-1)-(quarterIndex(b.period)??-1));
const single=q=>q?.basis==='single_quarter'&&q.verified===true&&quarterIndex(q.period)!==null&&validSource(q.sources);
const margin=q=>single(q)&&finite(q.grossProfit)&&finite(q.revenue)&&q.revenue>0?q.grossProfit/q.revenue*100:null;
function tailQuarters(stock,count){const data=quarters(stock).slice(-count);if(data.length!==count||data.some((q,i)=>!single(q)||(i>0&&quarterIndex(q.period)!==quarterIndex(data[i-1].period)+1)))return null;return data;}
export function trendCondition(stock,kind,count){
  const data=tailQuarters(stock,kind==='margin'?count+1:count);if(!data)return null;
  if(kind==='margin'){const rates=data.map(margin);return rates.some(v=>v===null)?null:rates.every((v,i)=>i===0||v>rates[i-1]);}
  if(data.some(q=>!finite(q.operatingProfit)))return null;
  return data.every(q=>q.operatingProfit>0);
}
export function validateSettings(config){
  for(const n of [config?.price?.absoluteDailyChangePct,config?.monthlyRevenue?.upwardYoyThresholdPct,config?.monthlyRevenue?.absoluteYoyChangePercentagePoints])if(!finite(n)||n<0)throw new Error('提醒門檻須為非負有限數字');
  for(const n of [config?.quarterly?.tyntekMarginImprovementQuarters,config?.quarterly?.auoOperatingProfitPositiveQuarters,config?.quarterly?.ennostarOperatingProfitPositiveQuarters??2])if(!Number.isInteger(n)||n<1||n>8)throw new Error('季度期數須介於 1 至 8');
}
export function detectChanges(previous,current,config,oldState={}){
  validateSettings(config);
  if(!current||!/^\d{4}-\d{2}-\d{2}$/.test(current.asOf||'')||!Array.isArray(current.stocks))throw new Error('快照格式不完整');
  const events=[],checks=[],seen={...(oldState.seen||{})},conditions={...(oldState.conditions||{})};
  const check=(s,item,status,detail,sources=[])=>checks.push({stockId:s.id,stock:s.name,item,status,detail,sources:sourceList(sources)});
  const emit=(s,event)=>{if(seen[event.id])return;seen[event.id]=current.asOf;events.push({stockId:s.id,stock:s.name,detectedOn:current.asOf,classification:'官方事實',...event});};
  if(current.verification!=='verified'){
    for(const s of current.stocks)check(s,'本次資料','pending','本次快照未完成核對，保留上一個成功快照。');
    return {asOf:current.asOf,checkedAt:current.checkedAt,status:'partial',events,checks,nextState:{seen,conditions}};
  }
  for(const s of current.stocks){
    const before=previous?.stocks?.find(p=>p.id===s.id);
    const q=s.quote;
    if(!q?.verified||!finite(q.close)||!finite(q.previousClose)||q.previousClose<=0||!finite(q.dailyChangePct)||!/^\d{4}-\d{2}-\d{2}$/.test(q.tradingDate||'')||!validSource(q.source))check(s,'行情','pending','收盤價、實際交易日或單日漲跌資料不足。',q?.source);
    else if(Math.abs((q.close/q.previousClose-1)*100-q.dailyChangePct)>0.000001)check(s,'行情','pending','價格與漲跌幅不一致，暫不產生異動提醒。',q.source);
    else if(q.tradingDate>current.asOf)check(s,'行情','pending','行情交易日晚於查核日，暫不採用。',q.source);
    else if(current.marketOpen===false||q.tradingDate!==current.asOf||q.tradingDate===before?.quote?.tradingDate)check(s,'行情','verified',`沿用 ${q.tradingDate} 實際交易日；未製造新的價格異動。`,q.source);
    else {
      if(Math.abs(q.dailyChangePct)>=config.price.absoluteDailyChangePct)emit(s,{id:`price:${s.id}:${q.tradingDate}`,item:'價格異動',before:`${fmt(q.previousClose)} 元`,after:`${fmt(q.close)} 元（${q.dailyChangePct>0?'+':''}${fmt(q.dailyChangePct)}%）`,period:`${q.previousTradingDate||'前一交易日'} → ${q.tradingDate}`,reason:`單日漲跌幅絕對值 ${fmt(Math.abs(q.dailyChangePct))}% ≥ ${config.price.absoluteDailyChangePct}%`,sources:sourceList(q.source),impact:{status:'不直接改變',reason:'股價異動不直接等同基本面改善或惡化；估值試算已依本次價格更新。'}});
      check(s,'行情','verified',`${q.tradingDate} 單日漲跌 ${fmt(q.dailyChangePct)}%；門檻 ${config.price.absoluteDailyChangePct}%。`,q.source);
    }
    const m=s.monthly,oldMonth=before?.monthly;
    if(!m?.verified||!finite(m.yoyPct)||monthIndex(m.period)===null||!validSource(m.source))check(s,'月營收','pending','月營收年增率或資料月份未完成核對。',m?.source);
    else if(m.period===oldMonth?.period&&m.yoyPct===oldMonth.yoyPct)check(s,'月營收','verified',`${m.period} 為最近已核對月份；與前次快照相同。`,m.source);
    else {
      const prior=[...(s.monthlyHistory||[]),...(before?.monthlyHistory||[]),...(oldMonth?[oldMonth]:[])].find(p=>monthIndex(p.period)===monthIndex(m.period)-1&&p.verified&&finite(p.yoyPct)&&validSource(p.source));
      if(!prior)check(s,'月營收','pending',`${m.period} 年增率已知，但前一月份可比較年增率不足。`,m.source);
      else {
        const reasons=[],delta=m.yoyPct-prior.yoyPct,threshold=config.monthlyRevenue.upwardYoyThresholdPct;
        if(prior.yoyPct<threshold&&m.yoyPct>=threshold)reasons.push(`年增率由低於 ${threshold}% 上升至 ${threshold}% 以上`);
        if(config.monthlyRevenue.nonnegativeToNegative&&prior.yoyPct>=0&&m.yoyPct<0)reasons.push('年增率由非負轉負');
        if(Math.abs(delta)>=config.monthlyRevenue.absoluteYoyChangePercentagePoints)reasons.push(`年增率變動 ${fmt(delta)} 個百分點，達 ${config.monthlyRevenue.absoluteYoyChangePercentagePoints} 個百分點門檻`);
        if(reasons.length)emit(s,{id:`monthly:${s.id}:${m.period}:${m.yoyPct}`,item:'月營收年增率',before:`${fmt(prior.yoyPct)}%`,after:`${fmt(m.yoyPct)}%`,period:`${prior.period} → ${m.period}`,reason:reasons.join('；'),sources:[...sourceList(prior.source),...sourceList(m.source)],impact:{status:'需重新檢視',reason:'檢視成長假設與持續性；單月變化尚不足以直接改變中長期結論。'}});
        check(s,'月營收','verified',`${prior.period} 與 ${m.period} 年增率已比較。`,[prior.source,m.source]);
      }
    }
    const qs=quarters(s),last=qs.at(-1),previousQuarter=qs.at(-2);
    const storedQuarter=quarters(before).find(p=>p.period===last?.period);
    if(!single(last)||!finite(last.operatingProfit))check(s,'單季營業利益','pending','缺少已核對的可比較單季營業利益；累計數據不可代用。',last?.sources);
    else if(storedQuarter&&single(storedQuarter)&&last.operatingProfit===storedQuarter.operatingProfit)check(s,'單季營業利益','verified',`${last.period} 單季營業利益與前次快照相同。`,last.sources);
    else if(!single(previousQuarter)||!finite(previousQuarter.operatingProfit)||quarterIndex(previousQuarter.period)+1!==quarterIndex(last.period))check(s,'單季營業利益','pending','缺少前一個連續季度的可比較單季獲利。',last.sources);
    else {
      const flip=previousQuarter.operatingProfit<0&&last.operatingProfit>0?'由虧轉盈':previousQuarter.operatingProfit>0&&last.operatingProfit<0?'由盈轉虧':null;
      if(flip&&config.quarterly.operatingProfitSignChange)emit(s,{id:`profit-flip:${s.id}:${last.period}:${flip}`,item:`單季營業利益${flip}`,before:`${fmt(previousQuarter.operatingProfit)} 千元`,after:`${fmt(last.operatingProfit)} 千元`,period:`${previousQuarter.period} → ${last.period}`,reason:`可比較的單季營業利益${flip}；不使用半年累計值。`,sources:[...sourceList(previousQuarter.sources),...sourceList(last.sources)],impact:{status:'需重新檢視',reason:'本業獲利方向改變，仍需核對持續性、一次性因素與估值。'}});
      check(s,'單季營業利益','verified',`${previousQuarter.period} → ${last.period} 已比較；零獲利不視為盈或虧。`,last.sources);
    }
    const kind=s.id==='2426'?'margin':'profit',count=s.id==='2426'?config.quarterly.tyntekMarginImprovementQuarters:s.id==='3714'?(config.quarterly.ennostarOperatingProfitPositiveQuarters??2):config.quarterly.auoOperatingProfitPositiveQuarters;
    const title=s.id==='2426'?`毛利率連續 ${count} 季改善`:`連續 ${count} 季本業獲利`;
    const active=trendCondition(s,kind,count),key=`${s.id}:${kind}:${count}`;
    const priorActive=conditions[key]??trendCondition(before,kind,count);
    if(active===null)check(s,title,'pending',`需要 ${kind==='margin'?count+1:count} 個連續且可比較的單季資料，現有資料不足。`,last?.sources);
    else {
      if(active&&priorActive!==true){const data=tailQuarters(s,kind==='margin'?count+1:count);emit(s,{id:`trend:${key}:${last.period}`,item:title,before:priorActive===false?'條件未成立':'前次尚無足夠資料確認',after:'本次首次確認成立',period:data.map(q=>q.period).join(' → '),reason:kind==='margin'?data.map(q=>`${q.period}：${fmt(margin(q))}%`).join(' → '):data.map(q=>`${q.period}：${fmt(q.operatingProfit)} 千元`).join(' → '),sources:data.flatMap(q=>sourceList(q.sources)),impact:{status:'需重新檢視',reason:kind==='margin'?'毛利率改善支持營運改善假設，但仍需評估量產營收、投資支出與股價。':'連續本業獲利有助驗證轉型與需求改善，仍需拆解各事業貢獻。'}});}
      conditions[key]=active;check(s,title,'verified',active?'條件已成立；未改變時不重複提醒。':'目前條件未成立。',last?.sources);
    }
    for(const event of s.events||[]){
      if(!(config.companyTopics[s.id]||[]).includes(event.topic))continue;
      if(!event.id||!event.verified||!/^\d{4}-\d{2}-\d{2}$/.test(event.publishedOn||'')||event.publishedOn>current.asOf||!validSource(event.source)||!['official_fact','company_outlook','research_inference'].includes(event.classification)){check(s,event.headline||'公司事件','pending','公告日期、來源或事件內容尚未完成核對。',event.source);continue;}
      if(event.topic==='high_speed_optical_mass_revenue'&&(event.evidenceLevel!=='revenue_disclosed'||!finite(event.revenue)||!event.revenuePeriod)){check(s,'高速光通訊量產營收','pending','技術開發或公司展望不能代替已揭露的量產營收。',event.source);continue;}
      const key=announcementKey(event);
      const prior=(before?.events||[]).find(e=>e.id===event.id||(e.source?.url&&e.publishedOn&&announcementKey(e)===key));
      if(prior)continue;
      emit(s,{id:`company:${s.id}:${key}`,item:event.headline,before:'前次成功快照未收錄此公告',after:event.fact,period:`公告 ${event.publishedOn}${event.revenuePeriod?' · '+event.revenuePeriod:''}`,reason:event.reason||'追蹤項目出現新公告。',classification:{official_fact:'官方事實',company_outlook:'公司展望',research_inference:'研究推論'}[event.classification],sources:sourceList(event.source),impact:event.impact||{status:'需重新檢視',reason:'依實際揭露內容評估，不把計畫直接視為已實現成果。'}});
    }
    for(const topic of config.companyTopics[s.id]||[]){const coverage=(s.eventCoverage||[]).find(c=>c.topic===topic);check(s,coverage?.label||topic,coverage?.status==='verified'?'verified':'pending',coverage?.detail||'本次公司事件查核資料不足。',coverage?.sources);}
  }
  return {asOf:current.asOf,checkedAt:current.checkedAt,status:checks.some(c=>c.status==='pending')?'partial':'complete',events,checks,nextState:{seen,conditions}};
}

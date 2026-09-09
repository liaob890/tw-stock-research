'use client';
import klineHistory from '@/lib/kline-history.json';
import klineCheck from '@/lib/kline-check.json';
import {stockConfig} from '@/lib/watchlist.mjs';
import {useEffect,useRef,useState} from 'react';
import {Clock3,RefreshCw,ArrowUpRight,Landmark} from 'lucide-react';
import {MarginTrend} from '@/components/trend-charts';
import chartSettings from '@/lib/chart-settings.json';
import priceHistory from '@/lib/price-history.json';
import {chartWindow} from '@/scripts/chart-series-core.mjs';
import session from '@/lib/session-market.json';
import margins from '@/lib/margin-data.json';
import check from '@/lib/session-check.json';
import surveillanceCheck from '@/lib/surveillance-check.json';
import calendar from '@/lib/trading-calendar.json';
import {nextSlots,taipeiDate,marketDayState} from '@/scripts/market-session-core.mjs';
const n=(v:number|null|undefined,d=2)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:d,minimumFractionDigits:d}):'待確認';
const signed=(v:number|undefined)=>typeof v==='number'?`${v>0?'+':''}${n(v,0)}`:'待確認';
const time=(v:string)=>new Date(v).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export const revision=[session.checkedAt,margins.checkedAt,check.checkedAt,surveillanceCheck.checkedAt,priceHistory.checkedAt,klineHistory.checkedAt,klineCheck.checkedAt].join('|');
export function UpdateSchedule(){
  const [next,setNext]=useState(''),[notice,setNotice]=useState('頁面每分鐘檢查已發布的新資料'),[refreshing,setRefreshing]=useState(false);
  const checking=useRef(false),mounted=useRef(true);
  const checkForUpdate=async(manual=false)=>{
    if(checking.current){if(manual)setNotice('正在檢查更新…');return;}
    checking.current=true;if(manual){setRefreshing(true);setNotice('正在檢查更新…');}
    const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),10000);
    try{
      const r=await fetch(import.meta.env.BASE_URL+'update-status.json?ts='+Date.now(),{cache:'no-store',signal:controller.signal});
      if(!r.ok)throw new Error('status');const data=await r.json();
      if(!data||typeof data!=='object'||!('revision' in data)||typeof data.revision!=='string')throw new Error('payload');
      if(data.revision!==revision){if(mounted.current)setNotice('新資料已發布，正在更新頁面…');window.location.reload();return;}
      if(manual){if(mounted.current)setNotice('正在重新整理最新已發布資料…');window.location.reload();return;}
    }catch{if(manual&&mounted.current)setNotice('檢查失敗，請稍後再試');}
    finally{window.clearTimeout(timeout);checking.current=false;if(manual&&mounted.current)setRefreshing(false);}
  };
  useEffect(()=>{mounted.current=true;const poll=()=>{setNext(nextSlots(new Date().toISOString())[0]??'');if(document.visibilityState==='visible')void checkForUpdate();};
    setNext(nextSlots(new Date().toISOString())[0]??'');const timer=setInterval(poll,60000);return()=>{mounted.current=false;clearInterval(timer);};},[]);
  return <section className="update-schedule" aria-label="自動更新排程"><button type="button" className="schedule-refresh" onClick={()=>void checkForUpdate(true)} disabled={refreshing} aria-label={refreshing?'正在檢查更新':'重新整理最新發布資料'} aria-busy={refreshing} title="重新整理最新發布資料"><RefreshCw className={refreshing?'is-refreshing':''} size={21}/></button><div className="schedule-copy"><b>平日 09:00–13:30 · 每 5 分鐘更新</b><span>18:00 查核處置與收盤研究 · 台北時間 · 雲端排程可能延遲</span></div><div className="schedule-next" aria-live="polite"><b><Clock3 size={15}/>{next?'下次 '+time(next):'計算下次排程…'}</b><span>{notice}</span></div></section>;
}
export function SessionMarket({stockId}:{stockId:string}){
  const [today,setToday]=useState(''),[now,setNow]=useState(0);
  useEffect(()=>{const update=()=>{setToday(taipeiDate(Date.now()));setNow(Date.now());};update();const timer=setInterval(update,60000);return()=>clearInterval(timer);},[]);
  return <section className="session-market" aria-label="最新成交行情"><div className="session-heading"><span><i/>最新成交快照</span><small>擷取 {time(session.fetchedAt)} · 證交所 MIS</small></div><div className="session-grid">{session.quotes.filter(q=>stockId==='all'||q.id===stockId).map(q=>{
    const freshDate=!today||q.tradingDate===today,localMinute=now?new Date(now+28800000).toISOString().slice(11,16):'',inWindow=localMinute>='09:00'&&localMinute<'13:30';
    const stale=!freshDate||(inWindow&&now-Date.parse(q.timestamp)>20*60000),failed=check.quotes==='failed';
    const isHoliday=now&&marketDayState(now,calendar)==='closed';
    const label=failed?'擷取失敗 · 保留上次':isHoliday?'休市 · 保留成交日期':stale?'尚無新成交資料':q.state==='closed'?'交易時段結束':q.state==='intraday'?'盤中定時快照':'資料待更新';
    return <article key={q.id} className={'session-quote stock-'+q.id}><div className="session-stock"><b>{q.name} <small>{q.id}</small></b><span className={failed||stale?'session-pending':'session-state'}>{label}</span></div><div className="session-price"><strong>{n(q.last)}</strong><span className={q.change>0?'rise':q.change<0?'fall':''}>{q.change>0?'+':''}{n(q.change)}<b>{q.changePct>0?'+':''}{n(q.changePct)}%</b></span></div><div className="session-facts"><span>昨收 <b>{n(q.previousClose)}</b></span><span>成交量 <b>{n(q.volumeLots,0)} 張</b></span></div><p>實際成交 {q.tradingDate} {q.time} <a href={q.source} target="_blank" rel="noreferrer" aria-label={q.name+'行情來源'}><ArrowUpRight size={15}/></a></p></article>;
  })}</div><p className="session-caption">每 5 分鐘擷取，非即時串流；休市或尚無成交時沿用實際成交日期。下方估值卡片採已核對的正式收盤價，與最新成交快照分開列示。</p></section>;
}
export function MarginPanel({stockId}:{stockId:string}){
  return <section className="margin-panel panel" aria-labelledby="margin-title"><div className="section-title"><div><span className="eyebrow">MARGIN & SHORT INTEREST</span><h2 id="margin-title"><Landmark size={22}/>每日融資融券</h2></div><span className="period">近兩週 · {chartSettings.displayTradingDays} 個交易日</span></div><p className="margin-method">券資比 = 融券餘額 ÷ 融資餘額 × 100%。依 Yahoo 股市常用口徑，以「張」比較；每日盤後公布，盤中沿用最新已公布數據。近兩週採最近 10 個交易日，排除週末與休市。</p>{check.margins==='failed'&&<p className="margin-warning" role="status">本次融資融券查核未完成，以下保留上次成功資料，狀態待確認。</p>}<div className="margin-grid">{margins.stocks.filter(s=>stockId==='all'||s.id===stockId).map(s=>{const last=s.history.at(-1)!,visible=chartWindow(s.history,'ratioPct',margins.asOf,calendar,chartSettings) as Array<typeof last&{missing?:boolean}>;return <article className={'margin-stock stock-'+s.id} key={s.id}><div className="margin-top"><span className={'company-tag '+stockConfig(s.id).theme}>{s.name} {s.id}</span><a href={`https://tw.stock.yahoo.com/quote/${s.id}.TW/margin`} target="_blank" rel="noreferrer">Yahoo 對照 ↗</a></div><div className="margin-ratio"><span>券資比<strong>{last.ratioPct===null?'不適用':n(last.ratioPct)}<small>{last.ratioPct===null?'（融資為零）':' %'}</small></strong></span><div><span>融資餘額 <b>{n(last.financing,0)} 張</b><small>較前日 {signed(last.financingChange)} 張</small></span><span>融券餘額 <b>{n(last.short,0)} 張</b><small>較前日 {signed(last.shortChange)} 張</small></span></div></div><MarginTrend history={s.history} asOf={margins.asOf} name={s.name}/><details className="margin-history"><summary>每日明細與來源（近 {visible.length} 日）</summary><div className="margin-table-scroll"><table><thead><tr><th>日期</th><th>融資餘額</th><th>融資增減</th><th>融券餘額</th><th>融券增減</th><th>券資比</th></tr></thead><tbody>{[...visible].reverse().map(row=><tr key={row.date}><th><a target="_blank" rel="noreferrer" href={row.source}>{row.date} ↗</a></th><td>{n(row.financing,0)}</td><td>{signed(row.financingChange)}</td><td>{n(row.short,0)}</td><td>{signed(row.shortChange)}</td><td>{row.missing?'待確認':row.ratioPct===null?'不適用':n(row.ratioPct)+'%'}</td></tr>)}</tbody></table></div></details><p className="margin-source"><a href={last.source} target="_blank" rel="noreferrer">證交所融資融券彙總 ↗</a> · 餘額與增減單位：張</p></article>;})}</div><p className="margin-footnote">5／10／20 日線採各日券資比的算術平均，使用畫面區間之前的完整歷史；不足天數或缺資料時不計算，不以餘額加總後的比率取代。券資比不是借券賣出比率，也不直接代表股價方向。未提供有效數據時標示待確認；融資餘額為零時不計算比率。Yahoo 與本站的更新時間可能不同，請以同一資料日期比較。</p></section>;
}

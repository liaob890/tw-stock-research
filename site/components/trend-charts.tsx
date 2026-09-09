'use client';
import {ComposedChart,Bar,Cell,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {useState} from 'react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import klineHistory from '@/lib/kline-history.json';
import klineCheck from '@/lib/kline-check.json';
import {TIMEFRAMES,timeframeSeries} from '@/scripts/kline-core.mjs';
import calendar from '@/lib/trading-calendar.json';
import settings from '@/lib/chart-settings.json';
import {chartWindow,candleGeometry} from '@/scripts/chart-series-core.mjs';
type Point={date:string;from?:string;to?:string;partial?:boolean;closingSource?:string;open?:number;high?:number;low?:number;close?:number;volumeShares?:number;ratioPct?:number|null;missing?:boolean;ma5:number|null;ma10:number|null;ma20:number|null;source?:string};
type IntradayMeta={source:string;missingBars:number};
type StockKline={id:string;name:string;daily:Point[];intraday:Point[];intradayMeta:IntradayMeta;intradayByInterval?:Record<string,Point[]>;intradayMetaByInterval?:Record<string,IntradayMeta>};
const averageLabel=(key:string,period:string)=>{const count=key.replace('ma',''),config=TIMEFRAMES.find(p=>p.value===period);return config?.intervalMinutes?count+'根'+config.intervalMinutes+'分K均線':count+(config?.unit??'日')+'線';};
const averages=[{key:'ma5',label:'5日線',color:'#69a7ff'},{key:'ma10',label:'10日線',color:'#7651ed'},{key:'ma20',label:'20日線',color:'#e8752b'}] as const;
const n=(v:number|null|undefined,d=2)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d}):'待確認';
function MovingAverageLegend({last,unit,period='day'}:{last:Point|undefined;unit:string;period?:string}){return <div className="ma-legend">{averages.map(a=><span key={a.key}><i style={{background:a.color}}/>{averageLabel(a.key,period)}<b>{n(last?.[a.key])}{typeof last?.[a.key]==='number'?unit:''}</b></span>)}</div>}
const signed=(v:number|undefined)=>typeof v==='number'&&Number.isFinite(v)?`${v>0?'+':''}${n(v)}`:'待確認';
function CandleReadout({row,change}:{row:Point|undefined;change:number|undefined}){
  const label=row?(row.from??row.date)+(row.to&&row.to!==row.from?'～'+row.to.slice(11):'')+(row.partial?'（未結束）':''):'尚無資料';
  return <div className="candle-readout" aria-label="目前 K 棒資料"><b>{label}</b>{row?.missing?<span className="pending">資料待確認</span>:<><span>開 <strong>{n(row?.open)}</strong></span><span>高 <strong>{n(row?.high)}</strong></span><span>低 <strong>{n(row?.low)}</strong></span><span>收 <strong>{n(row?.close)}</strong></span><span>量（張） <strong>{typeof row?.volumeShares==='number'?n(row.volumeShares/1000,0):'待確認'}</strong></span><span className={typeof change==='number'?(change>0?'rise':change<0?'fall':'flat'):'pending'}>漲跌 <strong>{signed(change)}</strong></span></>}</div>;
}
function Readout({active,payload,mode,period='day'}:{active?:boolean;payload?:readonly {payload?:Point}[];mode:'price'|'margin';period?:string}){
  const row=payload?.find(p=>p.payload)?.payload;if(!active||!row)return null;
  return <div className="trend-tooltip"><b>{row.from??row.date}{row.to&&row.to!==row.from?'～'+row.to:''}{row.partial?'（未結束）':''}</b>{row.missing?<p>此交易日資料待確認</p>:mode==='price'?<><div><span>開盤</span><strong>{n(row.open)}</strong></div><div><span>最高</span><strong>{n(row.high)}</strong></div><div><span>最低</span><strong>{n(row.low)}</strong></div><div><span>收盤</span><strong>{n(row.close)}</strong></div></>:<div><span>券資比</span><strong>{row.ratioPct===null?'不適用':n(row.ratioPct)+'%'}</strong></div>}{averages.map(a=><div key={a.key}><span style={{color:a.color}}>{averageLabel(a.key,period)}</span><strong>{n(row[a.key])}{typeof row[a.key]==='number'?(mode==='margin'?'%':' 元'):''}</strong></div>)}</div>;
}
function Candle(props:unknown){
  const p=props as {x?:number;y?:number;width?:number;height?:number;payload?:Point};const row=p.payload;
  if(!row)return null;const g=candleGeometry({x:p.x,y:p.y,width:p.width,height:p.height,open:row.open,high:row.high,low:row.low,close:row.close});if(!g)return null;
  const color=row.close===row.open?'#526581':g.rising?'#d12d49':'#087665';
  return <g><line x1={g.center} x2={g.center} y1={g.wickTop} y2={g.wickBottom} stroke={color} strokeWidth={1} shapeRendering="crispEdges"/><rect x={g.bodyX} y={g.bodyY} width={g.bodyWidth} height={g.bodyHeight} fill={color} stroke={color} strokeWidth={1.25} shapeRendering="crispEdges"/></g>;
}
export function PriceTrend({id}:{id:string}){
  const [period,setPeriod]=useState('day');
  const [hoveredDate,setHoveredDate]=useState<string|null>(null);
  const stock=(klineHistory.stocks as unknown as StockKline[]).find(s=>s.id===id)!;
  const config=TIMEFRAMES.find(p=>p.value===period)!;
  const series=timeframeSeries(stock,period,klineHistory.asOf) as Point[];
  const intraday=Boolean(config.intervalMinutes),intradayMeta=stock.intradayMetaByInterval?.[period]??stock.intradayMeta;
  const intradayDays=intraday?[...new Set(series.map(row=>row.date.slice(0,10)))]:[],intradayMultiDay=intradayDays.length>1;
  const sample=(values:string[],count:number)=>[...new Set(Array.from({length:Math.min(count,values.length)},(_,index)=>values[Math.round(index*(values.length-1)/Math.max(1,Math.min(count,values.length)-1))]))];
  const intradayTicks=intraday?(intradayMultiDay?sample(intradayDays,6).map(day=>series.find(row=>row.date.startsWith(day))!.date):sample(series.map(row=>row.date),6)):undefined;
  const data=series.map(row=>({...row,wick:row.high===undefined||row.low===undefined?null:[row.low,row.high]})),last=series.at(-1);
  const selected=(hoveredDate?series.find(row=>row.date===hoveredDate):undefined)??[...series].reverse().find(row=>!row.missing&&typeof row.close==='number')??last;
  const selectedIndex=selected?series.findIndex(row=>row.date===selected.date):-1,selectedDate=(selected?.from??selected?.date??'').slice(0,10);
  const previous=intraday?[...stock.daily].reverse().find(row=>row.date<selectedDate&&typeof row.close==='number'):[...series.slice(0,selectedIndex)].reverse().find(row=>!row.missing&&typeof row.close==='number');
  const selectedChange=typeof selected?.close==='number'&&typeof previous?.close==='number'?selected.close-previous.close:undefined;
  const hasMissing=series.some(row=>row.missing),partial=last?.partial;
  return <section className="technical-chart" aria-label={stock.name+' K線與均線'}>
    <Tabs value={period} onValueChange={value=>{setPeriod(String(value));setHoveredDate(null)}} className="kline-tabs">
      <div className="kline-toolbar"><b>K 線走勢</b><TabsList className="kline-periods" aria-label={stock.name+' K線週期'}>{TIMEFRAMES.map(p=><TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>)}</TabsList></div>
      <TabsContent value={period} className="kline-content">
        <div className="trend-heading"><b>{config.title}<small>近 {series.length} 根</small></b><span className={partial?'kline-forming':''}>{partial?'本'+config.unit+'尚未結束':'紅實漲 · 綠實跌 · 灰平'}</span></div>
        <CandleReadout row={selected} change={selectedChange}/>
        <MovingAverageLegend last={selected} unit="" period={period}/>
        {(hasMissing||klineCheck.status==='failed')&&<p className="kline-warning" role="status">{klineCheck.status==='failed'?'本次資料待確認，保留上次成功資料。':'部分 K 棒資料待確認，相關均線暫不計算。'}</p>}
        {series.length?<div className="candlestick-chart"><ResponsiveContainer width="100%" height={280}><ComposedChart data={data} margin={{top:14,right:2,left:4,bottom:4}} accessibilityLayer onMouseMove={(state:unknown)=>{const row=(state as {activePayload?:{payload?:Point}[]} | null)?.activePayload?.find(item=>item.payload)?.payload;setHoveredDate(row?.date??null)}} onMouseLeave={()=>setHoveredDate(null)}><CartesianGrid stroke="#dce4ed" vertical/><XAxis dataKey="date" ticks={intradayTicks} interval={intraday?0:undefined} padding={intraday?{left:8,right:8}:undefined} tickFormatter={v=>intraday?(intradayMultiDay?v.slice(5,10).replace('-','/'):v.slice(11)):period==='month'?v.slice(2).replace('-','/'):v.slice(5)} tick={{fontSize:12,fill:'#667c96'}} axisLine={false} tickLine={false} minTickGap={28}/><YAxis orientation="right" domain={['auto','auto']} tick={{fontSize:12,fill:'#667c96'}} axisLine={false} tickLine={false} width={56} tickFormatter={v=>n(v,1)}/><Tooltip content={()=>null} cursor={{stroke:'#8595a9',strokeDasharray:'3 3'}}/><Bar dataKey="wick" name={config.title} shape={Candle} maxBarSize={7} isAnimationActive={false}/>{averages.map(a=><Line key={a.key} dataKey={a.key} name={averageLabel(a.key,period)} stroke={a.color} strokeWidth={1.35} dot={false} connectNulls={false} type="linear" isAnimationActive={false}/>)}</ComposedChart></ResponsiveContainer></div>:<p className="kline-warning">尚無完整 K 線資料，待來源更新。</p>}
        <p className="trend-range">{series[0]?.from??series[0]?.date} — {last?.to??last?.date} · 台北時間 · 元</p>
        <p className="trend-method">{intraday?<>採已完成且來源已更新的 Yahoo 5 分 K；15／30／60 分 K 由同一份 5 分資料彙整，約延遲 20 分鐘。13:30 收盤撮合併入各週期最後一根。<a href={`https://tw.stock.yahoo.com/quote/${id}.TW/technical-analysis`} target="_blank" rel="noreferrer">Yahoo 技術分析對照 ↗</a>／<a href={intradayMeta.source} target="_blank" rel="noreferrer">Yahoo 分時資料 ↗</a>／<a href={stock.daily.at(-1)?.source} target="_blank" rel="noreferrer">證交所收盤核對 ↗</a> 均線為 5／10／20 根所選 K 線的收盤平均。</>:<>證交所未還原日行情{period==='day'?'':'彙整為'+config.unit+' K'}，均線採 5／10／20 {config.unit}收盤簡單平均。{partial?'當期尚未結束，K 棒與均線會隨已核對收盤更新。':''}</>} 未還原除權息；不足期數或缺資料不計算均線。</p>
        <details className="trend-data" key={period}><summary>{config.title}數據與均線明細</summary><div className="margin-table-scroll"><table><thead><tr>{['期間','開盤','最高','最低','收盤',...averages.map(a=>averageLabel(a.key,period))].map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{[...series].reverse().map(row=><tr key={row.date}><th>{row.source?<a href={row.source} target="_blank" rel="noreferrer">{row.from??row.date}{row.to&&row.to!==row.from?'～'+row.to:''} ↗</a>:row.date}{row.partial?'（未結束）':''}{row.closingSource&&<a href={row.closingSource} target="_blank" rel="noreferrer"> · 收盤核對</a>}{row.missing?' · 待確認':''}</th>{(['open','high','low','close','ma5','ma10','ma20'] as const).map(key=><td key={key}>{n(row[key])}</td>)}</tr>)}</tbody></table></div></details>
      </TabsContent>
    </Tabs>
  </section>;
}

export function MarginTrend({history,asOf,name}:{history:{date:string;ratioPct:number|null}[];asOf:string;name:string}){
  const series=chartWindow(history,'ratioPct',asOf,calendar,settings) as Point[];
  return <div className="margin-trend" aria-label={name+'近兩週券資比長條圖及5、10、20日均線'}><div className="trend-heading"><b>每日券資比 <small>近 {series.length} 個交易日</small></b><span>長條：當日比率</span></div><MovingAverageLegend last={series.at(-1)} unit="%"/><ResponsiveContainer width="100%" height={210}><ComposedChart data={series} margin={{left:-18,right:6,top:12,bottom:4}} accessibilityLayer><CartesianGrid vertical={false} stroke="#e4ebf5"/><XAxis dataKey="date" tickFormatter={v=>v.slice(5)} axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#667c96'}} minTickGap={12}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#667c96'}} unit="%" domain={[0,'auto']}/><Tooltip content={props=><Readout {...props} mode="margin"/>} cursor={{fill:'#dfe8f64d'}}/><Bar dataKey="ratioPct" name="券資比" fill="#7194ca" radius={[3,3,0,0]} maxBarSize={28} isAnimationActive={false}/>{averages.map(a=><Line key={a.key} dataKey={a.key} name={a.label} stroke={a.color} strokeWidth={2.2} dot={false} connectNulls={false} type="linear" isAnimationActive={false}/>)}</ComposedChart></ResponsiveContainer><p className="trend-range">{series[0]?.date} — {series.at(-1)?.date}</p></div>;
}

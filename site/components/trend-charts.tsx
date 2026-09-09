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
type StockKline={id:string;name:string;daily:Point[];intraday:Point[];intradayMeta:{source:string;missingBars:number}};
const averageLabel=(key:string,period:string)=>key.replace('ma','')+(TIMEFRAMES.find(p=>p.value===period)?.unit??'日')+'線';
const averages=[{key:'ma5',label:'5日線',color:'#b57710'},{key:'ma10',label:'10日線',color:'#7651cd'},{key:'ma20',label:'20日線',color:'#147f9b'}] as const;
const n=(v:number|null|undefined,d=2)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-TW',{minimumFractionDigits:d,maximumFractionDigits:d}):'待確認';
function MovingAverageLegend({last,unit,period='day'}:{last:Point|undefined;unit:string;period?:string}){return <div className="ma-legend">{averages.map(a=><span key={a.key}><i style={{background:a.color}}/>{averageLabel(a.key,period)}<b>{n(last?.[a.key])}{typeof last?.[a.key]==='number'?unit:''}</b></span>)}</div>}
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
  const stock=(klineHistory.stocks as unknown as StockKline[]).find(s=>s.id===id)!;
  const config=TIMEFRAMES.find(p=>p.value===period)!;
  const series=timeframeSeries(stock,period,klineHistory.asOf) as Point[];
  const data=series.map(row=>({...row,wick:row.high===undefined||row.low===undefined?null:[row.low,row.high]})),last=series.at(-1);
  const hasMissing=series.some(row=>row.missing),partial=last?.partial;
  return <section className="technical-chart" aria-label={stock.name+' K線與均線'}>
    <Tabs value={period} onValueChange={value=>setPeriod(String(value))} className="kline-tabs">
      <div className="kline-toolbar"><b>K 線走勢</b><TabsList className="kline-periods" aria-label={stock.name+' K線週期'}>{TIMEFRAMES.map(p=><TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>)}</TabsList></div>
      <TabsContent value={period} className="kline-content">
        <div className="trend-heading"><b>{config.title}<small>近 {series.length} 根</small></b><span className={partial?'kline-forming':''}>{partial?'本'+config.unit+'尚未結束':'紅實漲 · 綠實跌 · 灰平'}</span></div>
        <MovingAverageLegend last={last} unit="" period={period}/>
        {(hasMissing||klineCheck.status==='failed')&&<p className="kline-warning" role="status">{klineCheck.status==='failed'?'本次資料待確認，保留上次成功資料。':'部分 K 棒資料待確認，相關均線暫不計算。'}</p>}
        {series.length?<div className="candlestick-chart"><ResponsiveContainer width="100%" height={240}><ComposedChart data={data} margin={{top:12,right:6,left:-16,bottom:4}} accessibilityLayer><CartesianGrid stroke="#e4ebf5" vertical={false}/><XAxis dataKey="date" tickFormatter={v=>period==='30m'?v.slice(5).replace(' ','\n'):period==='month'?v.slice(2).replace('-','/'):v.slice(5)} tick={{fontSize:12,fill:'#667c96'}} axisLine={false} tickLine={false} minTickGap={18}/><YAxis domain={['auto','auto']} tick={{fontSize:12,fill:'#667c96'}} axisLine={false} tickLine={false} width={58} tickFormatter={v=>n(v,1)}/><Tooltip content={props=><Readout {...props} mode="price" period={period}/>} cursor={{stroke:'#a5b6d0',strokeDasharray:'3 3'}}/><Bar dataKey="wick" name={config.title} shape={Candle} maxBarSize={12} isAnimationActive={false}/>{averages.map(a=><Line key={a.key} dataKey={a.key} name={averageLabel(a.key,period)} stroke={a.color} strokeWidth={1.4} dot={false} connectNulls={false} type="linear" isAnimationActive={false}/>)}</ComposedChart></ResponsiveContainer></div>:<p className="kline-warning">尚無完整 K 線資料，待來源更新。</p>}
        <p className="trend-range">{series[0]?.from??series[0]?.date} — {last?.to??last?.date} · 台北時間 · 元</p>
        <p className="trend-method">{period==='30m'?<>採已完成且來源已更新的 30 分 K，資料約延遲 20 分鐘；13:30 收盤撮合併入 13:00–13:30。<a href={stock.intradayMeta.source} target="_blank" rel="noreferrer">Yahoo 分時 ↗</a>／<a href={stock.daily.at(-1)?.source} target="_blank" rel="noreferrer">證交所收盤核對 ↗</a></>:<>證交所未還原日行情{period==='day'?'':'彙整為'+config.unit+' K'}，均線採 5／10／20 {config.unit}收盤簡單平均。{partial?'當期尚未結束，K 棒與均線會隨已核對收盤更新。':''}</>}{period==='30m'?' 均線為 5／10／20 根 30 分 K 的收盤平均。':''} 未還原除權息；不足期數或缺資料不計算均線。</p>
        <details className="trend-data" key={period}><summary>{config.title}數據與均線明細</summary><div className="margin-table-scroll"><table><thead><tr>{['期間','開盤','最高','最低','收盤',...averages.map(a=>averageLabel(a.key,period))].map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{[...series].reverse().map(row=><tr key={row.date}><th>{row.source?<a href={row.source} target="_blank" rel="noreferrer">{row.from??row.date}{row.to&&row.to!==row.from?'～'+row.to:''} ↗</a>:row.date}{row.partial?'（未結束）':''}{row.closingSource&&<a href={row.closingSource} target="_blank" rel="noreferrer"> · 收盤核對</a>}{row.missing?' · 待確認':''}</th>{(['open','high','low','close','ma5','ma10','ma20'] as const).map(key=><td key={key}>{n(row[key])}</td>)}</tr>)}</tbody></table></div></details>
      </TabsContent>
    </Tabs>
  </section>;
}

export function MarginTrend({history,asOf,name}:{history:{date:string;ratioPct:number|null}[];asOf:string;name:string}){
  const series=chartWindow(history,'ratioPct',asOf,calendar,settings) as Point[];
  return <div className="margin-trend" aria-label={name+'近兩週券資比長條圖及5、10、20日均線'}><div className="trend-heading"><b>每日券資比 <small>近 {series.length} 個交易日</small></b><span>長條：當日比率</span></div><MovingAverageLegend last={series.at(-1)} unit="%"/><ResponsiveContainer width="100%" height={210}><ComposedChart data={series} margin={{left:-18,right:6,top:12,bottom:4}} accessibilityLayer><CartesianGrid vertical={false} stroke="#e4ebf5"/><XAxis dataKey="date" tickFormatter={v=>v.slice(5)} axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#667c96'}} minTickGap={12}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#667c96'}} unit="%" domain={[0,'auto']}/><Tooltip content={props=><Readout {...props} mode="margin"/>} cursor={{fill:'#dfe8f64d'}}/><Bar dataKey="ratioPct" name="券資比" fill="#7194ca" radius={[3,3,0,0]} maxBarSize={28} isAnimationActive={false}/>{averages.map(a=><Line key={a.key} dataKey={a.key} name={a.label} stroke={a.color} strokeWidth={2.2} dot={false} connectNulls={false} type="linear" isAnimationActive={false}/>)}</ComposedChart></ResponsiveContainer><p className="trend-range">{series[0]?.date} — {series.at(-1)?.date}</p></div>;
}

// Keep a verified company release when the bulk exchange feed has not caught up.
export function chooseMonthly(existing,incoming){
  if(!incoming?.verified)return existing?.verified?existing:incoming;
  if(!existing?.verified)return incoming;
  if(existing.period>incoming.period)return existing;
  if(existing.period===incoming.period&&Math.abs(existing.yoyPct-incoming.yoyPct)<0.01&&Math.abs(existing.ytdYoyPct-incoming.ytdYoyPct)<0.01&&existing.revenue===incoming.revenue)return existing;
  return incoming;
}
export function parseCompanyMonthly(html,year,source){
  if(!new RegExp(year+'\\s*年').test(html))throw new Error('公司月營收年份不符');
  const rows=[...html.matchAll(/<tr\b[\s\S]*?<\/tr>/g)].map(m=>[...m[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>c[1].replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim())).filter(r=>/^\d{1,2}月$/.test(r[0]??'')&&r.length===5&&/^[\d,]+$/.test(r[1])&&/^[\d,]+$/.test(r[2]));
  if(!rows.length)throw new Error('公司月營收表缺漏');
  let ytdRevenue=0,previousYearYtdRevenue=0;
  return rows.map((r,i)=>{const month=Number(r[0].replace('月',''));if(month!==i+1)throw new Error('公司月營收月份不連續');const revenue=Number(r[1].replaceAll(',','')),previousYearRevenue=Number(r[2].replaceAll(',',''));if(previousYearRevenue<=0)throw new Error('去年月營收無效');ytdRevenue+=revenue;previousYearYtdRevenue+=previousYearRevenue;
    const yoyPct=(revenue/previousYearRevenue-1)*100,ytdYoyPct=(ytdRevenue/previousYearYtdRevenue-1)*100;
    if(Math.abs(yoyPct-Number(r[3].replace('%','')))>0.011||Math.abs(ytdYoyPct-Number(r[4].replace('%','')))>0.011)throw new Error('公司月報金額與百分比不符');
    return {verified:true,period:year+'-'+String(month).padStart(2,'0'),revenue,previousYearRevenue,ytdRevenue,previousYearYtdRevenue,yoyPct,ytdYoyPct,source};
  });
}

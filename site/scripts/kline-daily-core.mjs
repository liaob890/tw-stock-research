// A cache fetched during its own month is provisional, even after month rollover.
// Require a timestamp after the whole month ended in the exchange's timezone.
export function canReuseDailyMonth(envelope,month,asOf,checkedAt){
  if(!/^\d{4}(0[1-9]|1[0-2])$/.test(month)||month>=asOf.slice(0,7).replace('-',''))return false;
  const stamp=envelope?.fetchedAt;
  if(typeof stamp!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(stamp))return false;
  const calendarDate=Date.parse(stamp.slice(0,10)+'T00:00:00Z');
  if(!Number.isFinite(calendarDate)||new Date(calendarDate).toISOString().slice(0,10)!==stamp.slice(0,10))return false;
  const fetchedAt=Date.parse(stamp),now=Date.parse(checkedAt);
  const closedAt=Date.UTC(Number(month.slice(0,4)),Number(month.slice(4,6)),1)-8*60*60*1000;
  return Number.isFinite(fetchedAt)&&Number.isFinite(now)&&fetchedAt>=closedAt&&fetchedAt<=now;
}

// Keep this check in acquisition as well as verification: a bad refresh must not
// replace the last good K-line snapshot, even if all stocks share the same gap.
export function assertDailyPriceMatch(id,daily,history){
  if(!Array.isArray(history)||!history.length)throw new Error(id+' 缺少已核對的短期日K歷史');
  const byDate=new Map(daily.map(row=>[row.date,row]));
  for(const expected of history){
    const actual=byDate.get(expected.date);
    if(!actual)throw new Error(id+' '+expected.date+' 長期日K缺少日期（price-history 已有資料）');
    for(const field of ['open','high','low','close']){
      if(!Number.isFinite(expected[field])||actual[field]!==expected[field])throw new Error(id+' '+expected.date+' '+field+' 不一致：price-history='+expected[field]+'，daily='+actual[field]);
    }
  }
}

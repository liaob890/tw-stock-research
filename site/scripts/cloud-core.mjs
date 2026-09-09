export const INTRADAY_CRON='0,30 1-5 * * 1-5';
export const CLOSE_CRON='0 10 * * 1-5';
export function updateMode(eventName,scheduledCron,inputMode='publish') {
  if(eventName==='schedule') {
    if(scheduledCron===INTRADAY_CRON)return 'intraday';
    if(scheduledCron===CLOSE_CRON)return 'close';
    throw new Error('Unknown scheduled slot; cannot infer intraday from delayed start time');
  }
  if(!['publish','intraday','close'].includes(inputMode))throw new Error('Unknown update mode');
  return eventName==='push'?'publish':inputMode;
}
export function latestCommonTradeDate(stocks) {
  const dates=stocks.map(s=>s.quote?.tradingDate);
  if(!dates.length||dates.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d))||new Set(dates).size!==1)throw new Error('Cannot confirm a common actual trading date');
  return dates[0];
}

import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {updateMode,latestCommonTradeDate} from './cloud-core.mjs';
import {taipeiDate} from './market-session-core.mjs';
const site=fileURLToPath(new URL('../',import.meta.url)),root=path.resolve(site,'..');
const mode=updateMode(process.env.GITHUB_EVENT_NAME,process.env.SCHEDULE_CRON,process.env.UPDATE_MODE||process.argv[2]||'publish');
const run=(script,...args)=>{
  const result=spawnSync(process.execPath,[path.join(site,'scripts',script),...args],{cwd:site,stdio:'inherit',timeout:18*60*1000});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(script+' validation/fetch failed; retain last published version');
};
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const date=taipeiDate(new Date());
if(date<'2026-09-08')throw new Error('Schedule not yet started');
if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`mode=${mode}\n`);
if(mode!=='publish') {
  if(process.env.FINALIZE_ONLY!=='true')run('update-session-market.mjs');
  if(mode==='close') {
    if(process.env.FINALIZE_ONLY!=='true')run('collect-market-snapshot.mjs','--date',date);
    const candidate=await read('data/incoming/'+date+'.json');
    if(process.env.FINALIZE_ONLY!=='true')run('update-surveillance.mjs','--date',latestCommonTradeDate(candidate.stocks));
    if(process.env.COLLECT_ONLY==='true'){console.log('Candidate ready for rule-based comparison.');process.exit(0);}
    run('update-changes.mjs','--snapshot',path.join(root,'data/incoming',date+'.json'));
    run('update-price-history.mjs');
    run('update-kline-history.mjs');
  }else run('update-kline-history.mjs','--intraday-only');
}
const session=await read('site/lib/session-market.json');
const result={mode,checkedAt:new Date().toISOString(),status:'collected_not_published',quotes:session.quotes.map(s=>({id:s.id,date:s.tradingDate,time:s.time})),note:'Only mark published after Pages deployment succeeds. Free official-data checks use fixed rules; unsupported quarterly or company-event interpretation stays pending.'};
await mkdir(path.join(root,'data/cloud'),{recursive:true});
await writeFile(path.join(root,'data/cloud/latest-run.json'),JSON.stringify(result,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### 台股股票研究\n\n模式：${mode}；尚待測試及發布。\n\n${result.quotes.map(s=>`- ${s.id}：${s.date} ${s.time}`).join('\n')}\n`);
console.log(JSON.stringify(result));

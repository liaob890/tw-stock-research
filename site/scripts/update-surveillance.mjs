import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSurveillance,surveillanceChanges} from './surveillance-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const value=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
const date=value('--date')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))) throw new Error('使用 --date YYYY-MM-DD');
const inputDir=value('--input-dir');
const compact=date.replaceAll('-','');
const future=new Date(date+'T00:00:00Z');future.setUTCDate(future.getUTCDate()+60);
const end=future.toISOString().slice(0,10).replaceAll('-','');
const urls={notice:`https://www.twse.com.tw/announcement/notice?response=json&startDate=${compact}&endDate=${compact}&querytype=1&sortKind=STKNO`,notetrans:`https://www.twse.com.tw/announcement/notetrans?date=${compact}&response=json`,punish:`https://www.twse.com.tw/announcement/punish?response=json&startDate=${compact}&endDate=${end}&querytype=1&sortKind=STKNO`};
const readJson=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const atomicJson=async(file,data)=>{await mkdir(path.dirname(file),{recursive:true});const temp=file+'.tmp';await writeFile(temp,JSON.stringify(data,null,2)+'\n');await rename(temp,file);};
const rawDir=path.join(root,'..','data','raw',date,'surveillance');
const input={};
try{
  for(const [key,url] of Object.entries(urls)) {
    if(inputDir) input[key]=await readJson(path.join(inputDir,key+'.json'));
    else {const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/json'}});if(!response.ok) throw new Error(`${key}: HTTP ${response.status}`);input[key]={source:url,retrievedAt:new Date().toISOString(),requestedAsOf:date,response:await response.json()};}
    await atomicJson(path.join(rawDir,key+'.json'),input[key]);
  }
  const snapshot=buildSurveillance(input,date,new Date().toISOString());
  const snapshotFile=path.join(root,'lib','surveillance.json');
  let before;try{before=await readJson(snapshotFile);}catch(e){if(e.code!=='ENOENT')throw e;}
  const changes=surveillanceChanges(before,snapshot);
  const changeFile=path.join(root,'..','data','changes',date+'-surveillance.json');
  const publicationFile=path.join(root,'..','data','surveillance-publication.json');
  let prior;try{prior=await readJson(publicationFile);}catch(e){if(e.code!=='ENOENT')throw e;}
  const publicationChanged=JSON.stringify(before?.records)!==JSON.stringify(snapshot.records);
  const publicationPending=publicationChanged||prior?.publicationStatus==='pending';
  await atomicJson(publicationFile,{asOf:date,publicationStatus:publicationPending?'pending':prior?.publicationStatus||'not_required',lastPublishedAt:prior?.lastPublishedAt||null,url:prior?.url||null});
  await atomicJson(changeFile,{checkedAt:snapshot.checkedAt,asOf:date,baselineDate:before?.asOf||null,changed:changes.length>0,changes,publicationStatus:publicationPending?'pending':prior?.publicationStatus||'not_required',note:'發布成功後由每日任務記錄 published 與網址；此程式不發布網站。'});
  await atomicJson(snapshotFile,snapshot);
  await atomicJson(path.join(root,'lib','surveillance-check.json'),{status:'verified',attemptedDate:date,checkedAt:snapshot.checkedAt});
  console.log(JSON.stringify({asOf:date,changes:changes.map(c=>({id:c.id,kind:c.kind})),records:snapshot.records.map(r=>({id:r.id,level:r.level})),publicationPending}));
}catch(error){
  await atomicJson(path.join(root,'lib','surveillance-check.json'),{status:'failed',attemptedDate:date,checkedAt:new Date().toISOString(),message:'官方資料未能完整核對；保留前次已確認資料。'});
  console.error('處置警示更新失敗：'+error.message);process.exitCode=1;
}

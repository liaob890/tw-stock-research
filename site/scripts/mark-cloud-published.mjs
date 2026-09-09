import {readFile,writeFile,appendFile} from 'node:fs/promises';
const file=new URL('../../data/cloud/latest-run.json',import.meta.url);
const run=JSON.parse(await readFile(file,'utf8'));
const url=process.env.PAGE_URL;
if(!url||!/^https:\/\/[^/]+\.github\.io\//.test(url))throw new Error('Missing successful Pages deployment URL');
const result={...run,status:'published',publishedAt:new Date().toISOString(),url,workflowRun:process.env.GITHUB_RUN_ID||null};
await writeFile(file,JSON.stringify(result,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`\n網站發布成功：[台股股票研究](${url})。\n\n${result.quotes.map(q=>`- ${q.id}：${q.date} ${q.time}`).join('\n')}\n`);

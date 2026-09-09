import {readFile,mkdir,writeFile} from 'node:fs/promises';
const names=['session-market','margin-data','session-check','surveillance-check','price-history','kline-history','kline-check'];
const records=await Promise.all(names.map(async name=>JSON.parse(await readFile(new URL('../lib/'+name+'.json',import.meta.url),'utf8'))));
if(records.some(r=>!r.checkedAt))throw new Error('Published revision missing checkedAt');
await mkdir(new URL('../public/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/update-status.json',import.meta.url),JSON.stringify({revision:records.map(r=>r.checkedAt).join('|')}));

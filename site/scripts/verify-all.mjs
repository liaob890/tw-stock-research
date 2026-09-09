import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
for(const name of ['watchlist','chart-series','session-market','research','changes','surveillance','kline','cloud']){
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('verify-'+name+'.mjs',import.meta.url))],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}

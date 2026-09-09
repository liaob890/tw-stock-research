const ids=['2426','3714','2409'];
export function validateReview(review,current,asOf) {
  if(!review||review.asOf!==asOf||!['complete','partial'].includes(review.status)||typeof review.summary!=='string')throw new Error('AI review date/status missing');
  if(!Array.isArray(review.stocks)||review.stocks.map(s=>s.id).join(',')!==ids.join(','))throw new Error('AI review stock order changed');
  const sameShape=(value,baseline,label)=>{
    if(baseline===null){if(value!==null&&typeof value!=='number')throw new Error(label+' type changed');return;}
    if(typeof baseline==='number'){if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw new Error(label+' invalid number');return;}
    if(typeof baseline==='string'||typeof baseline==='boolean'){if(typeof value!==typeof baseline)throw new Error(label+' type changed');return;}
    if(Array.isArray(baseline)){if(!Array.isArray(value))throw new Error(label+' must be array');if(baseline.length)for(const row of value)sameShape(row,baseline[0],label);return;}
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+' must be object');
    for(const key of Object.keys(baseline)){if(!(key in value))throw new Error(label+'.'+key+' missing');sameShape(value[key],baseline[key],label+'.'+key);}
  };
  review.stocks.forEach((s,i)=>sameShape(s,current.stocks[i],s.id));
  if(!review.sources||Array.isArray(review.sources))throw new Error('Missing sources');
  for(const key of Object.keys(current.sources))if(!(key in review.sources))throw new Error('Existing source removed');
  for(const source of Object.values(review.sources)){
    if(!source||typeof source.label!=='string'||typeof source.detail!=='string'||typeof source.url!=='string')throw new Error('Invalid source');
    const url=new URL(source.url);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Source URL must be public HTTPS');
  }
  return review;
}

import { createHash } from 'node:crypto';
import { officialUrl } from '../public/catalog-validation.js';
import { currentCatalog } from './database.mjs';
export async function observeSource(url,fetcher=fetch) {
  if(!officialUrl(url))return {url,status:'FAILED',reason:'NON_OFFICIAL_SOURCE'};
  try {
    const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Omgim-Official-Event-Check/0.3'}});
    if(response.status!==200)return {url,status:'FAILED',reason:'HTTP_'+response.status};
    // Redirects, login pages and HTML shells are never proof that event terms are unchanged.
    const type=response.headers.get('content-type')||'';
    if(!/text\/html|image\/(png|jpeg|webp)|application\/pdf/i.test(type))return {url,status:'FAILED',reason:'UNEXPECTED_CONTENT_TYPE'};
    const hash=createHash('sha256');let bytes=0;
    for await(const chunk of response.body){bytes+=chunk.length;if(bytes>4_000_000)throw Error('SOURCE_TOO_LARGE');hash.update(chunk);}
    if(bytes<100)throw Error('EMPTY_SOURCE');
    return {url,status:'OBSERVED',hash:hash.digest('hex'),bytes,contentType:type};
  } catch {return {url,status:'FAILED',reason:'FETCH_FAILED'};}
}
export async function checkSources(sql,fetcher=fetch) {
  const catalog=await currentCatalog(sql);if(!catalog)throw Error('CATALOG_NOT_SEEDED');
  const urls=[...new Set(catalog.events.flatMap(r=>[r.officialUrl,...r.evidenceUrls]))];
  const results=[];
  for(let i=0;i<urls.length;i+=6)results.push(...await Promise.all(urls.slice(i,i+6).map(u=>observeSource(u,fetcher))));
  for(const r of results.filter(r=>r.status==='OBSERVED')) {
    const old=await sql`SELECT content_hash FROM source_observations WHERE source_url=${r.url}`;
    r.change=old.length?(old[0].content_hash===r.hash?'SAME_BYTES':'CHANGED_BYTES'):'BASELINE';
    await sql`INSERT INTO source_observations(source_url,content_hash) VALUES(${r.url},${r.hash}) ON CONFLICT(source_url) DO UPDATE SET content_hash=excluded.content_hash,checked_at=now()`;
  }
  const details={revision:catalog.revision,requiresConditionReview:true,results};
  // Byte equality does not verify poster footnotes or dynamic event terms. Do not publish here.
  const result=results.some(r=>r.status==='FAILED')?'SOURCE_CHECK_PARTIAL_FAILURE':'SOURCE_CHECK_REVIEW_REQUIRED';
  await sql`INSERT INTO check_runs(result,details) VALUES(${result},${JSON.stringify(details)}::jsonb)`;
  return {result,revision:catalog.revision,checked:results.length,failed:results.filter(r=>r.status==='FAILED').length,changed:results.filter(r=>r.change==='CHANGED_BYTES').length,requiresConditionReview:true};
}

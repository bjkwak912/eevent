import { database, currentCatalog } from '../lib/database.mjs';
import { validateCatalog } from '../public/catalog-validation.js';
import { fingerprint } from '../lib/catalog-service.mjs';
const origin=new URL(process.env.CATALOG_API_ORIGIN);
const response=await fetch(new URL('/api/catalog',origin),{cache:'no-store'});
if(!response.ok||response.headers.get('x-catalog-source')!=='database')throw Error('Public database API unavailable');
const live=validateCatalog(await response.json());const sql=database();const db=await currentCatalog(sql);
if(live.revision!==db.revision||fingerprint(live)!==fingerprint(db))throw Error('Public API does not match DB');
const failures=[];
for(const [path,method] of [['/api/admin/publish','POST'],['/api/cron/check','GET']]) {
  const r=await fetch(new URL(path,origin),{method});if(r.status!==401)throw Error('Unauthorized route must reject requests');
}
const checks=await sql.query("SELECT result,details FROM check_runs WHERE result LIKE 'SOURCE_CHECK%' ORDER BY id DESC LIMIT 1");
if(checks.length)for(const r of checks[0].details.results.filter(r=>r.status==='FAILED'))failures.push({url:r.url,reason:r.reason});
console.log(JSON.stringify({checkedAt:new Date().toISOString(),origin:origin.origin,source:'database',revision:live.revision,records:live.events.length,fingerprint:fingerprint(live),unauthorizedWritesRejected:true,sourceCheck:checks[0]?.result||null,sourceCheckRevision:checks[0]?.details.revision||null,sourceFailures:failures},null,2));

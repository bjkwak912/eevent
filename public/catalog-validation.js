import { catalogBrokers, products } from './model.js';
const domains = ['securities.miraeasset.com','samsungpop.com','kbsec.com','truefriend.com','koreainvestment.com','nhqv.com','mynamuh.com','shinhansec.com','kiwoom.com','daishin.com','tossinvest.com','kakaopaysec.com','hanwhawm.com','hmsec.com'];
const states = ['ACTIVE','RESTRICTED','DETAILS_PENDING','PREPARING','UNVERIFIED'];
export function officialUrl(value) {
  try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') && domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)); } catch { return false; }
}
const integer=(n,min=0,max=100_000_000_000)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const timestamp=s=>typeof s==='string' && /^\d{4}-\d\d-\d\dT/.test(s) && Number.isFinite(Date.parse(s));
const date=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&new Date(s).toISOString().slice(0,10)===s;
const strings=a=>Array.isArray(a)&&a.every(s=>typeof s==='string'&&s.length<=20000);
export function validateCatalog(c) {
  if(!c||c.schemaVersion!==1||!integer(c.revision,1)||!timestamp(c.snapshotAt)||!Array.isArray(c.events)||c.events.length!==30)throw Error('Invalid catalog');
  if(c.brokerages!==undefined && (!Array.isArray(c.brokerages)||c.brokerages.length!==10||c.brokerages.some(b=>!b||!(/^[a-z][a-z0-9_]{1,30}$/).test(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>40||typeof b.shortName!=='string'||!b.shortName.trim()||b.shortName.length>10)))throw Error('Invalid broker registry');
  const firms=catalogBrokers(c);
  if(firms.length!==10||new Set(firms.map(([b])=>b)).size!==10)throw Error('Invalid broker registry');
  const expected=new Set(firms.flatMap(([b])=>Object.keys(products).map(p=>`${p}:${b}`)));
  for(const r of c.events) {
    if(!expected.delete(r.id)||r.id!==`${r.product}:${r.brokerageId}`||!states.includes(r.status))throw Error('Invalid coverage');
    for(const k of ['title','kind','rewardUnit','retentionText','paymentText','applicationText','calculationNote'])if(typeof r[k]!=='string'||!r[k].trim()||r[k].length>20000)throw Error('Invalid text');
    if(!['원','P'].includes(r.rewardUnit)||!officialUrl(r.officialUrl)||!strings(r.evidenceUrls)||!r.evidenceUrls.length||!r.evidenceUrls.every(officialUrl)||!timestamp(r.verifiedAt)||!strings(r.conditions))throw Error('Invalid evidence');
    if((r.startDate!==null&&!date(r.startDate))||(r.endDate!==null&&!date(r.endDate))||(r.startDate&&r.endDate&&r.startDate>r.endDate))throw Error('Invalid dates');
    if(!integer(r.multiplierNumerator,1,10)||!integer(r.multiplierDenominator,1,10)||!integer(r.multiplierMinimum)||!integer(r.minimumTransferWon,1)||!Array.isArray(r.tiers))throw Error('Invalid amounts');
    let last=-1;
    for(const t of r.tiers){if(!integer(t.minimumWon)||t.minimumWon<=last||!integer(t.rewardWon))throw Error('Invalid tiers');last=t.minimumWon;}
    if(['ACTIVE','RESTRICTED'].includes(r.status)) {
      if(r.calculationVerified!==true||!r.tiers.length||!r.startDate||!r.endDate||!r.conditions.length)throw Error('Unverified calculation');
    } else if(r.tiers.length)throw Error('Unknown reward must be hidden');
  }
  return c;
}
// The same business fields as scripts/catalog_publish.py. Times and source rotation do not trigger a publication.
export function businessContent(c) {
  return {schemaVersion:c.schemaVersion,...(c.brokerages?{brokerages:[...c.brokerages].sort((a,b)=>a.id.localeCompare(b.id,'en'))}:{}),events:c.events.map(original=>{
    const r=structuredClone(original);for(const k of ['verifiedAt','evidenceUrls','officialUrl','title'])delete r[k];
    r.conditions=[...new Set(r.conditions.map(s=>s.trim().replace(/\s+/g,' ')))].sort();return r;
  }).sort((a,b)=>a.id.localeCompare(b.id,'en'))};
}

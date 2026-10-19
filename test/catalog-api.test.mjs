import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../public/catalog-validation.js';
import { fingerprint, reviewedPublication } from '../lib/catalog-service.mjs';
import { handle } from '../lib/api.mjs';
import { fetchCatalog } from '../public/catalog-client.js';
import { observeSource } from '../lib/source-check.mjs';
const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
test('remote catalog rejects missing coverage, unverified rewards, wrong tiers and foreign source URLs',()=>{
  validateCatalog(catalog);
  const active=c=>c.events.find(r=>r.status==='ACTIVE'&&r.tiers.length>1);
  for(const mutate of [c=>c.events.pop(),c=>active(c).tiers.reverse(),c=>active(c).officialUrl='https://evil.test',c=>active(c).calculationVerified=false,c=>active(c).status='UNVERIFIED']) {
    const c=structuredClone(catalog);mutate(c);assert.throws(()=>validateCatalog(c));
  }
});
test('metadata-only changes do not change semantic fingerprint',()=>{
  const c=structuredClone(catalog);c.revision+=5;c.snapshotAt='2026-10-20T12:00:00+09:00';c.events.reverse();
  for(const r of c.events){r.verifiedAt=c.snapshotAt;r.title+=' changed';r.evidenceUrls.reverse();r.conditions.reverse();}
  assert.equal(fingerprint(c),fingerprint(catalog));
  c.events.find(r=>r.status==='ACTIVE').tiers[0].rewardWon+=1;assert.notEqual(fingerprint(c),fingerprint(catalog));
});
test('publication requires review and compare-and-swap base revision',()=>{
  assert.throws(()=>reviewedPublication({catalog}));assert.throws(()=>reviewedPublication({catalog,expectedRevision:3,reviewNote:''}));
  assert.equal(reviewedPublication({catalog,expectedRevision:3,reviewNote:'Official poster reviewed'}).expectedRevision,3);
});
test('unauthorized publication and cron cannot call database',async()=>{
  for(const [path,method] of [['/api/admin/publish','POST'],['/api/cron/check','GET']]) {
    const r=await handle(new Request('https://example.test'+path,{method}),{sql:()=>{throw Error('must not query');}});assert.equal(r.status,401);
  }
});
test('catalog API serves DB data, supports ETag, and returns 503 on database failure',async()=>{
  const sql=async()=>[{catalog}];const r=await handle(new Request('https://example.test/api/catalog'),{sql});
  assert.equal(r.status,200);assert.equal(r.headers.get('x-catalog-source'),'database');assert.deepEqual(await r.json(),catalog);
  const same=await handle(new Request('https://example.test/api/catalog',{headers:{'If-None-Match':r.headers.get('etag')}}),{sql});assert.equal(same.status,304);
  const failed=await handle(new Request('https://example.test/api/catalog'),{sql:()=>{throw Error('private DATABASE_URL secret');}});
  assert.equal(failed.status,503);assert.equal((await failed.text()).includes('private'),false);
});
test('client updates data without deployment and rejects corrupt or older data',async()=>{
  const newer={...catalog,revision:catalog.revision+1};
  const result=await fetchCatalog(catalog,async()=>Response.json(newer,{headers:{'x-catalog-source':'database'}}));assert.equal(result.catalog.revision,newer.revision);
  await assert.rejects(fetchCatalog(newer,async()=>Response.json(catalog)));
  await assert.rejects(fetchCatalog(catalog,async()=>Response.json({events:[]})));
  await assert.rejects(fetchCatalog(catalog,async()=>new Response(null,{status:503})));
});
test('source access failures or redirects cannot imply event expiry or a verified unchanged result',async()=>{
  const url=catalog.events[0].officialUrl;
  for(const status of [302,403,404,500])assert.equal((await observeSource(url,async()=>new Response(null,{status}))).status,'FAILED');
  const r=await observeSource(url,async()=>new Response('<html>'+'.'.repeat(200)+'</html>',{headers:{'content-type':'text/html'}}));
  assert.equal(r.status,'OBSERVED');assert.match(r.hash,/^[a-f0-9]{64}$/);assert.equal(r.verified,undefined);
  assert.equal((await observeSource('https://evil.test',()=>{throw Error();})).status,'FAILED');
});

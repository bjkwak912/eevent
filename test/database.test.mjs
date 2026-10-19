import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { fingerprint } from '../lib/catalog-service.mjs';
const original=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
test('Postgres publication preserves no-op revision, rejects stale writers, keeps history and atomically advances pointer',async()=>{
  const db=new PGlite();
  try{
    await db.exec(await readFile(new URL('../db/001_catalog.sql',import.meta.url),'utf8'));
    const publish=async(c,expected)=>(await db.query('SELECT publish_catalog($1::jsonb,$2,$3,$4) AS result',[JSON.stringify(c),fingerprint(c),expected,'Reviewed official terms'])).rows[0].result;
    assert.deepEqual(await publish(original,0),{published:true,revision:3});
    const same=structuredClone(original);same.snapshotAt='2026-10-20T12:00:00+09:00';
    assert.deepEqual(await publish(same,3),{published:false,revision:3});
    const changed=structuredClone(original);changed.events.find(r=>r.status==='ACTIVE').tiers[0].rewardWon++;
    await assert.rejects(publish(changed,2),/STALE_REVISION/);
    assert.deepEqual(await publish(changed,3),{published:true,revision:4});
    const rows=(await db.query('SELECT v.revision,v.catalog FROM catalog_current c JOIN catalog_versions v ON c.revision=v.revision')).rows;
    assert.equal(rows[0].revision,4);assert.equal(rows[0].catalog.revision,4);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM catalog_versions')).rows[0].n,2);
    const logs=(await db.query('SELECT result FROM check_runs ORDER BY id')).rows.map(r=>r.result);
    assert.deepEqual(logs,['REVIEWED_PUBLISHED','REVIEWED_UNCHANGED','REVIEWED_PUBLISHED']);
  }finally{await db.close();}
});

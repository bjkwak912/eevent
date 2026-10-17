import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reward, rewardLabel, parseAmount, toggleSelection, status } from '../public/model.js';
const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
const event={...catalog.events.find(row=>row.status==='ACTIVE'),startDate:'2026-10-01',endDate:'2026-12-31',multiplierNumerator:3,multiplierDenominator:2,multiplierMinimum:0,minimumTransferWon:1,tiers:[{minimumWon:5_000_000,rewardWon:20_000}]};
test('integer boundary for fractional multiplier',()=>{assert.equal(reward(event,3_333_333,'2026-10-17'),null);assert.equal(reward(event,3_333_334,'2026-10-17'),20_000);});
test('restriction, dates, invalid input and boost minimum',()=>{
 for(const state of ['RESTRICTED','DETAILS_PENDING','UNVERIFIED'])assert.equal(reward({...event,status:state},10_000_000,'2026-10-17'),null);
 assert.equal(reward(event,10_000_000,'2027-01-01'),null);assert.equal(status(event,'2027-01-01'),'종료된 행사');
 assert.equal(reward(event,0,'2026-10-17'),null);assert.equal(reward(event,1e12,'2026-10-17'),null);
 assert.equal(reward({...event,multiplierMinimum:10_000_000},3_333_334,'2026-10-17'),null);
 assert.equal(parseAmount('10000000'),10_000_000);for(const raw of ['', '-1','1.2','100000000001'])assert.equal(parseAmount(raw),null);
});
test('all 30 records keep unique coverage and unknown rewards hidden',()=>{
 assert.equal(new Set(catalog.events.map(row=>row.id)).size,30);
 for(const product of ['ISA','PENSION','IRP'])assert.equal(catalog.events.filter(row=>row.product===product).length,10);
 for(const row of catalog.events.filter(row=>row.status!=='ACTIVE'))assert.equal(reward(row,10_000_000,'2026-10-17'),null);
 const points={...event,rewardUnit:'P'};assert.equal(rewardLabel(points,10_000_000,'2026-10-17'),'20,000P');
});
test('selection never exceeds three and can be removed',()=>{const ids=['a','b','c'];assert.equal(toggleSelection(ids,'d'),ids);assert.deepEqual(toggleSelection(ids,'b'),['a','c']);});

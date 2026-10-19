import { createHash, timingSafeEqual } from 'node:crypto';
import { businessContent, validateCatalog } from '../public/catalog-validation.js';
export function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const fingerprint=c=>createHash('sha256').update(canonical(businessContent(c))).digest('hex');
export function authorized(request,secret) {
  if(!secret||secret.length<32)return false;
  const actual=Buffer.from(request.headers.get('authorization')||'');const expected=Buffer.from('Bearer '+secret);
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function reviewedPublication(body) {
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.reviewNote!=='string'||!body.reviewNote.trim()||body.reviewNote.length>5000)throw Error('Review and expected revision required');
  validateCatalog(body.catalog);
  return {catalog:body.catalog,expectedRevision:body.expectedRevision,reviewNote:body.reviewNote.trim(),fingerprint:fingerprint(body.catalog)};
}
export async function publishReviewed(body,sql) {
  const p=reviewedPublication(body);
  const rows=await sql`SELECT publish_catalog(${JSON.stringify(p.catalog)}::jsonb, ${p.fingerprint}, ${p.expectedRevision}, ${p.reviewNote}) AS result`;
  return rows[0].result;
}

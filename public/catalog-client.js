import { validateCatalog } from './catalog-validation.js';
export async function fetchCatalog(current, fetcher=fetch) {
  const response=await fetcher('/api/catalog',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Catalog unavailable');
  const next=validateCatalog(await response.json());
  if(current && next.revision<current.revision)throw Error('Catalog rollback rejected');
  return {catalog:next,source:response.headers.get('x-catalog-source')==='database'?'server':'bundled'};
}

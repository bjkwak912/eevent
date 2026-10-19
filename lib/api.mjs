import { readFile } from 'node:fs/promises';
import { database, currentCatalog } from './database.mjs';
import { validateCatalog } from '../public/catalog-validation.js';
import { authorized, fingerprint, publishReviewed } from './catalog-service.mjs';
import { checkSources } from './source-check.mjs';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
export async function handle(request, dependencies={}) {
  const path=new URL(request.url).pathname;
  const sql=()=>dependencies.sql||database();
  try {
    if(path==='/api/catalog'&&request.method==='GET') {
      const configured=Boolean(dependencies.sql||process.env.DATABASE_URL);
      const catalog=configured?await currentCatalog(sql()):JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
      if(!catalog)return json({error:'CATALOG_NOT_SEEDED'},503);
      validateCatalog(catalog);
      const etag='"'+catalog.revision+'-'+fingerprint(catalog)+'"';
      const meta={'ETag':etag,'X-Catalog-Source':configured?'database':'bundled','X-Catalog-Revision':String(catalog.revision)};
      if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers:{...headers,...meta}});
      return json(catalog,200,meta);
    }
    if(path==='/api/admin/publish'&&request.method==='POST') {
      if(!authorized(request,process.env.CATALOG_PUBLISH_TOKEN))return json({error:'UNAUTHORIZED'},401);
      const text=await request.text();if(Buffer.byteLength(text)>1_000_000)return json({error:'PAYLOAD_TOO_LARGE'},413);
      let body;try{body=JSON.parse(text);}catch{return json({error:'INVALID_JSON'},400);}
      let result;try{result=await publishReviewed(body,sql());}catch(error){
        if(String(error.message).includes('STALE_REVISION'))return json({error:'STALE_REVISION'},409);
        if(!error.code && !String(error.message).includes('DATABASE'))return json({error:'INVALID_REVIEWED_CATALOG'},400);
        throw error;
      }
      return json(result);
    }
    if(path==='/api/cron/check'&&request.method==='GET') {
      if(!authorized(request,process.env.CRON_SECRET))return json({error:'UNAUTHORIZED'},401);
      return json(await checkSources(sql(),dependencies.fetcher));
    }
    return json({error:'NOT_FOUND'},404);
  } catch {
    // Do not return database URLs, provider errors or tokens to the public client.
    return json({error:'SERVICE_UNAVAILABLE'},503);
  }
}

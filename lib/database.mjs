import { neon } from '@neondatabase/serverless';
export function database(url=process.env.DATABASE_URL) {
  if(!url)throw Error('DATABASE_NOT_CONFIGURED');
  return neon(url);
}
export async function currentCatalog(sql=database()) {
  const rows=await sql`SELECT v.catalog FROM catalog_current c JOIN catalog_versions v ON v.revision=c.revision WHERE c.singleton=true`;
  return rows[0]?.catalog ?? null;
}

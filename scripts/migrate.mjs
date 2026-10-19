import { readFile } from 'node:fs/promises';
import { database } from '../lib/database.mjs';
// Run only after the intended Vercel project and DATABASE_URL have been verified.
if(!process.env.DATABASE_URL_UNPOOLED)throw Error('Direct migration connection required');
const sql=database(process.env.DATABASE_URL_UNPOOLED);
const statements=(await readFile(new URL('../db/001_catalog.sql',import.meta.url),'utf8')).split('-- statement-break').map(s=>s.trim()).filter(Boolean);
await sql.transaction(statements.map(statement=>sql.query(statement)));
console.log('Catalog schema ready');

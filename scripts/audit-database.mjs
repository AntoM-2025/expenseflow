// Read-only audit. Run with node --env-file=.env[.neon] scripts/audit-database.mjs.
import pg from '../server/node_modules/pg/lib/index.js';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url = process.env.DATABASE_URL;
const client = new pg.Client(url ? { connectionString: url } : {
  host: process.env.POSTGRES_HOST ?? '127.0.0.1', port: Number(process.env.POSTGRES_PORT ?? 5433),
  user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB,
});
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  console.log('Target:', { host: client.connectionParameters.host, database: client.connectionParameters.database });
  console.log('Counts:', (await client.query('SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM payers) AS payers, (SELECT count(*) FROM expenses) AS expenses')).rows[0]);
  const incomes = (await client.query("SELECT to_regclass('public.incomes')::text AS incomes")).rows[0].incomes;
  console.log('Incomes:', incomes ? (await client.query('SELECT count(*) FROM incomes')).rows[0].count : 'MISSING');
  console.log('Expenses visible through ownership join:', (await client.query('SELECT count(*) FROM expenses e JOIN payers p ON p.id=e.payer_id AND p.user_id=e.user_id')).rows[0].count);
  const history = (await client.query('SELECT filename, checksum FROM schema_migrations ORDER BY filename')).rows;
  const dir = new URL('../database/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort();
  for (const file of files) {
    const checksum = createHash('sha256').update(await readFile(new URL(file, dir))).digest('hex');
    const applied = history.find(row => row.filename === file);
    console.log(file, !applied ? 'PENDING' : checksum === applied.checksum ? 'MATCH' : 'CHECKSUM MISMATCH');
    if (applied && checksum !== applied.checksum) process.exitCode = 1;
  }
  for (const row of history) if (!files.includes(row.filename)) {
    console.log('UNKNOWN APPLIED MIGRATION', row.filename); process.exitCode = 1;
  }
  await client.query('ROLLBACK');
} catch (error) {
  console.error('Audit failed:', error.code ?? error.name); process.exitCode = 1;
} finally { await client.end(); }

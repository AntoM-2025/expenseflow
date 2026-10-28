// Run inside the candidate image with LOCAL credentials, never production ones.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access } from 'node:fs/promises';
if (process.env.DATABASE_URL || process.env.POSTGRES_DB !== 'expenseflow_debug') throw new Error('Only local debug credentials are allowed');
const url = new URL('postgresql://host.docker.internal:5433/expenseflow_debug');
url.username = process.env.POSTGRES_USER; url.password = process.env.POSTGRES_PASSWORD;
const app = spawn(process.execPath, ['dist/app.js'], { env: { ...process.env, DATABASE_URL: url.href, NODE_ENV: 'production', PORT: '10000', APP_ORIGINS: 'http://localhost:10000' }, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Startup timeout')), 10000);
    app.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    app.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited')); });
  });
  for (const [path, status] of [['/api/health', 200], ['/api/auth/me', 401], ['/api/expenses', 401], ['/api/payers', 401], ['/api/incomes', 401], ['/api/missing', 404], ['/', 200], ['/dashboard', 200]]) {
    const response = await fetch(`http://localhost:10000${path}`);
    assert.equal(response.status, status, path);
    if (path === '/' || path === '/dashboard') assert.match(await response.text(), /<div id="root">/);
    console.log('PASS', path, status);
  }
  await access('/app/database/migrations/011_create_incomes.sql');
  console.log('PASS production runtime, frontend fallback, database connection, migration artifact');
} finally {
  if (app.exitCode === null) { app.kill(); await once(app, 'exit'); }
}

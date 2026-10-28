// Uses a uniquely named disposable database; never migrates the configured database.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const config = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.POSTGRES_HOST ?? '127.0.0.1', port: Number(process.env.POSTGRES_PORT ?? 5433),
  user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB,
};
const admin = new pg.Client(config);
const database = `expenseflow_test_${randomBytes(6).toString('hex')}`;
let app;
let created = false;
await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  const params = admin.connectionParameters;
  const url = new URL('postgresql://localhost');
  url.hostname = params.host; url.port = String(params.port);
  url.username = params.user; url.password = params.password; url.pathname = `/${database}`;
  const origin = 'http://127.0.0.1:33219';
  const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test', APP_ORIGINS: origin, PORT: '33219' };
  const migration = spawn(process.execPath, ['src/migrate.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let migrationOutput = '';
  migration.stdout.on('data', b => { migrationOutput += b; });
  migration.stderr.on('data', b => { migrationOutput += b; });
  assert.equal((await once(migration, 'exit'))[0], 0, migrationOutput);
  app = spawn(process.execPath, ['src/app.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    app.stdout.on('data', () => { clearTimeout(timer); resolve(); });
    app.on('exit', () => { clearTimeout(timer); reject(new Error('Server exited')); });
    app.stderr.on('data', b => process.stderr.write(b));
  });
  async function request(path, { method = 'GET', body, cookie = '', status = 200 } = {}) {
    const response = await fetch(`${origin}/api${path}`, { method, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
    return response;
  }
  async function account(username) {
    await request('/auth/register', { method: 'POST', status: 201, body: { name: username, username, email: `${username}@example.com`, password: 'test-password-123' } });
    const response = await request('/auth/login', { method: 'POST', body: { username, password: 'test-password-123' } });
    return response.headers.get('set-cookie').split(';')[0];
  }
  await request('/incomes', { status: 401 });
  const alice = await account('test_alice');
  const bob = await account('test_bob');
  const payer = await (await request('/payers', { method: 'POST', cookie: alice, status: 201, body: { name: 'Alice payer' } })).json();
  const incomeBody = { payerId: payer.id, amountCents: 123456, category: 'Salary', incomeDate: '2026-01-31' };
  await request('/incomes', { method: 'POST', cookie: bob, status: 404, body: incomeBody });
  for (const invalid of [{ amountCents: 0 }, { amountCents: -1 }, { amountCents: 1.5 }, { amountCents: 100000001 }, { incomeDate: '2026-02-30' }, { payerId: '9223372036854775808' }]) {
    await request('/incomes', { method: 'POST', cookie: alice, status: 400, body: { ...incomeBody, ...invalid } });
  }
  const income = await (await request('/incomes', { method: 'POST', cookie: alice, status: 201, body: incomeBody })).json();
  assert.equal(income.amountCents, 123456);
  assert.equal(income.incomeDate, '2026-01-31');
  assert.equal((await (await request('/incomes', { cookie: alice })).json()).length, 1);
  assert.deepEqual(await (await request('/incomes', { cookie: bob })).json(), []);
  await request(`/incomes/${income.id}`, { method: 'DELETE', cookie: bob, status: 404 });
  await request(`/payers/${payer.id}`, { method: 'DELETE', cookie: bob, status: 404 });
  await request('/payers/9223372036854775808', { method: 'DELETE', cookie: alice, status: 400 });
  await request(`/incomes/${income.id}`, { method: 'DELETE', cookie: alice, status: 204 });
  await request('/incomes', { method: 'POST', cookie: alice, status: 201, body: incomeBody });
  await request('/expenses', { method: 'POST', cookie: alice, status: 201, body: { payerId: payer.id, amountCents: 1234, category: 'Groceries', expenseDate: '2026-01-31' } });
  await request(`/payers/${payer.id}`, { method: 'DELETE', cookie: alice, status: 204 });
  for (const path of ['/payers', '/incomes', '/expenses']) assert.deepEqual(await (await request(path, { cookie: alice })).json(), []);
  await request(`/payers/${payer.id}`, { method: 'DELETE', cookie: alice, status: 404 });
  const emptyPayer = await (await request('/payers', { method: 'POST', cookie: alice, status: 201, body: { name: 'Empty' } })).json();
  await request(`/payers/${emptyPayer.id}`, { method: 'DELETE', cookie: alice, status: 204 });
  console.log('PASS: migrations, income validation and CRUD, account isolation, payer deletion with and without movements.');
} finally {
  if (app && app.exitCode === null) { app.kill(); await once(app, 'exit'); }
  if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}

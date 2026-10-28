import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSection } from '../src/loadSection.ts';

for (const status of [401, 404, 500]) {
  for (const failed of ['expenses', 'payers', 'incomes']) {
    test(`${failed} HTTP ${status} leaves other sections available`, async t => {
      t.mock.method(globalThis, 'fetch', async url => url.endsWith(failed)
        ? new Response('not JSON', { status }) : Response.json([{ id: '1' }]));
      const data = {}, errors = {}, done = [];
      await Promise.all(['expenses', 'payers', 'incomes'].map(section => loadSection(section, new AbortController().signal,
        rows => { data[section] = rows; }, error => { errors[section] = error; }, () => done.push(section))));
      assert.equal(Object.keys(data).length, 2);
      assert.equal(data[failed], undefined);
      assert.match(errors[failed], status === 401 ? /session expired/ : new RegExp(`HTTP ${status}`));
      assert.equal(done.length, 3);
    });
  }
}
test('a pending request does not delay a successful section', async t => {
  let resolve;
  t.mock.method(globalThis, 'fetch', url => url.endsWith('incomes') ? new Promise(r => { resolve = r; }) : Promise.resolve(Response.json([])));
  const signal = new AbortController().signal;
  const pending = loadSection('incomes', signal, () => {}, assert.fail, () => {});
  let ready = false;
  await loadSection('expenses', signal, () => { ready = true; }, assert.fail, () => {});
  assert.equal(ready, true);
  resolve(Response.json([])); await pending;
});
test('invalid JSON, invalid shape and network failures are section errors', async t => {
  for (const result of [() => new Response('<html>'), () => Response.json({}), () => { throw new Error('Network failure'); }]) {
    t.mock.method(globalThis, 'fetch', result);
    let error;
    await loadSection('incomes', new AbortController().signal, assert.fail, message => { error = message; }, () => {});
    assert.equal(typeof error, 'string');
  }
});
test('aborted loads never update state', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async () => { controller.abort(); return Response.json([]); });
  await loadSection('expenses', controller.signal, assert.fail, assert.fail, assert.fail);
});

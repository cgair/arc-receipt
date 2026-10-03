import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// Execute the real app controller with a small DOM boundary and controllable
// async dependencies. This tests ordering/export logic, not browser rendering.
const source = (await readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8')).replace(/^import \{ verifyPayment \} from '\.\/core\.mjs';\n/, '');
const hash = '0x' + '12'.repeat(32);
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function result(overrides = {}) { return { hash, state: 'finalized', match: true, payments: [{ amount: '1.234567890123456789', from: '0x' + '34'.repeat(20), to: '0x' + '56'.repeat(20), source: 'Native USDC event', logIndex: '0' }], gas: { usdc: '0.000525' }, blockNumber: '123', timestamp: '2026-10-04T00:00:00.000Z', explorer: `https://explorer.arc.io/tx/${hash}`, evidence: { exact: 'retained' }, ...overrides }; }
function harness() {
  const elements = new Map(), verifications = [], exampleRequests = [], downloads = [], blobs = [], revoked = [], timers = [];
  let tool;
  function element(id) {
    if (!elements.has(id)) {
      const listeners = new Map(); let html = '';
      elements.set(id, { value: '', disabled: false, addEventListener(type, handler) { listeners.set(type, handler); }, dispatch(type) { return listeners.get(type)?.({ preventDefault() {} }); }, set innerHTML(value) { html = value; if (id === 'result') { elements.delete('download'); if (value.includes('id="download"')) element('download'); } }, get innerHTML() { return html; } });
    }
    return elements.get(id);
  }
  const document = { getElementById: element, createElement() { const a = { click() { downloads.push({ href: a.href, filename: a.download }); } }; return a; }, modelContext: { registerTool(t) { tool = t; } } };
  const context = vm.createContext({ document, Blob, AbortSignal, URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:receipt'; }, revokeObjectURL(url) { revoked.push(url); } }, setTimeout(fn) { timers.push(fn); }, verifyPayment(...args) { const d = deferred(); verifications.push({ ...d, args }); return d.promise; }, fetch() { const d = deferred(); exampleRequests.push(d); return d.promise; } });
  vm.runInContext(source, context, { filename: 'app.mjs' });
  return { element, verifications, exampleRequests, downloads, blobs, revoked, timers, tool: () => tool };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('a newer verification wins when responses arrive in reverse order', async () => {
  const h = harness(); const first = h.tool().execute({ hash }); const secondHash = '0x' + '78'.repeat(32); const second = h.tool().execute({ hash: secondHash });
  h.verifications[1].resolve(result({ hash: secondHash })); await second;
  const expectedHTML = h.element('result').innerHTML;
  h.verifications[0].resolve(result()); const stale = await first;
  assert.equal(stale.superseded, true); assert.equal(h.element('result').innerHTML, expectedHTML); assert.ok(expectedHTML.includes(secondHash));
});
test('input edits invalidate in-flight verification and remove export', async () => {
  const h = harness(); const pending = h.tool().execute({ hash });
  h.element('amount').value = '2'; h.element('amount').dispatch('input');
  h.verifications[0].resolve(result()); await pending;
  assert.match(h.element('result').innerHTML, /Ready to verify/); assert.doesNotMatch(h.element('result').innerHTML, /id="download"/); assert.equal(h.element('verify').disabled, false);
});
test('export JSON retains exact amount, raw evidence and current transaction', async () => {
  const h = harness(); const value = result(); const pending = h.tool().execute({ hash }); h.verifications[0].resolve(value); await pending;
  h.element('download').dispatch('click');
  assert.deepEqual(JSON.parse(await h.blobs[0].text()), value); assert.match(h.downloads[0].filename, /^arc-receipt-0x1212121212\.json$/);
  assert.deepEqual(h.revoked, []); h.timers[0](); assert.deepEqual(h.revoked, ['blob:receipt']);
  h.element('recipient').dispatch('input'); assert.doesNotMatch(h.element('result').innerHTML, /id="download"/);
});
test('slow example response cannot overwrite a user edit', async () => {
  const h = harness(); const pending = h.element('example').dispatch('click');
  h.element('hash').value = 'my new input'; h.element('hash').dispatch('input');
  h.exampleRequests[0].resolve({ ok: true, json: async () => ({ hash, amount: '1', recipient: '' }) }); await pending;
  assert.equal(h.element('hash').value, 'my new input'); assert.equal(h.verifications.length, 0); assert.match(h.element('result').innerHTML, /Ready to verify/);
});
test('slow example error cannot overwrite a newer successful verification', async () => {
  const h = harness(); const example = h.element('example').dispatch('click'); const query = h.tool().execute({ hash });
  h.verifications[0].resolve(result()); await query; const html = h.element('result').innerHTML;
  h.exampleRequests[0].reject(new Error('late example error')); await example;
  assert.equal(h.element('result').innerHTML, html); assert.equal(h.element('verify').disabled, false);
});
test('example verification failure is displayed once and re-enables controls', async () => {
  const h = harness(); const pending = h.element('example').dispatch('click');
  h.exampleRequests[0].resolve({ ok: true, json: async () => ({ hash, amount: '1', recipient: '' }) }); await tick();
  h.verifications[0].reject(new Error('RPC offline')); await pending;
  assert.match(h.element('result').innerHTML, /Unable to verify/); assert.match(h.element('result').innerHTML, /RPC offline/); assert.equal(h.element('verify').disabled, false); assert.equal(h.element('example').disabled, false);
});
test('untrusted RPC error text is escaped before HTML rendering', async () => {
  const h = harness(); const query = h.tool().execute({ hash }); const rejection = assert.rejects(query);
  h.verifications[0].reject(new Error('<img src=x onerror=alert(1)>')); await rejection;
  assert.doesNotMatch(h.element('result').innerHTML, /<img/); assert.match(h.element('result').innerHTML, /&lt;img/);
});
test('pending and nonexistent results do not expose receipt export', async () => {
  for (const state of ['pending', 'not-found']) {
    const h = harness(); const query = h.tool().execute({ hash }); h.verifications[0].resolve(result({ state, payments: [], match: null })); await query;
    assert.doesNotMatch(h.element('result').innerHTML, /id="download"/);
  }
});

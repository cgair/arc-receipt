import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NETWORK, interpret, parseAmount, formatUnits, validateHash, validateAddress, rpc, verifyPayment } from '../dist/core.mjs';

const samples = await Promise.all(['mainnet-native-transfer', 'mainnet-native-precision', 'mainnet-erc20-transfer'].map(async name => JSON.parse(await readFile(new URL(`../evidence/${name}.json`, import.meta.url)))));
function fixture(index = 0) {
  const s = structuredClone(samples[index]);
  return { hash: s.transaction.hash, chainId: '0x13b2', tx: s.transaction, receipt: s.receipt, block: s.block, finalized: s.block, checkedAt: '2026-10-04T00:00:00.000Z' };
}
const otherAddress = '0x' + 'ab'.repeat(20);
const otherHash = '0x' + 'ab'.repeat(32);
const word = n => '0x' + BigInt(n).toString(16).padStart(64, '0');

for (let i = 0; i < samples.length; i++) {
  test(`recorded mainnet sample ${i + 1} matches exact independent amount and fee`, () => {
    const expected = samples[i].source.sample;
    const result = interpret(fixture(i), { recipient: expected.recipient, amount: expected.amountUSDC });
    assert.equal(result.match, true);
    assert.equal(result.state, 'finalized');
    assert.equal(result.payments.length, 1);
    assert.equal(result.payments[0].amount, expected.amountUSDC);
    assert.equal(result.gas.usdc, expected.gasCostUSDC);
    assert.equal(result.checkedAt, '2026-10-04T00:00:00.000Z');
    assert.deepEqual(JSON.parse(JSON.stringify(result)).evidence, fixture(i));
  });
}
test('official ERC20/native paired events count as one payment', () => {
  const b = fixture(2);
  assert.equal(b.receipt.logs.filter(l => l.address === NETWORK.usdc || l.address === NETWORK.nativeEmitter).length, 2);
  const r = interpret(b);
  assert.equal(r.payments.length, 1);
  assert.equal(r.payments[0].raw, '97612000000000000');
  assert.equal(r.payments[0].decimals, 18);
});
test('ERC20-only evidence uses six decimals and matches the same human amount', () => {
  const b = fixture(2); b.receipt.logs = b.receipt.logs.filter(l => l.address === NETWORK.usdc);
  const r = interpret(b, { amount: '0.097612' });
  assert.equal(r.match, true); assert.equal(r.payments[0].decimals, 6); assert.equal(r.payments[0].raw, '97612');
});
test('native precision and uint256 amounts never round through Number', () => {
  assert.equal(parseAmount('0.000000000000000001'), 1n);
  assert.equal(parseAmount('9007199254740993.000000000000000001'), 9007199254740993000000000000000001n);
  assert.equal(formatUnits(9007199254740993000000000000000001n), '9007199254740993.000000000000000001');
  const b = fixture(1);
  assert.equal(interpret(b, { amount: '0.000002077894217161' }).match, true);
  assert.equal(interpret(b, { amount: '0.000002077894217162' }).match, false);
});
test('plain positive decimal input only; overprecision and overflow rejected', () => {
  for (const s of ['', '0', '-1', '1e3', 'NaN', 'Infinity', '.5', '1.', '1,000', '0.0000000000000000001', (2n ** 256n).toString()]) assert.throws(() => parseAmount(s), undefined, s);
  assert.equal(parseAmount(' 0001.230000 '), 1230000000000000000n);
});
test('hash and address normalization requires complete hexadecimal input', () => {
  assert.equal(validateHash(' 0x' + 'AB'.repeat(32) + ' '), otherHash);
  assert.equal(validateAddress('0x' + 'AB'.repeat(20)), otherAddress);
  for (const bad of [null, '0x', otherHash + '0', otherHash.replace('a', 'z')]) assert.throws(() => validateHash(bad));
});
test('recipient and amount constraints must match one transfer together', () => {
  const b = fixture(); const p = samples[0].source.sample;
  assert.equal(interpret(b, { recipient: otherAddress, amount: p.amountUSDC }).match, false);
  assert.equal(interpret(b, { recipient: p.recipient, amount: '1' }).match, false);
  assert.equal(interpret(b, { recipient: p.recipient }).match, true);
  assert.equal(interpret(b, { amount: p.amountUSDC }).match, true);
  assert.equal(interpret(b).match, null);
});
test('multiple transfers stay individual: neither sum nor cross-transfer matching', () => {
  const b = fixture(); const first = b.receipt.logs[0]; first.data = word(1000000000000000000n);
  const second = structuredClone(first); second.data = word(2000000000000000000n); second.logIndex = '0x1'; second.topics[2] = '0x' + '0'.repeat(24) + otherAddress.slice(2);
  b.receipt.logs.push(second);
  assert.equal(interpret(b, { amount: '3' }).match, false);
  assert.equal(interpret(b, { recipient: otherAddress, amount: '1' }).match, false);
  assert.equal(interpret(b, { recipient: otherAddress, amount: '2' }).match, true);
  assert.equal(interpret(b).payments.length, 2);
});
test('reverted transaction reports no payment despite attached transfer-looking data', () => {
  const b = fixture(); b.receipt.status = '0x0';
  const r = interpret(b, { amount: samples[0].source.sample.amountUSDC });
  assert.equal(r.state, 'reverted'); assert.equal(r.match, false); assert.deepEqual(r.payments, []); assert.ok(r.gas.usdc);
});
test('pending and nonexistent hashes never claim payment', () => {
  const b = fixture(); b.receipt = null; b.block = null; b.finalized = null;
  assert.equal(interpret(b).state, 'pending'); assert.deepEqual(interpret(b).payments, []);
  b.tx = null; assert.equal(interpret(b).state, 'not-found'); assert.equal(interpret(b).match, null);
});
test('missing or lagging finalized block is confirmed only', () => {
  const b = fixture(); b.finalized = null; assert.equal(interpret(b).state, 'confirmed');
  b.finalized = { hash: otherHash, number: '0x1' }; assert.equal(interpret(b).state, 'confirmed');
});
test('a wrong network is rejected even when the transaction is absent', () => {
  const b = fixture(); b.chainId = '0x1'; b.tx = null; assert.throws(() => interpret(b), /network/i);
});
for (const [name, change] of [
  ['transaction hash', b => b.tx.hash = otherHash],
  ['receipt hash', b => b.receipt.transactionHash = otherHash],
  ['receipt block hash', b => b.receipt.blockHash = otherHash],
  ['receipt block number', b => b.receipt.blockNumber = '0x1'],
  ['canonical block hash', b => b.block.hash = otherHash],
  ['canonical block number', b => b.block.number = '0x1'],
  ['receipt sender', b => b.receipt.from = otherAddress],
  ['receipt target', b => b.receipt.to = otherAddress],
  ['unknown status', b => b.receipt.status = '0x2'],
  ['malformed gas', b => b.receipt.gasUsed = '-1'],
  ['removed log', b => b.receipt.logs[0].removed = true],
  ['log transaction hash', b => b.receipt.logs[0].transactionHash = otherHash],
  ['log block hash', b => b.receipt.logs[0].blockHash = otherHash],
  ['short amount word', b => b.receipt.logs[0].data = '0x01'],
  ['bad indexed address padding', b => b.receipt.logs[0].topics[2] = '0x1' + '0'.repeat(63)],
]) test(`inconsistent evidence rejected: ${name}`, () => { const b = fixture(); change(b); assert.throws(() => interpret(b)); });

test('transaction chain ID mismatch is rejected', () => { const b = fixture(); b.tx.chainId = '0x1'; assert.throws(() => interpret(b)); });
test('finalized block at same height cannot disagree on block hash', () => {
  const b = fixture(); b.finalized = { ...b.block, hash: otherHash };
  assert.throws(() => interpret(b));
});
test('log block number mismatch is rejected', () => { const b = fixture(); b.receipt.logs[0].blockNumber = '0x1'; assert.throws(() => interpret(b)); });
test('log transaction index mismatch is rejected', () => { const b = fixture(); b.receipt.logs[0].transactionIndex = '0x9'; assert.throws(() => interpret(b)); });
test('duplicate log indices cannot manufacture a second transfer', () => {
  const b = fixture(); b.receipt.logs.push(structuredClone(b.receipt.logs[0])); assert.throws(() => interpret(b));
});
test('zero event and arbitrary token event do not become USDC payments', () => {
  const b = fixture(); b.tx.value = '0x0'; b.receipt.logs[0].data = word(0); assert.deepEqual(interpret(b).payments, []);
  b.receipt.logs[0].address = otherAddress; b.receipt.logs[0].data = word(999); assert.deepEqual(interpret(b).payments, []);
});
test('top-level native fallback requires positive value and empty calldata', () => {
  const b = fixture(); b.receipt.logs = []; const r = interpret(b); assert.equal(r.payments.length, 1); assert.equal(r.payments[0].amount, samples[0].source.sample.amountUSDC);
  b.tx.input = '0x1234'; assert.deepEqual(interpret(b).payments, []);
});

function mockRPC(bundle, overrides = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    assert.equal(url, NETWORK.rpc); assert.equal(options.method, 'POST');
    const request = JSON.parse(options.body); calls.push(request);
    const key = request.method === 'eth_getBlockByNumber' && request.params[0] === 'finalized' ? 'finalized' : request.method;
    if (Object.hasOwn(overrides, key)) return overrides[key](request);
    const result = { eth_chainId: bundle.chainId, eth_getTransactionByHash: bundle.tx, eth_getTransactionReceipt: bundle.receipt, eth_getBlockByNumber: bundle.block, finalized: bundle.finalized }[key];
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: request.id, result }) };
  };
  return { fetcher, calls };
}
test('end-to-end RPC orchestration exports raw evidence and confirmed results', async () => {
  const b = fixture(1); const { fetcher, calls } = mockRPC(b);
  const r = await verifyPayment(b.hash, { amount: '0.000002077894217161' }, fetcher);
  assert.equal(r.match, true); assert.equal(r.state, 'finalized'); assert.equal(calls.length, 5); assert.deepEqual(r.evidence.receipt, b.receipt);
});
test('bad inputs and wrong chain stop before unnecessary requests', async () => {
  const b = fixture(); b.chainId = '0x1'; const { fetcher, calls } = mockRPC(b);
  await assert.rejects(verifyPayment('bad', {}, fetcher)); assert.equal(calls.length, 0);
  await assert.rejects(verifyPayment(b.hash, {}, fetcher), /network/i); assert.equal(calls.length, 1);
});
test('finality RPC failure degrades to confirmed; essential RPC failure rejects', async () => {
  const b = fixture(); const fail = () => { throw new Error('offline'); };
  assert.equal((await verifyPayment(b.hash, {}, mockRPC(b, { finalized: fail }).fetcher)).state, 'confirmed');
  await assert.rejects(verifyPayment(b.hash, {}, mockRPC(b, { eth_getTransactionReceipt: fail }).fetcher), /offline/);
});
for (const [label, fetcher] of [
  ['HTTP failure', async () => ({ ok: false, status: 503 })],
  ['JSON-RPC error', async () => ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'server' } }) })],
  ['wrong response ID', async () => ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 9, result: '0x13b2' }) })],
  ['missing result', async () => ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 1 }) })],
  ['invalid JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } })],
  ['network failure', async () => { throw new TypeError('Failed to fetch'); }],
  ['timeout', async () => { throw new DOMException('Timed out', 'TimeoutError'); }],
]) test(`RPC rejects ${label}`, async () => { await assert.rejects(rpc('eth_chainId', [], fetcher)); });

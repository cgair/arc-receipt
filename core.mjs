export const NETWORK = Object.freeze({ name: 'Arc Mainnet', chainId: 5042, rpc: 'https://rpc.mainnet.arc.io', explorer: 'https://explorer.arc.io', usdc: '0x3600000000000000000000000000000000000000', nativeEmitter: '0xfffffffffffffffffffffffffffffffffffffffe' });
export const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const UINT = /^0x[0-9a-fA-F]+$/;
const ZERO = '0x0000000000000000000000000000000000000000';
function validateRecipient(value) { const address = validateAddress(value); if (address === ZERO) throw new Error('The zero address is a burn destination, not a payment recipient.'); return address; }
export function validateHash(value) { const s = String(value ?? '').trim(); if (!HASH.test(s)) throw new Error('Enter a transaction hash: 0x followed by 64 hexadecimal characters.'); return s.toLowerCase(); }
export function validateAddress(value) { const s = String(value ?? '').trim(); if (!ADDRESS.test(s)) throw new Error('Enter a valid 0x recipient address (40 hexadecimal characters).'); return s.toLowerCase(); }
export function parseAmount(value, decimals = 18) {
  const s = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(s) || s.length > 100) throw new Error('Enter a positive USDC amount using plain decimal digits.');
  const [whole, fraction = ''] = s.split('.');
  if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimal places.`);
  const n = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'));
  if (n <= 0n || n >= 2n ** 256n) throw new Error('Amount must be positive and within the supported range.');
  return n;
}
export function formatUnits(value, decimals = 18) { const n = BigInt(value); const base = 10n ** BigInt(decimals); const tail = (n % base).toString().padStart(decimals, '0').replace(/0+$/, ''); return `${n / base}${tail ? '.' + tail : ''}`; }
function uint(value, name) { if (typeof value !== 'string' || !UINT.test(value)) throw new Error(`RPC returned invalid ${name}.`); return BigInt(value); }
function topicAddress(topic) { if (!/^0x0{24}[0-9a-fA-F]{40}$/.test(topic)) throw new Error('RPC returned a malformed USDC transfer address.'); return '0x' + topic.slice(-40).toLowerCase(); }
export function interpret(bundle, expected = {}) {
  const hash = validateHash(bundle.hash);
  const recipient = expected.recipient?.trim() ? validateRecipient(expected.recipient) : null;
  const amount = expected.amount?.trim() ? parseAmount(expected.amount) : null;
  if (uint(bundle.chainId, 'chain ID') !== BigInt(NETWORK.chainId)) throw new Error('Wrong network. Arc mainnet (5042) is required.');
  const { tx, receipt, block, finalized } = bundle;
  if (!tx) return { state: 'not-found', hash, chainId: NETWORK.chainId, payments: [], match: null };
  if (validateHash(tx.hash) !== hash) throw new Error('RPC transaction hash does not match the request.');
  if (tx.chainId !== undefined && uint(tx.chainId, 'transaction chain ID') !== BigInt(NETWORK.chainId)) throw new Error('Transaction belongs to the wrong chain.');
  if (!receipt) return { state: 'pending', hash, chainId: NETWORK.chainId, payments: [], match: null };
  if (validateHash(receipt.transactionHash) !== hash || validateHash(tx.blockHash) !== validateHash(receipt.blockHash) || uint(tx.blockNumber, 'transaction block') !== uint(receipt.blockNumber, 'receipt block')) throw new Error('Transaction and receipt disagree. Retry with fresh chain data.');
  if (!block || validateHash(block.hash) !== validateHash(receipt.blockHash) || uint(block.number, 'block number') !== uint(receipt.blockNumber, 'receipt block')) throw new Error('Receipt is not in the current canonical block. Retry.');
  if (validateAddress(tx.from) !== validateAddress(receipt.from) || (tx.to || '').toLowerCase() !== (receipt.to || '').toLowerCase()) throw new Error('Transaction and receipt participants disagree.');
  const status = uint(receipt.status, 'receipt status');
  if (status !== 0n && status !== 1n) throw new Error('RPC returned an unknown receipt status.');
  const gasUsed = uint(receipt.gasUsed, 'gas used'); const gasPrice = uint(receipt.effectiveGasPrice, 'effective gas price');
  const gas = { gasUsed: gasUsed.toString(), effectiveGasPrice: gasPrice.toString(), raw: (gasUsed * gasPrice).toString(), decimals: 18, usdc: formatUnits(gasUsed * gasPrice) };
  const payments = [];
  if (status === 1n) {
    if (!Array.isArray(receipt.logs)) throw new Error('RPC returned missing receipt logs.');
    const official = receipt.logs.filter(log => [NETWORK.usdc, NETWORK.nativeEmitter].includes(log.address?.toLowerCase()) && log.topics?.[0]?.toLowerCase() === TRANSFER);
    const indices = new Set();
    for (const log of official) {
      const index = uint(log.logIndex, 'log index').toString();
      if (indices.has(index) || uint(log.blockNumber, 'log block') !== uint(receipt.blockNumber, 'receipt block') || uint(log.transactionIndex, 'log transaction index') !== uint(receipt.transactionIndex, 'receipt transaction index')) throw new Error('RPC returned inconsistent or duplicate transfer logs.');
      indices.add(index);
    }
    // Arc emits both ERC-20 (6 decimals) and native (18 decimals) events for
    // the same payment. Native events are authoritative at full precision.
    const native = official.filter(log => log.address.toLowerCase() === NETWORK.nativeEmitter);
    const selected = native.length ? native : official.filter(log => log.address.toLowerCase() === NETWORK.usdc);
    for (const log of selected) {
      if (log.removed || validateHash(log.transactionHash) !== hash || validateHash(log.blockHash) !== validateHash(block.hash) || log.topics.length !== 3 || !/^0x[0-9a-fA-F]{64}$/.test(log.data)) throw new Error('RPC returned inconsistent USDC transfer evidence.');
      const decimals = log.address.toLowerCase() === NETWORK.usdc ? 6 : 18;
      const raw = uint(log.data, 'transfer amount');
      if (raw === 0n) continue;
      const from = topicAddress(log.topics[1]), to = topicAddress(log.topics[2]);
      if (to === ZERO) continue; // Arc uses a zero-address destination for burns.
      payments.push({ from, to, kind: from === ZERO ? 'mint' : 'transfer', raw: raw.toString(), decimals, amount: formatUnits(raw, decimals), source: from === ZERO ? 'USDC mint event' : decimals === 6 ? 'USDC ERC-20 event' : 'Native USDC event', logIndex: uint(log.logIndex, 'log index').toString(), emitter: log.address.toLowerCase() });
    }
    // Do not guess internal transfers when a receipt contains no supported
    // event. An ordinary top-level send is the only safe fallback.
    if (!selected.length && tx.to && tx.to.toLowerCase() !== ZERO && tx.input === '0x' && uint(tx.value, 'transaction value') > 0n) payments.push({ from: validateAddress(tx.from), to: validateAddress(tx.to), kind: 'transfer', raw: BigInt(tx.value).toString(), decimals: 18, amount: formatUnits(tx.value), source: 'Top-level native transfer', logIndex: null, emitter: null });
  }
  const matching = payments.filter(p => (!recipient || p.to === recipient) && (amount === null || BigInt(p.raw) * 10n ** BigInt(18 - p.decimals) === amount));
  let isFinal = false;
  if (finalized) {
    validateHash(finalized.hash);
    const finalHeight = uint(finalized.number, 'finalized block'), height = uint(block.number, 'block number');
    if (finalHeight === height && finalized.hash.toLowerCase() !== block.hash.toLowerCase()) throw new Error('Finalized block conflicts with the transaction block. Retry.');
    isFinal = finalHeight >= height;
  }
  return { schema: 'arc-receipt/v1', chainId: NETWORK.chainId, network: NETWORK.name, rpc: NETWORK.rpc, hash, state: status === 0n ? 'reverted' : isFinal ? 'finalized' : 'confirmed', blockNumber: uint(block.number, 'block number').toString(), blockHash: block.hash, timestamp: new Date(Number(uint(block.timestamp, 'block timestamp')) * 1000).toISOString(), checkedAt: bundle.checkedAt || new Date().toISOString(), payments, gas, expected: { recipient, amount: amount === null ? null : formatUnits(amount) }, match: recipient || amount !== null ? status === 1n && matching.length > 0 : null, matchingTransfers: matching.length, explorer: `${NETWORK.explorer}/tx/${hash}`, evidence: bundle, limitations: ['Data is checked against the public RPC, not an independent cryptographic proof.', 'Checks individual positive transfer events, not net balance changes or invoice uniqueness.', 'Internal native transfers without supported events are not inferred.'] };
}
export async function rpc(method, params, fetcher = fetch) {
  const response = await fetcher(NETWORK.rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Arc RPC unavailable (HTTP ${response.status}). Please retry.`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Arc RPC could not complete ${method}. Please retry.`);
  if (payload.jsonrpc !== '2.0' || payload.id !== 1 || !Object.hasOwn(payload, 'result')) throw new Error('Arc RPC returned an invalid response.');
  return payload.result;
}
export async function verifyPayment(hashInput, expected = {}, fetcher = fetch) {
  const hash = validateHash(hashInput);
  if (expected.recipient?.trim()) validateRecipient(expected.recipient);
  if (expected.amount?.trim()) parseAmount(expected.amount);
  const chainId = await rpc('eth_chainId', [], fetcher);
  if (uint(chainId, 'chain ID') !== BigInt(NETWORK.chainId)) throw new Error('Wrong network. Arc mainnet (5042) is required.');
  const [tx, receipt] = await Promise.all([rpc('eth_getTransactionByHash', [hash], fetcher), rpc('eth_getTransactionReceipt', [hash], fetcher)]);
  let block = null, finalized = null;
  if (receipt) {
    [block, finalized] = await Promise.all([rpc('eth_getBlockByNumber', [receipt.blockNumber, false], fetcher), rpc('eth_getBlockByNumber', ['finalized', false], fetcher).catch(() => null)]);
  }
  return interpret({ hash, chainId, tx, receipt, block, finalized, checkedAt: new Date().toISOString() }, expected);
}

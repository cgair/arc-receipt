import { verifyPayment } from './core.mjs';
const $ = id => document.getElementById(id);
let current = null, requestVersion = 0;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function notice(title, detail, error = false) { $('result').innerHTML = `<div class="notice ${error ? 'error' : ''}" role="${error ? 'alert' : 'status'}"><h3>${escape(title)}</h3><p>${escape(detail)}</p></div>`; }
function render(result) {
  if (result.state === 'not-found') return notice('Transaction not found', 'This hash is not available on Arc mainnet. Check the network and hash, or retry if it was just submitted.');
  if (result.state === 'pending') return notice('Awaiting a receipt', 'The transaction is known but has no mined receipt yet. No payment is confirmed. Retry shortly.');
  const bad = result.state === 'reverted' || result.match === false;
  const label = result.state === 'reverted' ? 'Transaction reverted' : result.match === false ? 'Payment does not match' : result.match === true ? 'Payment matched' : result.payments.length ? 'USDC transfers found' : 'No supported USDC transfer';
  const message = result.state === 'reverted' ? 'Execution failed. No successful payment is reported; the network fee may still apply.' : result.match === false ? 'No individual transfer matches the expected recipient and amount you provided.' : result.match === true ? 'An individual transfer matches your expected payment.' : 'Add an expected recipient and amount to check a specific payment.';
  $('result').innerHTML = `<div class="result-content"><span class="status ${bad ? 'bad' : result.state !== 'finalized' || !result.payments.length ? 'warn' : ''}">${escape(result.state === 'finalized' ? 'Finalized on Arc mainnet' : result.state === 'reverted' ? 'Reverted on Arc mainnet' : 'Confirmed · finality not verified')}</span><h3 class="receipt-title">${escape(label)}</h3><p>${escape(message)}</p>${result.payments.map(p => `<article class="transfer"><div class="transfer-amount">${escape(p.amount)} <span>USDC</span></div><dl><dt>From</dt><dd class="address">${escape(p.from)}</dd><dt>To</dt><dd class="address">${escape(p.to)}</dd></dl><div class="source">${escape(p.source)}${p.logIndex === null ? '' : ' · event ' + escape(p.logIndex)}</div></article>`).join('')}<dl class="meta"><dt>Network fee</dt><dd>${escape(result.gas.usdc)} USDC</dd><dt>Block</dt><dd>${escape(result.blockNumber)}</dd><dt>Block time</dt><dd>${escape(result.timestamp.replace('T', ' ').replace('.000Z', ' UTC'))}</dd><dt>Transaction</dt><dd class="address">${escape(result.hash)}</dd></dl><div class="actions"><button id="download" type="button">Export receipt JSON</button><a href="${escape(result.explorer)}" target="_blank" rel="noopener noreferrer">View on explorer</a></div><p class="hint">Verified against the public RPC. Transfer amounts are not a net balance statement.</p></div>`;
  $('download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(current, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `arc-receipt-${current.hash.slice(0, 12)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
async function run(input) {
  const version = ++requestVersion; current = null;
  $('verify').disabled = true; $('example').disabled = true;
  notice('Checking Arc mainnet…', 'Reading the transaction, receipt and canonical block.');
  try {
    const result = await verifyPayment(input.hash, { recipient: input.recipient, amount: input.amount });
    if (version !== requestVersion) return { superseded: true };
    current = result; render(result);
    return { state: result.state, match: result.match, hash: result.hash, payments: result.payments, gas: result.gas };
  } catch (error) {
    if (version === requestVersion) notice('Unable to verify', error.name === 'TimeoutError' ? 'The Arc RPC timed out. Please retry.' : error.message, true);
    throw error;
  } finally { if (version === requestVersion) { $('verify').disabled = false; $('example').disabled = false; } }
}
$('verify-form').addEventListener('submit', event => { event.preventDefault(); run({ hash: $('hash').value, recipient: $('recipient').value, amount: $('amount').value }).catch(() => {}); });
// Clear a prior receipt when its inputs change so exports cannot silently
// refer to a different recipient or amount than the form now shows.
for (const id of ['hash', 'recipient', 'amount']) $(id).addEventListener('input', () => { requestVersion++; current = null; $('verify').disabled = false; $('example').disabled = false; notice('Ready to verify', 'Your inputs changed. Verify again to create a matching receipt.'); });
$('example').addEventListener('click', async () => {
  const version = ++requestVersion; current = null;
  $('verify').disabled = true; $('example').disabled = true;
  notice('Loading a public example…', 'This is an existing third-party payment, read live from Arc mainnet.');
  let handedOff = false;
  try {
    const response = await fetch('./example.json', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Example is temporarily unavailable.');
    const sample = await response.json();
    if (version !== requestVersion) return;
    $('hash').value = sample.hash; $('recipient').value = sample.recipient; $('amount').value = sample.amount;
    handedOff = true; await run(sample).catch(() => {});
  } catch (error) { if (version === requestVersion) notice('Unable to load example', error.message, true); }
  finally { if (!handedOff && version === requestVersion) { $('verify').disabled = false; $('example').disabled = false; } }
});
if (document.modelContext?.registerTool) {
  try { Promise.resolve(document.modelContext.registerTool({ name: 'verify_arc_usdc_payment', title: 'Verify Arc USDC payment', description: 'Read Arc mainnet payment evidence and display the receipt. Does not send transactions.', inputSchema: { type: 'object', properties: { hash: { type: 'string' }, recipient: { type: 'string' }, amount: { type: 'string' } }, required: ['hash'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: async input => { if (!input || typeof input.hash !== 'string' || (input.recipient !== undefined && typeof input.recipient !== 'string') || (input.amount !== undefined && typeof input.amount !== 'string')) throw new Error('Invalid payment query.'); $('hash').value = input.hash; $('recipient').value = input.recipient || ''; $('amount').value = input.amount || ''; return run(input); } })).catch(() => {}); } catch { /* The ordinary form works without experimental browser APIs. */ }
}

# Independent self-test report

Date: 2026-10-04 (Asia/Shanghai). Reviewer: delegated self-test agent; production files were not edited by this reviewer.

Result: **61 tests passed, 0 failed, 0 skipped**. `npm run check` also passed. Run the repeatable offline suite with `npm test`.

Runtime: Node v22.23.2. Reviewed source SHA-256 values:

```text
6d29964288a5c174e1a0d03a904a3c7637c6e0cd6689a1b1844fbc0ea67828f5  dist/core.mjs
13d1255636a649638074e62f97efabeb22f37a4a2f42190025366122141b7365  dist/app.mjs
```

## Scope and evidence

`tests/core.test.mjs` contains 53 tests. Three recorded, unrelated Arc mainnet transactions in `evidence/` supply real transaction/receipt/block shapes and independently recorded expected payment amounts and fees. Additional intentionally modified fixtures exercise rejection and boundary behavior. The suite makes no network requests and does not claim to have sent the example transactions.

Covered behaviors:

- Native USDC at 18 decimals, ERC-20 USDC at 6 decimals, and the official native/ERC-20 dual-log payment counted once.
- Sub-micro-USDC precision, values above JavaScript's safe integer range, exact matching, invalid inputs and uint256 overflow.
- Recipient-only, amount-only and combined constraints; multiple transfers cannot be summed or combined to satisfy one expected payment.
- Failed execution, pending receipts, absent transactions, confirmed versus finalized blocks, and gas accounting on failed transactions.
- Wrong chain, inconsistent transaction/receipt/canonical-block identities, malformed supported logs, removed logs, conflicting finality, duplicate event indices, and participant mismatches.
- Unsupported token events, zero transfers and conservative top-level native fallback.
- Native and ERC-20 burns are excluded; zero expected recipients fail before RPC access; eventless sends to zero cannot use the native fallback. Mixed burn/payment receipts retain only the ordinary payment. Mints to real recipients remain matchable and are explicitly labeled as mints.
- RPC request orchestration; HTTP, network, timeout, JSON and JSON-RPC failures; finality-only failure safely downgrades the status to confirmed.
- JSON serialization preserves raw evidence and exact decimal strings.

`tests/ui.test.mjs` contains 8 tests. It executes the actual `app.mjs` controller in a Node VM with a small DOM boundary and controlled asynchronous dependencies. It covers reverse-order responses, edits during verification, stale example responses and errors, example verification errors, exact JSON export, object URL cleanup, escaped error text and absence of export for unconfirmed results.

## Findings and closure

Initial source review identified these defects, reported them to the implementation agent, and added regression tests after that agent fixed the production code:

1. A transaction with a chain ID inconsistent with the Arc RPC chain ID was accepted.
2. A finalized block at the transaction's height but with a different block hash could be labeled finalized.
3. Supported logs with inconsistent block numbers or transaction indices, or repeated log indices, were accepted.
4. A delayed example fetch or error could overwrite newer input or a newer successful verification.

All associated regression tests pass on the reviewed revision. No remaining blocker was found within this test scope.

Follow-up acceptance review identified that burns to the zero address must not be treated as payments. After the implementation agent fixed this, seven additional burn/mint regression tests were added and the complete 61-test suite rerun successfully. Both native and ERC-20 paths, mixed receipts, expected-recipient validation and the eventless native fallback are covered.

## Limits

This is deterministic logic and controller testing, not a browser layout, accessibility or deployment acceptance test. Actual browser operation, mobile layout, live RPC/CORS and public deployment must be checked by the separate acceptance agent. Public RPC evidence is not an independently verified cryptographic proof. The app tests individual positive transfers; invoice uniqueness, net balances and internal transfers without supported events are outside scope. Tests verify the recorded native-authoritative dual-log behavior; they are not an exhaustive proof of every possible Arc protocol event combination.

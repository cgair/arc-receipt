# Independent acceptance review

Reviewer: acceptance subagent, separate from implementation and self-test authors.
Review date: 2026-10-04 Asia/Shanghai (2026-10-03 UTC).

## Current verdict

Source review and independent live-RPC checks pass, subject to closing the burn-event finding below. Public browser/deployment acceptance is pending and is not implied by passing unit tests.

## Independent checks completed

- Read `dist/core.mjs`, `dist/app.mjs`, `dist/index.html`, styling, README, submission copy and recorded evidence.
- Re-ran `npm test`: 54 tests passed, zero failures at the initial review.
- Read official [connection configuration](https://docs.arc.io/arc/references/connect-to-arc.md) and [USDC system events](https://docs.arc.io/arc/references/usdc-system-events.md). Confirmed mainnet chain ID 5042, RPC `https://rpc.mainnet.arc.io`, native emitter/address precision, ERC-20 emitter/address precision and gas calculation. Official documentation says the native emitter covers every explicit USDC transfer and mainnet has used it since genesis, supporting native-event precedence without dual counting.
- Independently called the live mainnet RPC through `verifyPayment` for all three recorded examples. Each returned finalized with the exact recipient, amount and expected fee. Results are recorded in [acceptance-live-rpc.json](../evidence/acceptance-live-rpc.json).
- Checked integer-only amount comparison, canonical block/receipt agreement, chain validation, reverted/pending/not-found handling, arbitrary-token exclusion, gas separation, finality fallback, current-input/export consistency and UI escaping.

| Mainnet example | Amount (USDC) | Fee (USDC) | Live outcome |
| --- | --- | --- | --- |
| `0x1ecf8bdb…442ba352` | 0.979243999748 | 0.00063000021 | Finalized, exact match |
| `0x18847a43…7c31b2b` | 0.000002077894217161 | 0.0005250002625 | Finalized, exact match |
| `0xd2595af2…ef1affc8` | 0.097612 | 0.0023778011889 | Finalized, exact match; dual events counted once |

## Finding requiring closure

The initial implementation includes official burn events (`Transfer` to the zero address) in its payment list. An expected zero-address recipient can therefore produce “Payment matched” for a burn. The official Arc reference explicitly identifies that event as a burn. Requested correction: exclude or clearly classify burns so they never satisfy received-payment matching, reject a zero expected recipient, and add regression coverage. Mint events to a normal address may be shown but should be identified as minting rather than an ordinary payment.

## Eligibility and evidence honesty

This is an infrastructure/tiny-app candidate that integrates existing Arc mainnet infrastructure. It deploys no new contract and sends no transactions. The examples are disclosed as public third-party transactions, not transactions made by this project. Existing MergeSplit Sepolia work is not presented as Arc deployment evidence.

The README and submission copy appropriately describe public-RPC reconciliation rather than independent cryptographic proof, and disclose limitations concerning invoice uniqueness, net balance changes and unsupported internal transfers. A working public web deployment, a public source repository and a public builder profile remain necessary submission evidence. Only the organizer can decide whether its “live deployment on Arc mainnet” criterion accepts this read-only infrastructure application; this review does not assert organizer pre-approval or grant selection.

## Browser acceptance

Pending public deployment handoff. Required checks: real mainnet example, invalid hash, wrong recipient/amount, export contents, responsive layout and accessible public repository.

# Independent acceptance review

Reviewer: acceptance subagent, separate from implementation and self-test authors.
Review date: 2026-10-04 Asia/Shanghai (2026-10-03 UTC).

## Current verdict

**Pass for submission.** Source review, independent live-RPC checks, regression tests and the public GitHub Pages browser flow passed. The burn-event finding was fixed and independently rechecked. This is technical acceptance of the submitted application, not an assertion of grant eligibility or selection.

Accepted public application: <https://cgair.github.io/arc-receipt/>.
Accepted public source repository: <https://github.com/cgair/arc-receipt>.

## Independent checks completed

- Read `dist/core.mjs`, `dist/app.mjs`, `dist/index.html`, styling, README, submission copy and recorded evidence.
- Re-ran `npm test`: 54 tests passed at initial review; **61 tests passed, zero failures** after the burn/mint corrections. `npm run check` also passed.
- Read official [connection configuration](https://docs.arc.io/arc/references/connect-to-arc.md) and [USDC system events](https://docs.arc.io/arc/references/usdc-system-events.md). Confirmed mainnet chain ID 5042, RPC `https://rpc.mainnet.arc.io`, native emitter/address precision, ERC-20 emitter/address precision and gas calculation. Official documentation says the native emitter covers every explicit USDC transfer and mainnet has used it since genesis, supporting native-event precedence without dual counting.
- Independently called the live mainnet RPC through `verifyPayment` for all three recorded examples. Each returned finalized with the exact recipient, amount and expected fee. Results are recorded in [acceptance-live-rpc.json](../evidence/acceptance-live-rpc.json).
- Checked integer-only amount comparison, canonical block/receipt agreement, chain validation, reverted/pending/not-found handling, arbitrary-token exclusion, gas separation, finality fallback, current-input/export consistency and UI escaping.

| Mainnet example | Amount (USDC) | Fee (USDC) | Live outcome |
| --- | --- | --- | --- |
| `0x1ecf8bdb…442ba352` | 0.979243999748 | 0.00063000021 | Finalized, exact match |
| `0x18847a43…7c31b2b` | 0.000002077894217161 | 0.0005250002625 | Finalized, exact match |
| `0xd2595af2…ef1affc8` | 0.097612 | 0.0023778011889 | Finalized, exact match; dual events counted once |

## Finding closed

The initial implementation included official burn events (`Transfer` to the zero address) in its payment list, allowing “Payment matched” for a burn. The implementation now rejects an expected zero recipient, excludes burns from payments and excludes a zero-address native fallback. Mints to normal addresses carry `kind: mint` and a visible `USDC mint event` source. Source inspection and the added regression tests independently confirmed the correction.

## Eligibility and evidence honesty

This is an infrastructure/tiny-app candidate that integrates existing Arc mainnet infrastructure. It deploys no new contract and sends no transactions. The examples are disclosed as public third-party transactions, not transactions made by this project. Existing MergeSplit Sepolia work is not presented as Arc deployment evidence.

The README and submission copy appropriately describe public-RPC reconciliation rather than independent cryptographic proof, and disclose limitations concerning invoice uniqueness, net balance changes and unsupported internal transfers. The working public deployment and source repository were independently verified, and the application links the public builder profile. Only the organizer can decide whether its “live deployment on Arc mainnet” criterion accepts this read-only infrastructure application; this review does not assert organizer pre-approval or grant selection.

## Browser acceptance

Used the user's existing Chrome via Chrome DevTools MCP, with the task page brought to the foreground. No wallet connection or signature was needed.

| Check | Environment | Result |
| --- | --- | --- |
| Real mainnet example | Local desktop; public mobile | Finalized, exact payment match; correct amount, recipient, fee and block |
| Wrong expected amount | Local desktop; public mobile | “Payment does not match”; never reports matched |
| Wrong expected recipient | Local desktop | “Payment does not match” |
| Invalid short transaction hash | Local desktop | Clear validation error; no export offered |
| Edit a previously verified input | Local desktop | Prior receipt/export disappears until verification runs again |
| Actual export-button click | Local desktop; public mobile | Download Blob JSON checked against visible receipt and original RPC receipt hash |
| 390 × 844 mobile layout | Local and public | Single column, viewport and document width both 390; no horizontal page overflow; 45 px buttons |
| Desktop layout | Local visual screenshot; public layout measurements | Readable two-column local layout; public 1440 px viewport/document with no horizontal overflow |
| Anonymous deployed assets | Public HTTP, without cookies or credentials | All five assets HTTP 200 and byte-identical to reviewed `dist/` |
| Public repository | Anonymous GitHub API | `private: false` |

For the public export, the checked values were chain 5042, transaction `0x1ecf8bdbb1d4c19aaa11e62a41c34c0bbe2a1bc6f18f0f791b9d230e442ba352`, exact amount `0.979243999748`, raw amount `979243999748000000`, fee `0.00063000021`, `match: true`, matching expected recipient/amount, and the identical underlying receipt transaction hash. The export was inspected through the actual generated download Blob; a separate filesystem download artifact was not audited.

Desktop and mobile screenshots were visually inspected inline. The broader pending/reverted/network-error, response-race and zero-address scenarios were covered by the independently rerun automated suite, not fabricated as live chain transactions. Experimental WebMCP registration was not separately accepted; ordinary browser form behavior is the supported acceptance path.

The first Sites address, `https://arc-receipt.chengeair23.chatgpt.site/`, returned a Cloudflare block page in Chrome and HTTP 403 anonymously. No bypass was attempted. The independently working GitHub Pages deployment above is the accepted submission entrypoint.

The Chrome task page was left open on the public application and control returned to the submission agent. Acceptance review did not submit the grant application.

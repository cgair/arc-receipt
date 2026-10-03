## ArcReceipt — verify a USDC payment on Arc

**Live app:** https://cgair.github.io/arc-receipt/
**Public source:** https://github.com/cgair/arc-receipt
**Builder:** https://github.com/cgair

ArcReceipt helps contributors, grant recipients and payment operators answer a practical question: did this exact recipient receive this exact amount of USDC?

Paste an Arc mainnet transaction hash, optionally enter the expected recipient and amount, and verify. The app reads live transaction, receipt and canonical-block data from Arc's public RPC (chain ID 5042). It requires no login, wallet connection, signature or funds.

### Try it immediately
Open the live app and select **Try a real mainnet payment**. It retrieves a public third-party transaction live, verifies its recipient and 0.979243999748 USDC amount, displays the separate network fee, and lets you export the underlying evidence as JSON. Change the expected amount to see an explicit mismatch.

### Why this is built for Arc
USDC is both the native gas asset and an ERC-20 interface on Arc. Native amounts use 18 decimals; the ERC-20 interface uses 6. A payment can emit both representations. ArcReceipt filters official emitters, preserves integer precision and avoids counting the same payment twice. Gas is calculated separately from gasUsed and effectiveGasPrice. Burns are excluded, and mint events are labeled.

### Working features
- Exact recipient and individual-transfer amount matching.
- Transaction, receipt and canonical-block consistency checks.
- Finality checked against the RPC's finalized block.
- Explicit reverted, pending, missing and RPC-error states.
- JSON receipts containing raw evidence, check time, chain/block identity and fee inputs.
- Responsive desktop/mobile interface with no backend or payment-history storage.

### Verification
A separate self-test agent produced 61 passing regression tests. A separate acceptance agent independently checked three real mainnet transactions, anonymous public access, desktop/mobile rendering, mismatches and the actual JSON export. Reports and reproducible evidence are in the public repository:
- https://github.com/cgair/arc-receipt/blob/main/docs/SELFTEST.md
- https://github.com/cgair/arc-receipt/blob/main/docs/ACCEPTANCE.md

### Deployment and scope
This is a working read-only infrastructure application using existing Arc mainnet infrastructure. It deploys no new smart contract and holds no funds. Example transactions are public third-party payments, not payments made by this project.

Verification trusts the public RPC; it is not an independent cryptographic proof. It checks individual transfers, not net balance changes or invoice uniqueness. Internal native transfers without supported events are not inferred. These limits are visible in the app.

Built by cgair. MIT licensed. This newly created project has received no Circle or Arc program funding.

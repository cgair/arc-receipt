# ArcReceipt — Arc Microgrants submission

Status: implementation, independent self-test, independent acceptance and public deployment complete. DoraHacks Profile, Details and Team steps filled and saved on 2026-10-04. Final submission is pending explicit approval to provide required private contact identifiers to DoraHacks staff; automatic approval review blocked that contact step. No submission-success confirmation has been observed.

The existing Chrome form remains open at the Contact step of Arc Microgrants. Continue that draft rather than creating a duplicate Build. Public project copy is preserved in [DORAHACKS-DESCRIPTION.md](DORAHACKS-DESCRIPTION.md). Private contact values are intentionally not stored in this public repository.

## Vision

Make USDC payments on Arc easy to reconcile: check the exact recipient and amount, distinguish finality from execution success, and export a transparent receipt without connecting a wallet.

## Description

ArcReceipt is a small, open-source payment verification tool running against Arc mainnet. It helps contributors, grant recipients and payment operators turn a transaction hash into a useful USDC receipt.

Paste a mainnet hash, optionally enter the expected recipient and amount, and verify. ArcReceipt reads the transaction, receipt and canonical block directly from Arc's public RPC, checks chain ID 5042 and reports success, reversal, pending or missing data accurately. A one-click real mainnet example makes the application immediately usable without a wallet or funds.

### Why Arc-specific handling matters

USDC is both the native gas asset and an ERC-20 interface on Arc. Native amounts have 18 decimals while the ERC-20 interface has 6. A transfer can emit both representations. ArcReceipt preserves exact integer precision, filters the official emitters and avoids double-counting that payment. Gas remains a separate USDC line item.

### Working functionality

- Live Arc mainnet transaction lookup and canonical-block checks.
- Exact recipient and individual-transfer amount matching.
- Explicit reverted, pending, missing and RPC-error states.
- Finality checked against the RPC's finalized block.
- JSON receipt containing the underlying chain evidence and fee calculation inputs.
- Responsive, accessible browser interface; no login, wallet connection or signature.

### Deployment and evidence

The application uses existing Arc mainnet infrastructure; it does not deploy a new contract or hold user funds. Public mainnet examples include native transfers at full 18-decimal precision and an ERC-20 transfer with both system logs. These are third-party public transactions, not payments made by ArcReceipt. The repository includes raw RPC evidence and independent regression tests.

Verification trusts the public RPC and is not an independent cryptographic proof. It does not establish invoice uniqueness or net balance changes, and does not infer internal native transfers without supported events. These limits are visible in the application.

### Builder

Solo builder: cgair — https://github.com/cgair

Repository: https://github.com/cgair/arc-receipt

Live application: https://cgair.github.io/arc-receipt/

Funding history: this newly created project has received no Circle or Arc program funding.

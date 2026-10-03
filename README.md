# ArcReceipt

Verify a USDC payment on **Arc mainnet (chain 5042)** and export its evidence as JSON. An independent, non-custodial tool for contributors, grant recipients and payment operators who need to answer: did this exact recipient receive this exact amount?

The app queries the public mainnet RPC directly from the browser. No wallet connection, account, private key, transaction signing or backend database is required.

## Run locally

Requires Node.js 22+ for tests and Python 3 for the local server. No npm packages are needed.

```sh
npm test
npm run check
npm run serve
```

Open http://localhost:4173 and choose **Try a real mainnet payment**. This queries a real, public third-party transaction live; it is not a payment created by this project. You can replace the hash, expected recipient and expected amount to verify your own payment.

## What is checked

- RPC chain ID is 5042; a returned transaction chain ID must also match.
- Transaction, receipt and canonical block hashes/heights agree.
- Reverted, missing and pending transactions never count as successful payments.
- Transfer events are accepted only from Arc's official USDC / native system emitters.
- Native USDC uses 18 decimals; the ERC-20 interface uses 6. Integer arithmetic preserves precision.
- Arc's dual Transfer events are not added together. Native events retain full precision and take precedence over their ERC-20 representation.
- A recipient/amount query must match an individual positive transfer exactly; unrelated transfers are not combined to satisfy it.
- Zero-address burns are excluded; mint events to real recipients are explicitly labeled.
- Gas is shown separately as `gasUsed × effectiveGasPrice / 10^18` USDC.
- Finality is reported only when a finalized block is available and covers the transaction.

The JSON export includes raw RPC evidence, expected values, interpreted transfers, fee inputs, block hash/height, check time and source. See [evidence/mainnet-samples.json](evidence/mainnet-samples.json) for three independently collected, public mainnet examples including sub-micro-USDC native precision and dual-emitter ERC-20 behavior.

## Scope and trust

This is **public-RPC reconciliation, not an independent cryptographic proof**. It does not establish invoice uniqueness, sender identity, ownership, tax treatment or a recipient's net balance change. A contract may forward funds onward in the same transaction. Users should inspect all transfers and the explorer where that distinction matters.

Supported coverage: official USDC/native Transfer events and ordinary top-level native sends. Internal native transfers without supported events are not inferred. No new smart contract is deployed by this project. The working application integrates existing Arc mainnet infrastructure. The grant organizer determines whether this infrastructure application qualifies for its program.

Inputs are sent to Arc's public RPC. The app stores no payment history, uses no analytics and requests no wallet access. Static hosting providers may keep ordinary access logs. Downloaded evidence is public blockchain information and is only as trustworthy as the queried RPC and this implementation.

## Official configuration sources

- [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc.md)
- [USDC system events](https://docs.arc.io/arc/references/usdc-system-events.md)
- [EVM differences and decimal precision](https://docs.arc.io/arc/references/evm-differences.md)
- [Contract addresses](https://docs.arc.io/arc/references/contract-addresses.md)

RPC: `https://rpc.mainnet.arc.io` · Explorer: `https://explorer.arc.io`

USDC ERC-20: `0x3600000000000000000000000000000000000000`

Native transfer emitter: `0xfffffffffffffffffffffffffffffffffffffffe`

## Architecture

`dist/core.mjs` owns integer arithmetic, input validation, RPC reads and evidence interpretation. `dist/app.mjs` renders that result and exports exactly the displayed evidence. Static HTML/CSS supplies the accessible, responsive interface. `tests/` contains independent regression tests. Experimental WebMCP support is feature-detected; the ordinary form is always available.

## License

MIT. Built by [cgair](https://github.com/cgair).

The goal of the e2e tests is to verify that the most critical flows are working at all times. 

## Setup

- [x] Spin Postgres and Redis in Testcointainers; healthcheck passes.
- [x] Run Drizzle migrations; schema version matches head
- [x] Seed fixtures (1 user; 1 mcp server with pricing)
- [x] Initiate test MCP server (fake) with the vercel handler
- [ ] Initiate test MCP server (fake) with the MCPay handler
- [ ] (optional) make CDP testing optional with test project credentials (to create CDP accounts); needs to fund accounts???

## Auth and Account Creation

- [ ] (Optional) GitHub OAuth creates user; session cookie set
- [ ] CDP managed wallet auto-create hook runs; wallet address stored
- [ ] Extra fields preserved: wallet address, display name, avatar URL
- [ ] API keys: create -> list -> delete via /api/
- [x] Create user with email and password
- [ ] 
- [ ] 
- [ ] 

## Wallet Management 

- [ ] Add external wallet
- [ ] Set primary; invariant "exactly one primary" holds after add/remove
- [ ] Remove wallet; primary reasign rules respected
- [ ] Managed wallet ensure list; created if missing
- [ ] Fetch balances: include testnet + mainnet
- [ ] faucet (testnet): balance increases >= min request
- [ ] Networks list includes testnet (base sepolia, sei testnet) and mainnet (base, sei) 
- [ ] /api/wallets/:walletAddress/user reverse lookup works
- [ ] 
- [ ] 
- [ ] 
- [ ] 
- [ ] 
- [ ] 
- [ ] 
- [ ] 
- [ ] 
- [ ] 
- [ ] 

## Payment Strategies

- [ ] Strategy priority respected: CDP > (Privy/Magic disabled unless opt-in) > manual.
- [ ] Primary strategy disabled → fallback adopted, logged.
- [ ] Missing headers → manual 402.
- [ ] Smart account toggles honored when enabled.
- [ ] Timeouts/retries configurable; observe logs/state
- [ ] Audit logs contain chosen strategy per call.

## Analytics & Reputation (AN)
* [AN1] /api/analytics/usage aggregates by day/tool/user; matches event stream.
* [AN2] Server reputation increases on successful payments; decreases on failures.
* [AN3] Reputation unaffected by 402 (pre-pay) but affected by payment errors.
* [AN4] Pagination and date filters work.


## Discovery & Ping (D)
* [D1] POST /ping upserts by mcpOrigin; second POST mutates metadata not identity.
* [D2] Bad pricing annotations → 400 with reason list.
* [D3] First-hit discovery recorded (timestamp, origin).
* [D4] GET /ping liveness reports latest metadata.
* [D5] Idempotency on repeated POSTs (same payload) → single row.


## JS SDK

## Third-parties

### CDP (server wallets, onramp)

#### Onramp (CDP) (O)
* [O1] POST /onramp/buy-url encodes {network, asset, amount, recipient}; override params honored.
* [O2] GET /onramp/config returns available providers + assets.
* [O3] LIVE_CDP path returns functional URL; mocked path returns deterministic sandbox URL.
* [O4] Input validation: reject negative/zero amount; unsupported asset/network.

### vlayer

Proofs & Ledger (L)
* [L1] POST /api/proofs creates proof; fields include facilitator signature details.
* [L2] GET /api/proofs/:id returns exact stored fields.
* [L3] Verify endpoint returns valid=true for good proof; false for tampered.
* [L4] List/filter scopes by tool/server/user work.
* [L5] /api/proofs/stats totals match successful paid invocations (count/sum).
* [L6] Negative tests: invalid signature, wrong network/asset, stale nonce.

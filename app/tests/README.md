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
- [ ] Create user with email and password
- [ ] 
- [ ] 
- [ ] 

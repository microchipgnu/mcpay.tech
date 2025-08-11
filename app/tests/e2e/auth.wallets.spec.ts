import { test as infra, expect } from './fixtures/infra';

const test = infra.extend({});

function buildCookieHeaderFromSetCookie(setCookieHeaders: string[]): string {
  const pairs: string[] = [];
  for (const header of setCookieHeaders) {
    const first = header.split(';')[0];
    if (first && first.includes('=')) pairs.push(first);
  }
  return pairs.join('; ');
}

test('email+password signup -> signin -> get-session returns user', async ({ request }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'Passw0rd!234';
  const name = 'E2E User';

  // Sign up (Better Auth: POST /api/auth/sign-up/email)
  const signUpRes = await request.post('/api/auth/sign-up/email', {
    data: { email, password, name },
  });
  expect(signUpRes.ok()).toBeTruthy();

  // Sign in (Better Auth: POST /api/auth/sign-in/email)
  const signInRes = await request.post('/api/auth/sign-in/email', {
    data: { email, password },
  });
  expect(signInRes.ok()).toBeTruthy();

  // Extract cookies and call get-session with an explicit Cookie header
  const setCookies = signInRes
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
  const cookieHeader = buildCookieHeaderFromSetCookie(setCookies);

  const sessionRes = await request.get('/api/auth/get-session', {
    headers: { cookie: cookieHeader },
  });
  expect(sessionRes.ok()).toBeTruthy();
  const session = await sessionRes.json();
  expect(session?.user?.email).toBe(email);
  expect(session?.session?.userId).toBeTruthy();
});

// test('real CDP: signup -> signin -> auto wallet creation + balances (requires real keys)', async ({ request }) => {
//   test.skip(!process.env.CDP_API_KEY || !process.env.CDP_API_SECRET || !process.env.CDP_WALLET_SECRET, 'Real CDP credentials not provided');

//   const email = `real-${Date.now()}@example.com`;
//   const password = `StrongP@ss-${Math.random().toString(36).slice(2)}`;
//   const name = 'Real E2E';

//   // Sign up
//   const signUp = await request.post('/api/auth/sign-up/email', { data: { email, password, name } });
//   expect(signUp.ok()).toBeTruthy();

//   // Sign in
//   const signIn = await request.post('/api/auth/sign-in/email', { data: { email, password } });
//   expect(signIn.ok()).toBeTruthy();

//   const setCookies = signIn
//     .headersArray()
//     .filter((h) => h.name.toLowerCase() === 'set-cookie')
//     .map((h) => h.value);
//   const cookieHeader = buildCookieHeaderFromSetCookie(setCookies);

//   const sessionRes = await request.get('/api/auth/get-session', { headers: { cookie: cookieHeader } });
//   expect(sessionRes.ok()).toBeTruthy();
//   const session = await sessionRes.json();
//   const userId: string = session?.user?.id;
//   expect(userId).toBeTruthy();

//   // Poll for CDP wallets created by auth hook
//   const deadline = Date.now() + 30_000; // 30s
//   let wallets: any[] = [];
//   while (Date.now() < deadline) {
//     const res = await request.get(`/api/users/${userId}/wallets/cdp`, { headers: { cookie: cookieHeader } });
//     if (res.ok()) {
//       wallets = await res.json();
//       if (Array.isArray(wallets) && wallets.length > 0) break;
//     }
//     await new Promise((r) => setTimeout(r, 1000));
//   }
//   expect(Array.isArray(wallets) && wallets.length > 0).toBeTruthy();

//   // Fetch balances for the first account (testnet)
//   const accountId: string = wallets[0].externalWalletId;
//   const balancesRes = await request.get(`/api/users/${userId}/wallets/cdp/${accountId}/balances?network=base-sepolia`, {
//     headers: { cookie: cookieHeader },
//   });
//   expect(balancesRes.ok()).toBeTruthy();
// });



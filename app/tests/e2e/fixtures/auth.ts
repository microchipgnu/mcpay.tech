import { expect, request, type APIRequestContext } from '@playwright/test';
import { test as infra } from './infra';

function cookieFromSetCookieHeaders(setCookieHeaders: string[]): string {
  if (!setCookieHeaders.length) return '';
  return setCookieHeaders.map((h) => h.split(';')[0]).join('; ');
}

export const test = infra.extend<{ sessionCookie: string; authed: APIRequestContext, anon: APIRequestContext; authedWithApiKeyAndFunds: {request: APIRequestContext, apiKey: string, sessionCookie: string, userId: string, walletAddress: string | undefined } }>({
  anon: async ({ baseURL }, use) => {
    const anon = await request.newContext({ baseURL });
    await use(anon);
    await anon.dispose();
  },
  sessionCookie: async ({ baseURL }, use) => {
    const anon = await request.newContext({ baseURL });
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    const password = 'Passw0rd!234';

    // Sign up
    await anon.post('/api/auth/sign-up/email', { data: { email, password, name: 'E2E' } });
    // Sign in
    const signIn = await anon.post('/api/auth/sign-in/email', { data: { email, password } });
    expect(signIn.ok()).toBeTruthy();

    const setCookies = signIn.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value);
    const cookie = cookieFromSetCookieHeaders(setCookies);

    await use(cookie);
    await anon.dispose();
  },
  authed: async ({ baseURL, sessionCookie }, use) => {
    // Create authed context with session cookies
    const authed = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: sessionCookie } });

    // Optionally resolve user session
    try {
      const sessionRes = await authed.get('/api/auth/get-session');
      expect(sessionRes.ok()).toBeTruthy();
    } catch {}

    await use(authed);

    await authed.dispose();
  },
  authedWithApiKeyAndFunds: async ({ baseURL, sessionCookie }, use) => {
    const authed = await request.newContext({ baseURL, extraHTTPHeaders: { cookie: sessionCookie } });

    const session = await authed.get('/api/auth/get-session');
    expect(session.ok()).toBeTruthy();
    const userId = (await session.json()).user.id;

    const apiKey = await authed.post(`/api/users/${userId}/api-keys`, {
      data: {
        name: 'test',
        permissions: ["read", "write", "execute"],
      }
    });
    expect(apiKey.ok()).toBeTruthy();

    // add wallet
    const wallet = await authed.post(`/api/users/${userId}/wallets/managed`, {
      data: {
        walletAddress: process.env.TEST_EVM_ADDRESS,
        provider: "test",
        architecture: "evm",
        externalWalletId: "test",
        isPrimary: true,
        walletMetadata: {
          type: "managed",
          createdByService: true,
          provider: "test"
        }
      }
    });

    console.log("wallet", wallet);
    expect(wallet.ok()).toBeTruthy();

    await use({ request: authed, apiKey: (await apiKey.json()).apiKey, sessionCookie, userId, walletAddress: process.env.TEST_EVM_ADDRESS });
    await authed.dispose();
  },
});

export { expect };



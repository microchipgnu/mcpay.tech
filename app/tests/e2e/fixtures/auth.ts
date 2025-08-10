import { test as base, expect, request, type APIRequestContext } from '@playwright/test';

function cookieFromSetCookieHeaders(setCookieHeaders: string[]): string {
  if (!setCookieHeaders.length) return '';
  return setCookieHeaders.map((h) => h.split(';')[0]).join('; ');
}

export const test = base.extend<{ authed: APIRequestContext; user: { email: string; id?: string } }>({
  authed: async ({ baseURL }, use) => {
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

    // Create authed context with session cookies
    const authed = await request.newContext({ baseURL, extraHTTPHeaders: { cookie } });

    // Optionally resolve user ID
    try {
      const sessionRes = await authed.get('/api/auth/get-session');
      if (sessionRes.ok()) {
        const session = await sessionRes.json();
        (authed as any)._user = { email, id: session?.user?.id };
      }
    } catch {}

    await use(authed);

    await authed.dispose();
    await anon.dispose();
  },

  user: async ({ authed }, use) => {
    const userVal = (authed as any)?._user || { email: '' };
    await use(userVal);
  },
});

export { expect };



import { expect, test } from './fixtures/auth';

test('create api key for an authenticated user', async ({ authed }) => {
    const session = await authed.get('/api/auth/get-session');
    expect(session.ok()).toBeTruthy();
    const userId = (await session.json()).user.id;

    const apiKey = await authed.post(`/api/users/${userId}/api-keys`, {
        data: {
            name: 'test',
            permissions: ["read", "write", "execute"],
        }
    });

    const result = await apiKey.json();

    expect(apiKey.ok()).toBeTruthy();
    expect(result.record.permissions).toEqual(["read", "write", "execute"]);
    expect(result.record.createdAt).toBeDefined();
    expect(result.record.id).toBeDefined();
    expect(result.apiKey).toBeDefined();
});

test('create api key for an unauthenticated user', async ({ anon }) => {
    const apiKey = await anon.post(`/api/users/1/api-keys`, {
        data: {
            name: 'test',
            permissions: ["read", "write", "execute"],
        }
    });

    expect(apiKey.status()).toBe(401);
    expect(apiKey.statusText()).toBe('Unauthorized');
});



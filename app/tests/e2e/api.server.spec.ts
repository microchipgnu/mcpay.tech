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

test('do not authorize to create api key for an unauthenticated user', async ({ anon }) => {
    const apiKey = await anon.post(`/api/users/1/api-keys`, {
        data: {
            name: 'test',
            permissions: ["read", "write", "execute"],
        }
    });

    expect(apiKey.status()).toBe(401);
    expect(apiKey.statusText()).toBe('Unauthorized');
});

test('fetch wallet user', async ({ authedWithApiKeyAndFunds }) => {
    const wallet = await authedWithApiKeyAndFunds.request.get(`/api/wallets/${authedWithApiKeyAndFunds.walletAddress}/user`);
    expect(wallet.ok()).toBeTruthy();
    const result = await wallet.json() as { user: { id: string } };
    expect(result.user.id).toBe(authedWithApiKeyAndFunds.userId);
});


test('add external wallet and list returns it', async ({ authed }) => {
  const session = await authed.get('/api/auth/get-session');
  expect(session.ok()).toBeTruthy();
  const userId = (await session.json()).user.id as string;

  const walletAddress = `0xext-${Date.now()}`;
  const add = await authed.post(`/api/users/${userId}/wallets`, {
    data: {
      walletAddress,
      walletType: 'external',
      provider: 'metamask',
      blockchain: 'ethereum',
      architecture: 'evm',
      isPrimary: true,
      walletMetadata: { test: true },
    },
  });
  expect(add.status()).toBe(201);
  const added = await add.json();
  expect(added.id).toBeTruthy();
  expect(added.walletType).toBe('external');
  expect(added.isPrimary).toBe(true);

  const list = await authed.get(`/api/users/${userId}/wallets`);
  expect(list.ok()).toBeTruthy();
  const listJson = await list.json();
  expect(Array.isArray(listJson.wallets)).toBe(true);
  expect(listJson.wallets.some((w: any) => w.walletAddress === walletAddress)).toBe(true);
});

test('set primary uniqueness and reassignment on delete', async ({ authed }) => {
  const session = await authed.get('/api/auth/get-session');
  expect(session.ok()).toBeTruthy();
  const userId = (await session.json()).user.id as string;

  // Add two external wallets
  const addrA = `0xA-${Date.now()}`;
  const addrB = `0xB-${Date.now()}`;

  const addA = await authed.post(`/api/users/${userId}/wallets`, {
    data: { walletAddress: addrA, walletType: 'external', provider: 'metamask', blockchain: 'ethereum', architecture: 'evm', isPrimary: true },
  });
  expect(addA.status()).toBe(201);
  const walletA = await addA.json();

  const addB = await authed.post(`/api/users/${userId}/wallets`, {
    data: { walletAddress: addrB, walletType: 'external', provider: 'metamask', blockchain: 'ethereum', architecture: 'evm', isPrimary: false },
  });
  expect(addB.status()).toBe(201);
  const walletB = await addB.json();

  // Set B as primary
  const setPrimary = await authed.put(`/api/users/${userId}/wallets/${walletB.id}/primary`);
  expect(setPrimary.ok()).toBeTruthy();

  // Verify exactly one primary and it's B
  let list = await authed.get(`/api/users/${userId}/wallets`);
  expect(list.ok()).toBeTruthy();
  let listJson = await list.json();
  const primaries = listJson.wallets.filter((w: any) => w.isPrimary === true);
  expect(primaries.length).toBe(1);
  expect(primaries[0].id).toBe(walletB.id);

  // Delete B (current primary) -> A should be reassigned as primary
  const delB = await authed.delete(`/api/users/${userId}/wallets/${walletB.id}`);
  expect(delB.ok()).toBeTruthy();

  list = await authed.get(`/api/users/${userId}/wallets`);
  expect(list.ok()).toBeTruthy();
  listJson = await list.json();
  const primariesAfter = listJson.wallets.filter((w: any) => w.isPrimary === true);
  expect(primariesAfter.length).toBe(1);
  expect(primariesAfter[0].id).toBe(walletA.id);
});

test('managed wallet creation is idempotent (ensure-like behavior)', async ({ authed }) => {
  const session = await authed.get('/api/auth/get-session');
  expect(session.ok()).toBeTruthy();
  const userId = (await session.json()).user.id as string;

  const managedAddress = process.env.TEST_EVM_ADDRESS || `0xmanaged-${Date.now()}`;

  const create1 = await authed.post(`/api/users/${userId}/wallets/managed`, {
    data: {
      walletAddress: managedAddress,
      provider: 'test',
      architecture: 'evm',
      externalWalletId: 'test-1',
      isPrimary: false,
      walletMetadata: { createdByService: true },
    },
  });
  expect(create1.status()).toBe(201);

  const create2 = await authed.post(`/api/users/${userId}/wallets/managed`, {
    data: {
      walletAddress: managedAddress,
      provider: 'test',
      architecture: 'evm',
      externalWalletId: 'test-1',
      isPrimary: false,
      walletMetadata: { createdByService: true },
    },
  });
  expect(create2.status()).toBe(201);

  const list = await authed.get(`/api/users/${userId}/wallets?includeInactive=true`);
  expect(list.ok()).toBeTruthy();
  const listJson = await list.json();
  const managed = listJson.wallets.filter((w: any) => w.walletAddress === managedAddress && w.walletType === 'managed' && w.provider === 'test');
  expect(managed.length).toBe(1);
});

test('balances endpoints include mainnet and testnet data keys', async ({ authed }) => {
  const session = await authed.get('/api/auth/get-session');
  expect(session.ok()).toBeTruthy();
  const userId = (await session.json()).user.id as string;

  // Ensure at least one wallet exists
  const addr = `0xBAL-${Date.now()}`;
  const add = await authed.post(`/api/users/${userId}/wallets`, {
    data: { walletAddress: addr, walletType: 'external', provider: 'metamask', blockchain: 'ethereum', architecture: 'evm', isPrimary: true },
  });
  expect(add.status()).toBe(201);

  const listAll = await authed.get(`/api/users/${userId}/wallets?includeTestnet=true`);
  expect(listAll.ok()).toBeTruthy();
  const allJson = await listAll.json();
  expect(allJson).toHaveProperty('mainnetBalances');
  expect(allJson).toHaveProperty('testnetBalances');
  expect(Array.isArray(allJson.mainnetBalances)).toBe(true);
  expect(Array.isArray(allJson.testnetBalances)).toBe(true);

  const mainnetOnly = await authed.get(`/api/users/${userId}/wallets/mainnet-balances`);
  expect(mainnetOnly.ok()).toBeTruthy();
  const mainnetJson = await mainnetOnly.json();
  expect(mainnetJson.summary?.networkType).toBe('mainnet');

  const testnetOnly = await authed.get(`/api/users/${userId}/wallets/testnet-balances`);
  expect(testnetOnly.ok()).toBeTruthy();
  const testnetJson = await testnetOnly.json();
  expect(testnetJson.summary?.networkType).toBe('testnet');
});

test('networks listing includes expected networks', async ({ authed }) => {
  // CDP networks
  const cdpNetworks = await authed.get(`/api/cdp/networks`);
  expect(cdpNetworks.ok()).toBeTruthy();
  const cdpJson = await cdpNetworks.json();

  console.log(cdpJson);
  
  expect(cdpJson.supportedNetworks).toEqual([
    {
      id: 'base',
      name: 'Base Mainnet',
      isTestnet: false,
      nativeToken: 'ETH'
    },
    {
      id: 'base-sepolia',
      name: 'Base Sepolia',
      isTestnet: true,
      nativeToken: 'ETH'
    },
    {
      id: 'ethereum',
      name: 'Ethereum Mainnet',
      isTestnet: false,
      nativeToken: 'ETH'
    },
    {
      id: 'ethereum-sepolia',
      name: 'Ethereum Sepolia',
      isTestnet: true,
      nativeToken: 'ETH'
    },
    {
      id: 'polygon',
      name: 'Polygon Mainnet',
      isTestnet: false,
      nativeToken: 'MATIC'
    },
    {
      id: 'arbitrum',
      name: 'Arbitrum One',
      isTestnet: false,
      nativeToken: 'ETH'
    }
  ]);
  expect(cdpJson.defaultNetwork).toBe('base-sepolia');

  // Onramp config networks (full supported networks)
  const onramp = await authed.get(`/api/onramp/config`);
  expect(onramp.ok()).toBeTruthy();
  const onrampJson = await onramp.json();
  expect(onrampJson.supportedNetworks).toEqual(expect.arrayContaining(["ethereum", "base", "polygon", "arbitrum", "optimism", "avalanche"]));
});

// test('cdp faucet (testnet) — skipped unless real CDP credentials provided', async ({ authed }) => {
//   const hasRealCDP = !!process.env.CDP_API_KEY && process.env.CDP_API_KEY !== 'fake';
//   test.skip(!hasRealCDP, 'CDP tests require real credentials');

//   const session = await authed.get('/api/auth/get-session');
//   expect(session.ok()).toBeTruthy();
//   const userId = (await session.json()).user.id as string;

//   // Create CDP wallet (base-sepolia)
//   const create = await authed.post(`/api/users/${userId}/wallets/cdp`, {
//     data: { network: 'base-sepolia', createSmartAccount: false, isPrimary: true },
//   });
//   expect(create.ok()).toBeTruthy();
//   const cdp = await create.json();
//   const accountId = cdp.cdpAccountInfo?.account?.accountId || cdp.wallets?.[0]?.externalWalletId;
//   expect(accountId).toBeTruthy();

//   // Request faucet
//   const faucet = await authed.post(`/api/users/${userId}/wallets/cdp/${accountId}/faucet`, { data: { token: 'eth', network: 'base-sepolia' } });
//   expect(faucet.ok()).toBeTruthy();
// });



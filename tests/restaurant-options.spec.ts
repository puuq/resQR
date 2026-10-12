import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

test('optional tables, independent shared calls, Wi-Fi-free forms and scoped restaurant deletion', async ({
  playwright,
  browser,
}) => {
  mkdirSync('.local', { recursive: true });
  const credentialsPath = '.local/pilot-credentials.json';
  const credentials = existsSync(credentialsPath)
    ? JSON.parse(readFileSync(credentialsPath, 'utf8'))
    : { email: 'admin@resqr.local', password: randomBytes(24).toString('base64url') };
  writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  const admin = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  const login = await admin.post('/api/auth', { data: credentials });
  if (login.status() === 401) {
    const setup = await admin.post('/api/auth', {
      data: {
        ...credentials,
        name: 'San Choo',
        action: 'setup',
        token: readFileSync('.local/setup-token.txt', 'utf8').trim(),
      },
    });
    expect(setup.status()).toBe(201);
  } else expect(login.status()).toBe(200);
  const suffix = Date.now().toString(36);
  const create = async (name: string, slug: string, table_count?: number) => {
    const response = await admin.post('/api/restaurants', {
      data: {
        name,
        slug,
        ...(table_count === undefined ? {} : { table_count }),
        sample_menu: true,
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).id;
  };
  const numberedId = await create('Keep numbered café', `numbered-${suffix}`, 2);
  const sharedId = await create(`Shared café ${suffix}`, `shared-${suffix}`);
  const numbered = await (await admin.get(`/api/workspace?restaurant=${numberedId}`)).json();
  const shared = await (await admin.get(`/api/workspace?restaurant=${sharedId}`)).json();
  expect(numbered.tables).toHaveLength(3);
  expect(numbered.tables.filter((table: { is_shared: number }) => table.is_shared)).toHaveLength(1);
  expect(shared.tables).toHaveLength(1);
  expect(shared.tables[0].is_shared).toBe(1);
  const sharedToken = shared.tables[0].token;
  const regularToken = numbered.tables.find(
    (table: { is_shared: number }) => !table.is_shared,
  ).token;
  const guest = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  const guestA = randomBytes(32).toString('hex');
  const guestB = randomBytes(32).toString('hex');
  const guestC = randomBytes(32).toString('hex');
  const publicMenu = await (await guest.get(`/api/public?table=${sharedToken}`)).json();
  expect(publicMenu.table).toEqual({ label: 'Guest menu', is_shared: 1 });
  expect((await guest.get(`/api/calls?table=${sharedToken}`)).status()).toBe(400);
  expect((await guest.post('/api/calls', { data: { token: sharedToken } })).status()).toBe(400);
  const repeated = await Promise.all(
    Array.from({ length: 4 }, () =>
      guest.post('/api/calls', { data: { token: sharedToken, guest: guestA } }),
    ),
  );
  const ids = [];
  for (const result of repeated) {
    expect(result.status()).toBe(200);
    ids.push((await result.json()).call.id);
  }
  expect(new Set(ids).size).toBe(1);
  const callA = ids[0];
  const callBResponse = await guest.post('/api/calls', {
    data: { token: sharedToken, guest: guestB },
  });
  expect(callBResponse.status()).toBe(200);
  const callB = (await callBResponse.json()).call.id;
  expect(callB).not.toBe(callA);
  expect(
    (await (await guest.get(`/api/calls?table=${sharedToken}&guest=${guestA}`)).json()).call.id,
  ).toBe(callA);
  expect(
    (await (await guest.get(`/api/calls?table=${sharedToken}&guest=${guestC}`)).json()).call,
  ).toBeNull();
  const regularFirst = (
    await (await guest.post('/api/calls', { data: { token: regularToken, guest: guestA } })).json()
  ).call.id;
  const regularSecond = (
    await (await guest.post('/api/calls', { data: { token: regularToken, guest: guestB } })).json()
  ).call.id;
  expect(regularSecond).toBe(regularFirst); // Per-browser tokens cannot bypass numbered-table deduplication.
  const waiterCredentials = {
    email: `shared-waiter-${suffix}@resqr.local`,
    password: randomBytes(20).toString('base64url'),
  };
  const ownerCredentials = {
    email: `shared-owner-${suffix}@resqr.local`,
    password: randomBytes(20).toString('base64url'),
  };
  for (const [role, credentials] of [
    ['waiter', waiterCredentials],
    ['owner', ownerCredentials],
  ] as const)
    expect(
      (
        await admin.post('/api/staff', {
          data: { ...credentials, name: 'Shared team', role, restaurant_id: sharedId },
        })
      ).status(),
    ).toBe(201);
  const waiter = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  expect((await waiter.post('/api/auth', { data: waiterCredentials })).status()).toBe(200);
  expect((await owner.post('/api/auth', { data: ownerCredentials })).status()).toBe(200);
  const queue = (await (await waiter.get(`/api/calls?restaurant=${sharedId}`)).json()).calls;
  expect(queue).toHaveLength(2);
  expect(
    queue.every(
      (call: { table_label: string; is_shared: number }) =>
        call.table_label === 'Guest request' && call.is_shared === 1,
    ),
  ).toBeTruthy();
  for (const status of ['acknowledged', 'completed'])
    expect(
      (
        await waiter.patch('/api/calls', { data: { id: callA, restaurant_id: sharedId, status } })
      ).status(),
    ).toBe(200);
  expect(
    (await guest.post('/api/calls', { data: { token: sharedToken, guest: guestA } })).status(),
  ).toBe(429);
  expect(
    (await (await guest.get(`/api/calls?table=${sharedToken}&guest=${guestB}`)).json()).call.status,
  ).toBe('pending');
  expect(
    (await guest.post('/api/calls', { data: { token: sharedToken, guest: guestC } })).status(),
  ).toBe(200);
  expect(
    (
      await owner.post('/api/tables', {
        data: { restaurant_id: sharedId, id: shared.tables[0].id, label: 'Changed shared QR' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await owner.post('/api/tables', { data: { restaurant_id: sharedId, label: 'Window seat' } })
    ).status(),
  ).toBe(200);
  const modified = await (await admin.get(`/api/workspace?restaurant=${sharedId}`)).json();
  expect(modified.tables.find((table: { is_shared: number }) => table.is_shared).token).toBe(
    sharedToken,
  );
  const summaries = (await (await admin.get('/api/restaurants')).json()).restaurants;
  expect(
    summaries.find((restaurant: { id: string }) => restaurant.id === sharedId).table_count,
  ).toBe(1);
  expect(
    summaries.find((restaurant: { id: string }) => restaurant.id === numberedId).table_count,
  ).toBe(2);

  // Real browser shared calls: another browser must not see or reuse the first browser's status.
  const adminContext = await browser.newContext({
    storageState: await admin.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto('/dashboard');
  await adminPage.getByRole('button', { name: 'Add restaurant', exact: true }).click();
  await expect(adminPage.getByLabel('Number of tables (optional)', { exact: true })).toHaveValue(
    '',
  );
  await expect(adminPage.getByLabel('Wi-Fi name', { exact: true })).toHaveCount(0);
  await expect(adminPage.getByLabel('Wi-Fi password', { exact: true })).toHaveCount(0);
  const uiName = `Shared only UI ${suffix}`;
  await adminPage.getByLabel('Restaurant name', { exact: true }).fill(uiName);
  await adminPage.getByRole('button', { name: 'Create restaurant', exact: true }).click();
  await expect(adminPage.getByRole('dialog')).toHaveCount(0);
  const uiRestaurant = (await (await admin.get('/api/restaurants')).json()).restaurants.find(
    (restaurant: { name: string }) => restaurant.name === uiName,
  );
  expect(uiRestaurant.table_count).toBe(0);
  const uiWorkspace = await (
    await admin.get(`/api/workspace?restaurant=${uiRestaurant.id}`)
  ).json();
  expect(uiWorkspace.tables).toHaveLength(1);
  await adminPage.getByRole('button', { name: 'Tables & QR', exact: true }).click();
  await expect(adminPage.getByRole('heading', { name: 'Shared QR', exact: true })).toBeVisible();
  await expect(adminPage.getByRole('button', { name: /Rename/ })).toHaveCount(0);
  await adminPage.screenshot({ path: '.local/shared-qr-admin.png' });
  const customerA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const customerB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const customerPageA = await customerA.newPage();
  const customerPageB = await customerB.newPage();
  const uiToken = uiWorkspace.tables[0].token;
  await customerPageA.goto(`/t/${uiToken}`);
  await expect(customerPageA.getByText('Guest menu', { exact: true })).toBeVisible();
  await customerPageA.getByRole('button', { name: 'Call waiter', exact: true }).click();
  await expect(customerPageA.getByText('Request sent', { exact: true })).toBeVisible();
  await customerPageB.goto(`/t/${uiToken}`);
  await expect(
    customerPageB.getByRole('button', { name: 'Call waiter', exact: true }),
  ).toBeEnabled();
  await expect(customerPageB.getByText('Request sent', { exact: true })).toHaveCount(0);
  await customerPageB.getByRole('button', { name: 'Call waiter', exact: true }).click();
  await expect(customerPageB.getByText('Request sent', { exact: true })).toBeVisible();
  await customerPageA.reload();
  await expect(customerPageA.getByText('Request sent', { exact: true })).toBeVisible();
  const uiCalls = (await (await admin.get(`/api/calls?restaurant=${uiRestaurant.id}`)).json())
    .calls;
  expect(uiCalls).toHaveLength(2);
  expect(new Set(uiCalls.map((call: { id: string }) => call.id)).size).toBe(2);
  await adminPage.getByRole('button', { name: 'Service queue', exact: true }).click();
  await expect(adminPage.getByRole('heading', { name: 'Guest request', exact: true })).toHaveCount(
    2,
  );
  await adminPage.screenshot({ path: '.local/shared-qr-queue.png' });

  // Delete UI needs exact-name confirmation; owners/guests cannot call the endpoint directly.
  await adminPage.getByRole('button', { name: 'Brand & settings', exact: true }).click();
  await expect(adminPage.getByLabel('Wi-Fi name', { exact: true })).toHaveCount(0);
  await adminPage.getByRole('button', { name: 'Delete restaurant', exact: true }).click();
  await expect(
    adminPage.getByRole('button', { name: 'Delete permanently', exact: true }),
  ).toBeDisabled();
  await adminPage.getByLabel('Type the restaurant name to confirm').fill('Wrong restaurant');
  await expect(
    adminPage.getByRole('button', { name: 'Delete permanently', exact: true }),
  ).toBeDisabled();
  await adminPage.getByLabel('Type the restaurant name to confirm').fill(uiName);
  await adminPage.setViewportSize({ width: 390, height: 844 });
  expect(
    await adminPage.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBeTruthy();
  await adminPage.screenshot({ path: '.local/delete-restaurant-confirm.png' });
  await adminPage.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(adminPage.getByRole('dialog')).toHaveCount(0);
  expect((await guest.get(`/api/public?table=${uiToken}`)).status()).toBe(404);

  const deletion = { id: sharedId, confirm_name: shared.restaurant.name };
  expect((await guest.delete('/api/restaurants', { data: deletion })).status()).toBe(401);
  expect((await waiter.delete('/api/restaurants', { data: deletion })).status()).toBe(403);
  expect((await owner.delete('/api/restaurants', { data: deletion })).status()).toBe(403);
  expect(
    (
      await admin.delete('/api/restaurants', { data: { ...deletion, confirm_name: 'Wrong name' } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await admin.delete('/api/restaurants', {
        headers: { Origin: 'https://evil.example' },
        data: deletion,
      })
    ).status(),
  ).toBe(403);
  expect((await admin.get(`/api/workspace?restaurant=${sharedId}`)).status()).toBe(200);
  expect((await admin.delete('/api/restaurants', { data: deletion })).status()).toBe(200);
  expect((await admin.get(`/api/workspace?restaurant=${sharedId}`)).status()).toBe(404);
  expect((await guest.get(`/api/public?slug=shared-${suffix}`)).status()).toBe(404);
  for (const table of modified.tables)
    expect((await guest.get(`/api/public?table=${table.token}`)).status()).toBe(404);
  expect((await (await waiter.get('/api/auth')).json()).user).toBeNull();
  expect((await (await owner.get('/api/auth')).json()).user).toBeNull();
  expect((await waiter.post('/api/auth', { data: waiterCredentials })).status()).toBe(401);
  expect((await admin.delete('/api/restaurants', { data: deletion })).status()).toBe(404);
  expect((await guest.get(`/api/public?table=${regularToken}`)).status()).toBe(200);
  expect(
    (await (await admin.get(`/api/workspace?restaurant=${numberedId}`)).json()).menu,
  ).toHaveLength(8);
  expect((await (await admin.get(`/api/calls?restaurant=${numberedId}`)).json()).calls[0].id).toBe(
    regularFirst,
  );
  await adminContext.close();
  await customerA.close();
  await customerB.close();
  await admin.dispose();
  await owner.dispose();
  await waiter.dispose();
  await guest.dispose();
});

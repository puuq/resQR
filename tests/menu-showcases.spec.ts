import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { Workspace } from '../src/lib/types';

test('owners edit two highlights, customers filter them, and tenant membership stays scoped', async ({
  playwright,
  browser,
}) => {
  mkdirSync('.local', { recursive: true });
  const credentialsPath = '.local/pilot-credentials.json';
  const credentials = existsSync(credentialsPath)
    ? JSON.parse(readFileSync(credentialsPath, 'utf8'))
    : { email: 'admin@resqr.local', password: randomBytes(24).toString('base64url') };
  writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  // Give this local test its own IP bucket so CI's dev + Worker runs remain independent.
  const testHeaders = { 'cf-connecting-ip': `highlights-${randomBytes(8).toString('hex')}` };
  const admin = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: testHeaders,
  });
  const login = await admin.post('/api/auth', { data: credentials });
  if (login.status() === 401) {
    expect(
      (
        await admin.post('/api/auth', {
          data: {
            ...credentials,
            name: 'San Choo',
            action: 'setup',
            token: readFileSync('.local/setup-token.txt', 'utf8').trim(),
          },
        })
      ).status(),
    ).toBe(201);
  } else expect(login.status()).toBe(200);
  const suffix = Date.now().toString(36);
  async function create(name: string, slug: string) {
    const response = await admin.post('/api/restaurants', {
      data: { name, slug, sample_menu: true, color: '#a44459' },
    });
    expect(response.status()).toBe(201);
    const { id } = await response.json();
    return (await (await admin.get(`/api/workspace?restaurant=${id}`)).json()) as Workspace;
  }
  const workspace = await create('Highlights café', `highlights-${suffix}`);
  const other = await create('Other highlights café', `other-highlights-${suffix}`);
  expect(workspace.showcases).toEqual([]);
  const rid = workspace.restaurant.id;
  const sections = [
    {
      slot: 1,
      title: 'Guest favourites',
      description: 'A few dishes our guests come back for.',
      enabled: true,
      item_ids: workspace.menu.slice(0, 3).map((item) => item.id),
    },
    {
      slot: 2,
      title: 'Festival offer',
      description: 'Free chiya with any featured meal until Friday.',
      enabled: true,
      item_ids: [workspace.menu[3].id],
    },
  ];
  const guest = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  const save = (showcases: unknown, restaurant_id = rid) =>
    admin.put('/api/menu-showcases', { data: { restaurant_id, showcases } });
  expect(
    (
      await guest.put('/api/menu-showcases', { data: { restaurant_id: rid, showcases: sections } })
    ).status(),
  ).toBe(401);
  expect((await save(sections)).status()).toBe(200);
  expect(
    (
      await admin.put('/api/menu-showcases', {
        headers: { Origin: 'https://other.example' },
        data: { restaurant_id: rid, showcases: sections },
      })
    ).status(),
  ).toBe(403);
  for (const invalid of [
    [sections[0], { ...sections[1], slot: 1 }],
    [{ ...sections[0], title: ' ' }, sections[1]],
    [{ ...sections[0], item_ids: [] }, sections[1]],
    [{ ...sections[0], item_ids: Array(13).fill(workspace.menu[0].id) }, sections[1]],
    [{ ...sections[0], item_ids: [workspace.menu[0].id, workspace.menu[0].id] }, sections[1]],
    [{ ...sections[0], item_ids: [other.menu[0].id] }, sections[1]],
  ])
    expect((await save(invalid)).status()).toBe(400);
  expect((await (await admin.get(`/api/workspace?restaurant=${rid}`)).json()).showcases).toEqual(
    sections,
  );
  const ownerCredentials = {
    email: `highlight-owner-${suffix}@resqr.local`,
    password: randomBytes(20).toString('base64url'),
  };
  for (const role of ['owner', 'waiter', 'receptionist']) {
    const creds =
      role === 'owner'
        ? ownerCredentials
        : {
            email: `highlight-${role}-${suffix}@resqr.local`,
            password: randomBytes(20).toString('base64url'),
          };
    expect(
      (
        await admin.post('/api/staff', {
          data: { ...creds, restaurant_id: rid, name: 'Highlights team', role },
        })
      ).status(),
    ).toBe(201);
    if (role !== 'owner') {
      const staff = await playwright.request.newContext({
        baseURL: 'http://localhost:3000',
        extraHTTPHeaders: testHeaders,
      });
      expect((await staff.post('/api/auth', { data: creds })).status()).toBe(200);
      expect(
        (
          await staff.put('/api/menu-showcases', {
            data: { restaurant_id: rid, showcases: sections },
          })
        ).status(),
      ).toBe(403);
      await staff.dispose();
    }
  }
  const owner = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: testHeaders,
  });
  expect(
    (
      await owner.request.post('http://localhost:3000/api/auth', { data: ownerCredentials })
    ).status(),
  ).toBe(200);
  expect(
    (
      await owner.request.put('http://localhost:3000/api/menu-showcases', {
        data: { restaurant_id: other.restaurant.id, showcases: sections },
      })
    ).status(),
  ).toBe(403);
  const dashboard = await owner.newPage();
  await dashboard.goto('/dashboard');
  await dashboard.getByRole('button', { name: 'Menu', exact: true }).click();
  await dashboard.getByRole('button', { name: 'Edit highlights', exact: true }).click();
  const dialog = dashboard.getByRole('dialog', { name: 'Menu highlights', exact: true });
  await expect(dialog.getByLabel('Section 1 title', { exact: true })).toHaveValue(
    'Guest favourites',
  );
  await dialog.getByLabel('Section 1 title', { exact: true }).fill('Our signatures');
  await dialog
    .getByRole('textbox', { name: 'Section 2 message (optional)', exact: true })
    .fill('Free chiya with these dishes this week. Ask your waiter.');
  const second = dialog.getByRole('region', { name: 'Highlight 2', exact: true });
  // Sections use accessible labels but native <section> becomes a region.
  await second.getByRole('checkbox', { name: new RegExp(workspace.menu[4].name) }).check();
  await dialog.getByRole('button', { name: 'Save highlights', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  let updated = (await (await admin.get(`/api/workspace?restaurant=${rid}`)).json()) as Workspace;
  expect(updated.showcases[0].title).toBe('Our signatures');
  expect(updated.showcases[1].item_ids).toEqual([workspace.menu[3].id, workspace.menu[4].id]);
  await dashboard.getByRole('button', { name: 'Edit highlights', exact: true }).click();
  await dashboard.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(
    await dialog
      .locator('.showcase-dish-choice')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThan(80);
  await dashboard.screenshot({ path: '.local/menu-highlights-editor-390.png' });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  const customer = await browser.newContext();
  const page = await customer.newPage();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/t/${workspace.tables[0].token}`);
    await expect(page.locator('.customer-showcase')).toHaveCount(2);
    await expect(page.locator('.showcase-card')).toHaveCount(5);
    await expect(page.locator('.customer-item')).toHaveCount(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const top = await page.locator('.customer-showcases').boundingBox();
    const normal = await page.locator('.customer-items').boundingBox();
    expect(top!.y + top!.height).toBeLessThan(normal!.y);
    await expect(page.locator('.call-dock')).toBeInViewport();
    expect(
      await page
        .locator('.customer-showcase')
        .evaluateAll((sections) =>
          sections.every(
            (section) =>
              section.getBoundingClientRect().width <=
              section.parentElement!.getBoundingClientRect().width,
          ),
        ),
    ).toBe(true);
    await page.screenshot({ path: `.local/menu-highlights-${width}.png` });
    const tabs = page.getByRole('navigation', { name: 'Menu categories' });
    await tabs.getByRole('button', { name: 'Festival offer', exact: true }).click();
    await expect(page.locator('.customer-showcase')).toHaveCount(1);
    await expect(page.locator('.showcase-card')).toHaveCount(2);
    await expect(page.locator('.customer-item')).toHaveCount(0);
    await page
      .getByRole('textbox', { name: 'Search food and drinks' })
      .fill(workspace.menu[3].name);
    await expect(page.locator('.showcase-card')).toHaveCount(1);
    await page.getByRole('textbox', { name: 'Search food and drinks' }).fill('no matching dish');
    await expect(page.getByRole('heading', { name: 'Nothing matches just yet.' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Search food and drinks' }).fill('');
    await tabs.getByRole('button', { name: 'Coffee & tea', exact: true }).click();
    await expect(page.locator('.customer-showcase')).toHaveCount(0);
    await expect(page.locator('.customer-item')).toHaveCount(3);
  }
  // Menu edits update the highlight without a second price or availability record.
  const item = workspace.menu[0];
  expect(
    (
      await admin.post('/api/menu', {
        data: { ...item, price: 333.5, available: false, vegetarian: !!item.vegetarian },
      })
    ).status(),
  ).toBe(200);
  await page.goto(`/r/${workspace.restaurant.slug}`);
  const featured = page.locator('.showcase-card').filter({ hasText: item.name });
  await expect(featured).toContainText('333.5');
  await expect(featured).toContainText('Sold out today');
  // Identical title to a regular category still uses a distinct filter value.
  updated = (await (await admin.get(`/api/workspace?restaurant=${rid}`)).json()) as Workspace;
  const renamed = updated.showcases.map((section) =>
    section.slot === 1 ? { ...section, title: 'Coffee & tea' } : section,
  );
  expect((await save(renamed)).status()).toBe(200);
  await page.reload();
  const duplicateTabs = page
    .getByRole('navigation', { name: 'Menu categories' })
    .getByRole('button', { name: 'Coffee & tea', exact: true });
  await expect(duplicateTabs).toHaveCount(2);
  await duplicateTabs.first().click();
  await expect(page.locator('.customer-showcase')).toHaveCount(1);
  await expect(page.locator('.customer-item')).toHaveCount(0);
  await duplicateTabs.last().click();
  await expect(page.locator('.customer-showcase')).toHaveCount(0);
  await expect(page.locator('.customer-item')).toHaveCount(3);
  expect(
    (await save(updated.showcases.map((section) => ({ ...section, enabled: false })))).status(),
  ).toBe(200);
  expect(
    (await (await guest.get(`/api/public?slug=${workspace.restaurant.slug}`)).json()).showcases,
  ).toEqual([]);
  await page.reload();
  await expect(page.locator('.customer-showcase')).toHaveCount(0);
  // Deleting dishes removes memberships; a now-empty highlight disappears.
  expect((await save(updated.showcases)).status()).toBe(200);
  for (const id of updated.showcases[1].item_ids)
    expect((await admin.delete('/api/menu', { data: { id, restaurant_id: rid } })).status()).toBe(
      200,
    );
  const remaining = await (await guest.get(`/api/public?slug=${workspace.restaurant.slug}`)).json();
  expect(remaining.showcases.map((section: { slot: number }) => section.slot)).toEqual([1]);
  expect(
    (
      await admin.delete('/api/restaurants', {
        data: { id: rid, confirm_name: workspace.restaurant.name },
      })
    ).status(),
  ).toBe(200);
  expect((await guest.get(`/api/public?slug=${workspace.restaurant.slug}`)).status()).toBe(404);
  expect(
    (await (await guest.get(`/api/public?slug=${other.restaurant.slug}`)).json()).showcases,
  ).toEqual([]);
  await owner.close();
  await customer.close();
  await admin.dispose();
  await guest.dispose();
});

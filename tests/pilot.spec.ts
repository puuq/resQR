import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

test('restaurant onboarding, tenant boundaries and the complete table-call lifecycle', async ({
  playwright,
  browser,
  page,
}) => {
  mkdirSync('.local', { recursive: true });
  const credentialsPath = '.local/pilot-credentials.json';
  const credentials = existsSync(credentialsPath)
    ? JSON.parse(readFileSync(credentialsPath, 'utf8'))
    : { email: 'admin@resqr.local', password: randomBytes(24).toString('base64url') };
  writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  const token = readFileSync('.local/setup-token.txt', 'utf8').trim();
  const admin = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  const setup = await admin.post('/api/auth', {
    data: { ...credentials, name: 'San Choo', action: 'setup', token },
  });
  expect([201, 409]).toContain(setup.status());
  if (setup.status() === 409)
    expect((await admin.post('/api/auth', { data: credentials })).ok()).toBeTruthy();
  const suffix = Date.now().toString(36);
  const reviewUrl = 'https://g.page/r/juniper-demo/review';
  const first = await admin.post('/api/restaurants', {
    data: {
      name: 'Juniper Coffee House',
      slug: `juniper-${suffix}`,
      address: 'Jhamsikhel, Lalitpur',
      tagline: 'Good coffee. Slow mornings. Great company.',
      color: '#285847',
      table_count: 6,
      sample_menu: true,
      wifi_ssid: 'Juniper Guest',
      wifi_password: 'a-demo-wifi-password',
      google_review_url: reviewUrl,
    },
  });
  expect(first.status()).toBe(201);
  const rid = (await first.json()).id;
  const second = await admin.post('/api/restaurants', {
    data: {
      name: 'The Corner Table',
      slug: `corner-${suffix}`,
      color: '#965d44',
      table_count: 4,
      sample_menu: true,
    },
  });
  expect(second.status()).toBe(201);
  const other = (await second.json()).id;
  const w = await (await admin.get(`/api/workspace?restaurant=${rid}`)).json();
  expect(w.tables).toHaveLength(6);
  expect(w.menu).toHaveLength(8);
  const waiterCredentials = {
    email: `waiter-${suffix}@resqr.local`,
    password: randomBytes(20).toString('base64url'),
  };
  const staff = await admin.post('/api/staff', {
    data: { ...waiterCredentials, name: 'Aarav', role: 'waiter', restaurant_id: rid },
  });
  expect(staff.status()).toBe(201);
  const waiter = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  expect((await waiter.post('/api/auth', { data: waiterCredentials })).status()).toBe(200);
  expect((await waiter.get(`/api/workspace?restaurant=${other}`)).status()).toBe(403);
  expect((await waiter.get(`/api/calls?restaurant=${other}`)).status()).toBe(403);
  expect(
    (
      await waiter.post('/api/menu', {
        data: { restaurant_id: rid, name: 'Not allowed', category: 'Coffee', price: 1 },
      })
    ).status(),
  ).toBe(403);
  const guest = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  expect((await guest.get('/api/inquiries')).status()).toBe(401);
  expect(
    (await guest.patch('/api/inquiries', { data: { id: 1, status: 'contacted' } })).status(),
  ).toBe(401);
  expect((await waiter.get('/api/inquiries')).status()).toBe(403);
  expect(
    (await waiter.patch('/api/inquiries', { data: { id: 1, status: 'contacted' } })).status(),
  ).toBe(403);
  const inquiry = {
    name: 'Pilot owner',
    restaurant: `Homepage café ${suffix}`,
    location: 'Lalitpur',
    phone: '+977 9800000000',
    email: 'owner@example.com',
    message: 'Please help with six tables.',
  };
  expect(
    (await guest.post('/api/inquiries', { data: { ...inquiry, phone: 'not-a-phone' } })).status(),
  ).toBe(400);
  expect(
    (
      await guest.post('/api/inquiries', {
        headers: { Origin: 'https://evil.example' },
        data: inquiry,
      })
    ).status(),
  ).toBe(403);
  // Honeypot submissions do not save contact details; the public endpoint is rate limited.
  for (let attempt = 0; attempt < 5; attempt++) {
    expect(
      (
        await guest.post('/api/inquiries', {
          headers: { 'cf-connecting-ip': `bot-${suffix}` },
          data: { ...inquiry, website: 'bot.example' },
        })
      ).status(),
    ).toBe(201);
  }
  expect(
    (
      await guest.post('/api/inquiries', {
        headers: { 'cf-connecting-ip': `bot-${suffix}` },
        data: { ...inquiry, website: 'bot.example' },
      })
    ).status(),
  ).toBe(429);
  expect(
    (await (await admin.get('/api/inquiries')).json()).inquiries.some(
      (item: { restaurant: string }) => item.restaurant === inquiry.restaurant,
    ),
  ).toBeFalsy();
  expect((await guest.get('/api/restaurants')).status()).toBe(401);
  expect((await guest.get('/api/public?table=invalid')).status()).toBe(404);
  const publicData = await (await guest.get(`/api/public?table=${w.tables[0].token}`)).json();
  expect(publicData.restaurant.wifi_password).toBeUndefined();
  expect(publicData.restaurant.wifi_ssid).toBeUndefined();
  expect(publicData.restaurant.google_review_url).toBe(reviewUrl);
  expect(
    (await (await guest.get(`/api/public?slug=corner-${suffix}`)).json()).restaurant
      .google_review_url,
  ).toBe('');
  for (const invalidReviewUrl of [
    'http://g.page/r/juniper/review',
    'https://g.page.evil.example/r/juniper/review',
    'https://www.google.com/url?q=https://evil.example',
    'javascript:alert(1)',
  ]) {
    expect(
      (
        await admin.patch('/api/restaurants', {
          data: { ...w.restaurant, google_review_url: invalidReviewUrl },
        })
      ).status(),
    ).toBe(400);
  }
  expect(
    (
      await waiter.patch('/api/restaurants', {
        data: { ...w.restaurant, google_review_url: reviewUrl },
      })
    ).status(),
  ).toBe(403);
  // R2 upload and branding round-trip, including centrally managed sponsorship.
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRz8AAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await admin.post('/api/media', {
    multipart: { file: { name: 'logo.png', mimeType: 'image/png', buffer: image } },
  });
  expect(upload.status()).toBe(201);
  const imageUrl = (await upload.json()).url;
  const media = await guest.get(imageUrl);
  expect(media.headers()['content-type']).toBe('image/png');
  expect(await media.body()).toEqual(image);
  expect(
    (
      await admin.patch('/api/restaurants', {
        data: {
          ...w.restaurant,
          id: rid,
          logo: imageUrl,
          ad_image: imageUrl,
          ad_title: 'Local sponsor',
          ad_url: 'https://example.com',
          theme: 'dark',
          color: '#563d74',
        },
      })
    ).status(),
  ).toBe(200);
  const branded = await (await guest.get(`/api/public?table=${w.tables[0].token}`)).json();
  expect(branded.restaurant).toMatchObject({
    logo: imageUrl,
    theme: 'dark',
    color: '#563d74',
    ad_title: 'Local sponsor',
    google_review_url: reviewUrl,
  });
  // Owners can manage their review link, without modifying another venue or platform ads.
  const ownerCredentials = {
    email: `owner-${suffix}@resqr.local`,
    password: randomBytes(20).toString('base64url'),
  };
  expect(
    (
      await admin.post('/api/staff', {
        data: { ...ownerCredentials, name: 'Mira', role: 'owner', restaurant_id: rid },
      })
    ).status(),
  ).toBe(201);
  const owner = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
  expect((await owner.post('/api/auth', { data: ownerCredentials })).status()).toBe(200);
  expect(
    (
      await owner.patch('/api/restaurants', {
        data: { ...branded.restaurant, id: other, slug: `corner-${suffix}` },
      })
    ).status(),
  ).toBe(403);
  const ownerContext = await browser.newContext({ storageState: await owner.storageState() });
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto('/dashboard');
  await ownerPage.getByRole('button', { name: 'Brand & settings' }).click();
  const ownerReviewUrl = 'https://search.google.com/local/writereview?placeid=ChIJTestRestaurant';
  await ownerPage.getByLabel('Google review link', { exact: true }).fill(ownerReviewUrl);
  await ownerPage.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(ownerPage.getByText('Saved', { exact: true })).toBeVisible();
  expect(
    (await (await guest.get(`/api/public?table=${w.tables[0].token}`)).json()).restaurant,
  ).toMatchObject({
    google_review_url: ownerReviewUrl,
    ad_title: 'Local sponsor',
    ad_image: imageUrl,
  });
  await ownerContext.close();
  await owner.dispose();
  // Product promotions scroll away; a separate ad slot follows four menu items.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/t/${w.tables[0].token}`);
  const menuHeading = page.getByRole('heading', { name: 'Menu', exact: true, level: 1 });
  await expect(menuHeading).toBeVisible();
  const reviewLink = page.getByRole('link', {
    name: 'Review Juniper Coffee House on Google (opens in a new tab)',
  });
  await expect(reviewLink).toHaveAttribute('href', ownerReviewUrl);
  await expect(reviewLink).toHaveAttribute('target', '_blank');
  await expect(reviewLink).toHaveAttribute('rel', 'noopener noreferrer');
  await page.context().route(ownerReviewUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Review destination</title>',
    }),
  );
  const reviewPopupPromise = page.waitForEvent('popup');
  await reviewLink.click();
  const reviewPopup = await reviewPopupPromise;
  await expect(reviewPopup).toHaveURL(ownerReviewUrl);
  await expect(page).toHaveURL(`http://localhost:3000/t/${w.tables[0].token}`);
  await reviewPopup.close();
  await page.context().unroute(ownerReviewUrl);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(reviewLink).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/customer-review-dark.png' });
  const projects = page.getByRole('complementary', { name: 'Our projects' });
  await expect(projects).toBeInViewport();
  await expect(projects.getByRole('link', { name: /resQR/ })).toHaveAttribute('href', '/');
  await expect(projects.getByText('Splitr', { exact: true })).toBeVisible();
  await expect(projects.getByText('Coming soon', { exact: true })).toBeVisible();
  const advertisement = page.getByRole('complementary', { name: 'Advertisement', exact: true });
  await expect(advertisement).toHaveCount(1);
  await expect(advertisement.getByText('Local sponsor', { exact: true })).toBeVisible();
  const fourthDish = page.locator('.customer-item').nth(3);
  expect((await advertisement.boundingBox())!.y).toBeGreaterThan(
    (await fourthDish.boundingBox())!.y,
  );
  expect((await menuHeading.boundingBox())!.y).toBeLessThan(150);
  await page.screenshot({ path: '.local/customer-sponsored-mobile.png', fullPage: true });
  await advertisement.scrollIntoViewIfNeeded();
  await expect(projects).not.toBeInViewport();
  await expect(reviewLink).not.toBeInViewport();
  await expect(page.getByRole('button', { name: 'Call waiter', exact: true })).toBeInViewport();
  // Restore the light menu for the customer screenshot.
  expect(
    (
      await admin.patch('/api/restaurants', {
        data: { ...w.restaurant, id: rid, google_review_url: '' },
      })
    ).status(),
  ).toBe(200);
  const spoof = await guest.post('/api/calls', {
    headers: { Origin: 'https://evil.example' },
    data: { token: w.tables[0].token },
  });
  expect(spoof.status()).toBe(403);
  const repeated = await Promise.all(
    Array.from({ length: 5 }, () =>
      guest.post('/api/calls', { data: { token: w.tables[0].token } }),
    ),
  );
  const ids = [];
  for (const response of repeated) {
    expect(response.status()).toBe(200);
    ids.push((await response.json()).call.id);
  }
  expect(new Set(ids).size).toBe(1);
  const callId = ids[0];
  expect(
    (
      await waiter.patch('/api/calls', {
        data: { id: callId, restaurant_id: other, status: 'acknowledged' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await waiter.patch('/api/calls', {
        data: { id: callId, restaurant_id: rid, status: 'acknowledged' },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await waiter.patch('/api/calls', {
        data: { id: callId, restaurant_id: rid, status: 'acknowledged' },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await waiter.patch('/api/calls', {
        data: { id: callId, restaurant_id: rid, status: 'completed' },
      })
    ).status(),
  ).toBe(200);
  expect((await guest.post('/api/calls', { data: { token: w.tables[0].token } })).status()).toBe(
    429,
  );
  // Real UI sessions: customer sees the acknowledgement only after staff acts.
  const staffContext = await browser.newContext({
    storageState: await waiter.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const staffPage = await staffContext.newPage();
  await staffPage.goto('/dashboard');
  await staffPage.getByRole('button', { name: 'Enable sound' }).click();
  await expect(staffPage.getByRole('button', { name: 'Sound on' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/t/${w.tables[1].token}`);
  await expect(page.getByRole('heading', { name: 'Menu', exact: true, level: 1 })).toBeVisible();
  await expect(reviewLink).toHaveCount(0);
  const emptyAd = page.getByRole('complementary', { name: 'Advertisement', exact: true });
  await expect(emptyAd).toHaveCount(1);
  await expect(emptyAd.locator('img')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search food and drinks' }).fill('no matching dish');
  await expect(page.getByRole('heading', { name: 'Nothing matches just yet.' })).toBeVisible();
  await expect(emptyAd).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search food and drinks' }).fill('');
  await page.getByRole('button', { name: 'Call waiter' }).click();
  await expect(page.getByText('Request sent', { exact: true })).toBeVisible();
  await expect(
    staffPage.getByRole('heading', { name: w.tables[1].label, exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await staffPage.getByRole('button', { name: 'I’ll take this' }).click();
  await expect(
    page.getByText('A waiter has acknowledged your request', { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await staffPage.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByText('All taken care of?', { exact: true })).toBeVisible({
    timeout: 15000,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: '.local/customer-mobile.png', fullPage: true });
  await staffPage.screenshot({ path: '.local/staff-dashboard.png', fullPage: true });
  // A status GET begun before a call must not erase the newly sent request.
  let releaseStatus!: () => void;
  let statusCaptured!: () => void;
  const statusReady = new Promise<void>((resolve) => {
    statusCaptured = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  await page.route(
    `**/api/calls?table=${w.tables[2].token}`,
    async (route) => {
      const oldStatus = await route.fetch();
      statusCaptured();
      await release;
      await route.fulfill({ response: oldStatus });
    },
    { times: 1 },
  );
  await page.goto(`/t/${w.tables[2].token}`);
  await statusReady;
  await page.getByRole('button', { name: 'Call waiter' }).click();
  await expect(page.getByText('Request sent', { exact: true })).toBeVisible();
  const staleResponse = page.waitForResponse(
    (r) =>
      r.request().method() === 'GET' && r.url().endsWith(`/api/calls?table=${w.tables[2].token}`),
  );
  releaseStatus();
  await staleResponse;
  await expect(page.getByRole('button', { name: 'Called', exact: true })).toBeDisabled();
  expect(
    (await (await guest.get(`/api/calls?table=${w.tables[2].token}`)).json()).call.status,
  ).toBe('pending');
  const adminContext = await browser.newContext({
    storageState: await admin.storageState(),
    viewport: { width: 1440, height: 1000 },
  });
  const adminPage = await adminContext.newPage();
  // The public page stays a homepage, including for signed-in administrators.
  await adminPage.goto('/');
  await expect(adminPage.getByRole('heading', { level: 1 })).toContainText('Good service.');
  await page.setExtraHTTPHeaders({ 'cf-connecting-ip': `lead-${suffix}` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page).toHaveURL('http://localhost:3000/');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await page.screenshot({ path: '.local/home-desktop.png', fullPage: true });
  for (const width of [390, 375, 320, 820]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/home-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Bring resQR to your place' }).click();
  await page.getByLabel('Your name', { exact: true }).fill(inquiry.name);
  await page.getByLabel('Restaurant / café name', { exact: true }).fill(inquiry.restaurant);
  await page.getByLabel('City or area', { exact: true }).fill(inquiry.location);
  await page.getByLabel('Phone number', { exact: true }).fill(inquiry.phone);
  await page.getByLabel('Email (optional)').fill(inquiry.email);
  await page.getByLabel('Anything you’d like us to know?').fill(inquiry.message);
  await page.route(
    '**/api/inquiries',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Please try again.' }),
      }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Let’s get your place connected' }).click();
  await expect(
    page.getByRole('form', { name: 'Restaurant setup request' }).getByRole('alert'),
  ).toHaveText('Please try again.');
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue(inquiry.name);
  await expect(page.getByText('You’re on our list.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Let’s get your place connected' }).click();
  await expect(page.getByText('You’re on our list.')).toBeVisible();
  await expect(page.getByRole('status')).toBeFocused();
  const saved = (await (await admin.get('/api/inquiries')).json()).inquiries.find(
    (item: { restaurant: string }) => item.restaurant === inquiry.restaurant,
  );
  expect(saved).toMatchObject({ ...inquiry, status: 'new' });
  expect(
    (
      await waiter.patch('/api/inquiries', { data: { id: saved.id, status: 'contacted' } })
    ).status(),
  ).toBe(403);
  await adminPage.goto('/dashboard');
  await expect(adminPage.getByRole('heading', { name: 'Your restaurants.' })).toBeVisible();
  await expect(adminPage.locator('.restaurant-card').first()).toBeVisible();
  await adminPage.screenshot({ path: '.local/admin-dashboard.png', fullPage: true });
  await adminPage.getByRole('button', { name: 'Add restaurant', exact: true }).click();
  await adminPage.getByLabel('Restaurant name', { exact: true }).fill('Little Fern');
  await expect(adminPage.getByLabel('Menu URL name')).toHaveValue('little-fern');
  await adminPage.getByRole('button', { name: 'Close dialog' }).click();
  await adminPage.getByRole('button', { name: 'Setup requests', exact: true }).click();
  const inquiryCard = adminPage
    .locator('.inquiry-card')
    .filter({ has: adminPage.getByRole('heading', { name: inquiry.restaurant, exact: true }) });
  await expect(inquiryCard).toContainText(inquiry.message);
  await inquiryCard.getByRole('button', { name: 'Mark contacted', exact: true }).click();
  await expect(inquiryCard.getByText('Contacted', { exact: true })).toBeVisible();
  expect(
    (await (await admin.get('/api/inquiries')).json()).inquiries.find(
      (item: { id: number }) => item.id === saved.id,
    ).status,
  ).toBe('contacted');
  await adminPage.screenshot({ path: '.local/setup-inbox.png', fullPage: true });
  await adminPage.goto(`/print?restaurant=${rid}`);
  await expect(adminPage.getByRole('button', { name: 'Print / Save PDF' })).toBeVisible();
  expect(await adminPage.locator('.print-qr').count()).toBe(12);
  await adminPage.emulateMedia({ media: 'print' });
  await adminPage.pdf({
    path: '.local/sample-table-cards.pdf',
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  writeFileSync(
    '.local/pilot-access.md',
    `# Local pilot\n\nOpen http://localhost:3000/login\n\nAdmin email: ${credentials.email}\nAdmin password: ${credentials.password}\n\nWaiter email: ${waiterCredentials.email}\nWaiter password: ${waiterCredentials.password}\n\nCustomer: http://localhost:3000/t/${w.tables[1].token}\n\nThese accounts exist only in the local development database.\n`,
  );
  await adminContext.close();
  await staffContext.close();
  await admin.dispose();
  await waiter.dispose();
  await guest.dispose();
});

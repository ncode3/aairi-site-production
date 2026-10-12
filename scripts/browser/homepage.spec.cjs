const { test, expect } = require('@playwright/test');

test('homepage responds under CPU pressure and keeps video downloads opt-in', async ({ page, context }) => {
  const errors = [];
  const videoRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\.mp4(?:\?|$)/.test(request.url())) videoRequests.push(request.url());
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('#upcoming-events-grid article')).toHaveCount(3);
  const energy = page.locator('.stack-card').first();
  await energy.scrollIntoViewIfNeeded();
  await energy.click();
  await expect(energy).toHaveAttribute('aria-expanded', 'true');
  for (let sample = 0; sample < 3; sample++) {
    const delay = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now();
      setTimeout(() => resolve(performance.now() - start), 100);
    }));
    expect(delay, 'browser main thread stalled').toBeLessThan(1500);
  }
  expect(videoRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('homepage stays readable while the icon library is stalled', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/vendor/lucide.min.js', async route => {
    await gate;
    await route.abort();
  });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('a[href="apply.html"]').first()).toBeVisible();
  } finally {
    release();
  }
  await page.waitForLoadState('domcontentloaded');
  const energy = page.locator('.stack-card').first();
  await energy.scrollIntoViewIfNeeded();
  await energy.click();
  await expect(energy).toHaveAttribute('aria-expanded', 'true');
});

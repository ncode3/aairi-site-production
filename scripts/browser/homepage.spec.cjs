const { test, expect } = require('@playwright/test');

async function expectTeachingStack(page) {
  const stack = page.locator('#stack');
  await stack.scrollIntoViewIfNeeded();
  await expect(stack.getByRole('heading', { level: 2 })).toHaveText('We start at the bottom of the stack.');
  const layers = stack.locator('.learning-layer');
  await expect(layers.locator('h3')).toHaveText([
    'Applications and agents', 'AI models', 'Runtimes', 'Compute', 'Physical infrastructure'
  ]);
  for (const layer of await layers.all()) {
    await expect(layer).toBeVisible();
    await expect(layer.locator('p')).toBeVisible();
  }
  const foundation = layers.last();
  await expect(foundation).toHaveClass(/learning-foundation/);
  await expect(foundation.locator('.learning-start')).toContainText('Students start here');
  const bounds = await layers.evaluateAll(items => items.map(item => {
    const rect = item.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
  }));
  const width = page.viewportSize().width;
  bounds.forEach((rect, index) => {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(width);
    if (index) expect(rect.top).toBeGreaterThanOrEqual(bounds[index - 1].bottom);
  });
}

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
  await expect(page.locator('#upcoming-events-grid')).not.toBeEmpty();
  await expectTeachingStack(page);
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
    await expect(page.locator('#programs a[href="apply.html"]').first()).toBeVisible();
  } finally {
    release();
  }
  await page.waitForLoadState('domcontentloaded');
  await expectTeachingStack(page);
});

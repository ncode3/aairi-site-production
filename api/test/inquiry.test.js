const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../submit-inquiry');

function validBody() {
  return {
    full_name: 'Test Person', email: 'test@example.org', organization: 'Example School',
    inquiry_type: 'Partnership', reason_for_inquiry: 'Learning programs',
    goal: 'Student workshops', timeline: 'Next semester', contact_policy_confirm: 'yes',
    message: 'We would like to discuss a student learning program.',
    form_rendered_at: String(Date.now() - 10000), form_name: 'Test inquiry'
  };
}

async function invoke(body, options = {}) {
  const messages = [];
  const log = (message) => messages.push(message);
  log.warn = log; log.error = log;
  const context = { log };
  await handler(context, { method: 'POST', headers: { 'content-type': 'application/json' }, body, ...options });
  return { ...context.res, messages };
}

test('rejects malformed, oversized, and non-JSON submissions before delivery', async () => {
  assert.equal((await invoke(validBody(), { method: 'GET' })).status, 405);
  assert.equal((await invoke(validBody(), { headers: { 'content-type': 'text/plain' } })).status, 415);
  for (const body of [null, [], 'a string', 42]) assert.equal((await invoke(body)).status, 400);
  assert.equal((await invoke({ ...validBody(), extra: 'x'.repeat(32769) })).status, 413);
  for (const field of ['email', 'organization', 'goal', 'timeline', 'page_url', 'utm_source']) {
    assert.equal((await invoke({ ...validBody(), [field]: 'x'.repeat(3000) })).status, 400);
  }
});

test('valid inquiry keeps the existing mailto fallback without calling external services', async () => {
  for (const key of ['CONTACT_WEBHOOK_URL', 'SENDGRID_API_KEY', 'AZURE_FRONT_DOOR_ID']) delete process.env[key];
  const result = await invoke(validBody());
  assert.equal(result.status, 200);
  assert.match(result.body.mailto, /^mailto:/);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.delivered, false);
  assert.match(result.body.message, /has not been sent yet/);
});

test('honeypot is rejected without logging IP addresses or query strings', async () => {
  const result = await invoke({ ...validBody(), company_website: 'spam', page_url: 'https://example.org/?secret=private' }, {
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.12' }
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.mailto, undefined);
  assert.ok(!result.messages.join('').includes('192.0.2.12'));
  assert.ok(!result.messages.join('').includes('private'));
});

test('rate limiter expires entries and caps memory without evicting active limits', () => {
  const limited = handler._private.isRateLimited;
  const now = Date.now() + 600000;
  assert.equal(limited('repeat', now), false);
  assert.equal(limited('repeat', now), false);
  assert.equal(limited('repeat', now), false);
  assert.equal(limited('repeat', now), true);
  for (let i = 0; i < 9999; i++) limited(`client-${i}`, now);
  assert.equal(limited('new-client', now), true);
  assert.equal(limited('new-client', now + 600001), false);
});

test('webhook delivery requires HTTPS, blocks redirects, and sets a timeout', async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => { captured = { url, options }; return { ok: true }; };
  try {
    process.env.CONTACT_WEBHOOK_URL = 'https://example.org/intake';
    const result = await invoke(validBody(), { headers: { 'content-type': 'application/json', 'x-client-ip': 'webhook-test' } });
    assert.equal(result.status, 200);
    assert.equal(captured.options.redirect, 'error');
    assert.ok(captured.options.signal instanceof AbortSignal);
    captured = null;
    process.env.CONTACT_WEBHOOK_URL = 'http://example.org/intake';
    const rejected = await invoke(validBody(), { headers: { 'content-type': 'application/json', 'x-client-ip': 'http-test' } });
    assert.equal(rejected.status, 500);
    assert.equal(captured, null);
    assert.ok(!rejected.messages.join('').includes('http://'));
  } finally {
    global.fetch = originalFetch;
    delete process.env.CONTACT_WEBHOOK_URL;
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const dist = path.join(root, 'dist');

// Inspect repository-authored build output; this is not an HTML sanitizer.
function scriptTags(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)];
}

test('script inspection includes browser-accepted closing tag variants', () => {
  for (const close of ['</script>', '</script >', '</script\n>', '</SCRIPT\t>', '</script ignored>']) {
    const tags = scriptTags(`<script>unexpectedInlineCode()${close}`);
    assert.equal(tags.length, 1, `missed ${JSON.stringify(close)}`);
    assert.match(tags[0][2], /unexpectedInlineCode\(\)/);
  }
});

test('every published page uses local, existing scripts and compiled styles', () => {
  const pages = fs.readdirSync(dist).filter(name => name.endsWith('.html'));
  assert.ok(pages.length >= 18);
  for (const name of pages) {
    const html = fs.readFileSync(path.join(dist, name), 'utf8');
    for (const match of scriptTags(html)) {
      assert.equal(match[2].trim(), '', `${name}: inline executable script`);
      const src = match[1].match(/\bsrc="([^"]+)"/);
      assert.ok(src && src[1].startsWith('assets/'), `${name}: external script`);
      assert.ok(fs.existsSync(path.join(dist, src[1])), `${name}: missing ${src?.[1]}`);
    }
    assert.doesNotMatch(html, /\son\w+\s*=/i, `${name}: inline handler`);
    assert.doesNotMatch(html, /googletagmanager|googleadservices|cdn\.tailwindcss|unpkg\.com/);
    assert.ok(fs.statSync(path.join(dist, 'assets/css/pages', name.replace('.html', '.css'))).size > 1000);
  }
});

test('script policy rejects inline execution and remote dependencies', () => {
  const config = JSON.parse(fs.readFileSync(path.join(dist, 'staticwebapp.config.json')));
  const csp = config.globalHeaders['Content-Security-Policy'];
  assert.match(csp, /(?:^|;) script-src 'self';/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.equal(config.routes.some(route => route.route === '/api/impact'), false);
});

test('student form and application fallback survive the build', () => {
  const html = fs.readFileSync(path.join(dist, 'apply.html'), 'utf8');
  assert.match(html, /<iframe[^>]*src="https:\/\/form.jotform.com\/262534604751052"/);
  assert.match(html, /<a[^>]*href="https:\/\/form.jotform.com\/262534604751052"/);
  for (const name of ['README.md', 'infra', '.github', 'api', 'config', 'node_modules']) {
    assert.equal(fs.existsSync(path.join(dist, name)), false);
  }
});

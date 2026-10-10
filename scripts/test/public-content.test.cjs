const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.resolve(__dirname, '../../dist');
const read = name => fs.readFileSync(path.join(dist, name), 'utf8');

test('homepage leads with Microsoft and three audience paths without duplicated evidence or forms', () => {
  const home = read('index.html');
  assert.match(home, /Microsoft Community Affairs awarded AARI \$35,000/);
  for (const audience of ['Students &amp; Families', 'Funders', 'Partners']) assert.ok(home.includes(audience));
  assert.match(home, /Eight scholars completed the Summer 2026 cohort/);
  assert.equal((home.match(/483/g) || []).length, 1);
  assert.equal((home.match(/<form\b/g) || []).length, 1);
  assert.doesNotMatch(home, /\$115,000|83%|five of six|September 2026|Loading upcoming events/);
});

test('dated events, event photos and grant partners are present before JavaScript executes', () => {
  const page = read('events.html');
  const events = JSON.parse(read('assets/data/events.json'));
  for (const event of events) {
    assert.ok(page.includes(`id="event-${event.id}"`));
    for (const photo of event.photos || []) {
      assert.ok(page.includes(photo.src));
      assert.ok(fs.existsSync(path.join(dist, photo.src)));
    }
  }
  assert.ok(events.some(e => e.date === '2026-10-30' && e.title.includes('MIT')));
  assert.ok(events.some(e => e.date === '2026-10-31' && e.title.includes('Microsoft')));
  const partners = read('partners.html');
  assert.match(partners, /Microsoft Community Affairs awarded AARI \$35,000/);
  assert.match(partners, /<article class="partner-slide"/);
});

test('both testimonial videos include local captions and readable transcripts', () => {
  const impact = read('impact.html');
  assert.equal((impact.match(/kind="captions"/g) || []).length, 2);
  for (const match of impact.matchAll(/<track[^>]*src="([^"]+)"/g)) assert.match(read(match[1]), /^WEBVTT/);
  assert.equal((impact.match(/Automatically transcribed/g) || []).length, 2);
});

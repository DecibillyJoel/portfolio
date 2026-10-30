import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? collect(full) : [readFileSync(full, 'utf8')];
  });
}

// Astro bundles component <script> into separate files and may split CSS too.
// readDist() concatenates every built file, so JS and CSS assertions work.
export function readDist() {
  return collect(DIST).join('\n');
}

export function readIndex() {
  return readFileSync(join(DIST, 'index.html'), 'utf8');
}

test('build emits a static index.html', () => {
  assert.match(readIndex(), /<!doctype html>/i);
});

test('page mounts all three panels in one document', () => {
  const html = readIndex();
  assert.match(html, /data-panel="who-am-i"/);
  assert.match(html, /data-panel="links"/);
  assert.match(html, /data-panel="projects"/);
  assert.equal((html.match(/<html/g) || []).length, 1);
});

test('tab bar exposes the three full labels', () => {
  const html = readIndex();
  assert.match(html, /data-tab-target="who-am-i"[^>]*>\s*Who Am I/);
  assert.match(html, /data-tab-target="links"[^>]*>\s*Links/);
  assert.match(html, /data-tab-target="projects"[^>]*>\s*Projects/);
});

test('exactly one panel starts visible', () => {
  const html = readIndex();
  const hiddenCount = (html.match(/data-panel="[^"]+"[^>]*hidden/g) || []).length;
  assert.equal(hiddenCount, 2);
});

test('Who Am I carries the three approved paragraphs', () => {
  const html = readIndex();
  assert.match(html, /I'm a music, audio, and game design enthusiast\./);
  assert.match(html, /CompTIA A\+ certified\. I've built many personal game dev and programming projects over the years, driven by my own interests\./);
  assert.match(html, /I'm now using those skills and interests to bring power and togetherness to indie artists and creators\./);
});

test('Links lists eight entries, each with an icon', () => {
  const html = readIndex();
  const labels = ['GITHUB', 'YOUTUBE', 'X', 'BLUESKY', 'LIVE365', 'LAST.FM', 'EMAIL', 'DISCORD'];
  for (const label of labels) assert.match(html, new RegExp(`>\\s*${label.replace('.', '\\.')}<`));
  assert.equal((html.match(/class="icon"/g) || []).length, labels.length);
});

test('no link renders as a pending placeholder', () => {
  const html = readIndex();
  assert.doesNotMatch(html, /class="card pending"/);
});

test('live links point at the approved URLs', () => {
  const html = readIndex();
  assert.match(html, /href="https:\/\/github\.com\/DecibillyJoel"/);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/@JoeOfSomeTrades"/);
  assert.match(html, /href="https:\/\/x\.com\/JoeOfManyTrades"/);
  assert.match(html, /href="https:\/\/www\.last\.fm\/user\/DecibillyJoel"/);
  assert.match(html, /href="https:\/\/bsky\.app\/profile\/joeofsometrades\.bsky\.social"/);
  assert.match(html, /href="https:\/\/live365\.com\/station\/a57727"/);
  assert.match(html, /href="mailto:joeofsometrades@outlook\.com"/);
  assert.match(html, /href="https:\/\/discord\.com\/users\/152963830350217217"/);
});

test('header merges the brand, tabs, and a status badge indicator', () => {
  const html = readIndex();
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.match(header, /<h1[^>]*>@JoeOfSomeTrades<\/h1>/);
  assert.match(header, /data-tab-target="projects"/);
  assert.match(header, /<span[^>]*data-on-air[^>]*data-state="off"[^>]*role="status"[^>]*>\s*\[ OFF AIR \]/);
  assert.doesNotMatch(header, /data-on-air[^>]*(href|aria-disabled|data-clickable)/);
});

test('the status badge knows all four states and reacts to tab changes', () => {
  const js = readDist();
  for (const label of ['[ OFF AIR ]', '[ ON AIR ]', '[ GAME RUNNING ]', '[ GAME PAUSED ]']) {
    assert.ok(js.includes(label), `missing ${label}`);
  }
  assert.match(js, /tabs:change/);
});

test('every tab and sub-tab is a native link with its own hash', () => {
  const html = readIndex();
  const links = [
    ['data-tab-target="who-am-i"', '#whoami'],
    ['data-tab-target="links"', '#links'],
    ['data-tab-target="projects"', '#projects'],
    ['data-sub-tab-target="maximum-slappage"', '#radio'],
    ['data-sub-tab-target="smiles"', '#game'],
  ];
  for (const [attr, hash] of links) {
    assert.match(html, new RegExp(`<a[^>]*${attr}[^>]*href="${hash}"`), `missing ${attr} to ${hash}`);
  }
});

test('hash routing drives the view and browser history', () => {
  const js = readDist();
  assert.match(js, /addEventListener\(\s*[`'"]hashchange[`'"]/);
  assert.match(js, /replaceState/);
  assert.match(js, /a\[data-hash\]/);
});

test('projects expose two sub-tabs and two lazy project blocks', () => {
  const html = readIndex();
  assert.match(html, /data-sub-tab-target="maximum-slappage"/);
  assert.match(html, /data-sub-tab-target="smiles"/);
  assert.equal((html.match(/data-project="/g) || []).length, 2);
  assert.equal((html.match(/data-project="[^"]+"[^>]*hidden/g) || []).length, 2);
  assert.match(html, /data-project-empty[^>]*>\s*Select a project above\./);
});

test('hidden project blocks are display:none, not flex', () => {
  const css = readDist();
  assert.match(css, /\.project\[data-astro-cid-[a-z0-9]+\]\[hidden\]\s*\{\s*display:\s*none/);
});

test('Smiles Sadistic Adventure carries its embed and GitHub link', () => {
  const html = readIndex();
  assert.match(html, /data-src="https:\/\/decibillyjoel\.github\.io\/Smiles-Sadistic-Adventure\/"/);
  assert.match(html, /href="https:\/\/github\.com\/DecibillyJoel\/Smiles-Sadistic-Adventure"/);
  assert.match(html, /An endless semi-random bullet hell I created in high school\./);
});

test('player holds both embed sizes and lazy iframes carry no src', () => {
  const html = readIndex();
  assert.match(html, /data-src-xl="https:\/\/live365\.com\/embeds\/v1\/player\/a57727\?s=xl&amp;m=dark&amp;c=aac"/);
  assert.match(html, /data-src-sm="https:\/\/live365\.com\/embeds\/v1\/player\/a57727\?s=sm&amp;m=dark&amp;c=aac"/);
  assert.equal((html.match(/data-loaded="false"/g) || []).length, 2);
  assert.doesNotMatch(html, /<iframe[^>]*\ssrc=/);
});

test('player chooses the embed size once, not on resize', () => {
  const js = readDist();
  assert.match(js, /matchMedia\(\s*[`'"]\(min-width: 900px\)[`'"]\s*\)/);
  assert.doesNotMatch(js, /addEventListener\([`'"]resize[`'"]/);
});

test('the mobile layout block exists', () => {
  assert.match(readDist(), /max-width:\s*899px|width\s*<=\s*899px/);
});

test('inactive panels are hidden, never removed', () => {
  const js = readDist();
  assert.match(js, /\.hidden\s*=/);
  assert.doesNotMatch(js, /removeChild|\.innerHTML\s*=/);
});

test('robots.txt and llms.txt ship with the site', () => {
  const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);

  const llms = readFileSync(join(DIST, 'llms.txt'), 'utf8');
  assert.match(llms, /^# @JoeOfSomeTrades$/m);
  for (const route of ['#whoami', '#links', '#projects', '#radio', '#game']) {
    assert.ok(llms.includes(route), `llms.txt is missing ${route}`);
  }
});

test('sitemap.xml ships and robots.txt points at it', () => {
  const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, /<loc>https:\/\/portfolio\.joeofsometrades\.workers\.dev\/<\/loc>/);

  const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
  assert.match(
    robots,
    /^Sitemap: https:\/\/portfolio\.joeofsometrades\.workers\.dev\/sitemap\.xml$/m,
  );
});

test('a real 404 page ships and points back at every view', () => {
  const notFound = readFileSync(join(DIST, '404.html'), 'utf8');
  assert.match(notFound, /404 — NO SIGNAL/);
  assert.equal((notFound.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((notFound.match(/<h2[\s>]/g) || []).length, 1);
  assert.match(notFound, /<main id="main" tabindex="-1"[^>]*>/);
  assert.match(notFound, /<a class="skip-link" href="#main"[^>]*>/);
  for (const route of ['/#whoami', '/#links', '/#projects', '/#radio', '/#game']) {
    assert.ok(notFound.includes(`href="${route}"`), `404.html is missing ${route}`);
  }
  // The 404 page renders no tab bar, so it must not reference panels that only
  // index.html provides.
  assert.doesNotMatch(notFound, /role="tablist"|aria-controls|data-tab-target|data-sub-tab-target/);

  const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(wrangler, /"not_found_handling"\s*:\s*"404-page"/);
  assert.doesNotMatch(wrangler, /single-page-application/);
});

test('the page has one h1, a skip link, and a focusable main landmark', () => {
  const html = readIndex();
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((html.match(/<h2[\s>]/g) || []).length, 3);
  assert.match(html, /<a class="skip-link" href="#main">/);
  assert.match(html, /<main id="main" tabindex="-1">/);
});

test('tablists use roving tabindex, arrow keys, and paired roles', () => {
  const html = readIndex();
  assert.equal((html.match(/<[a-z]+[^>]*role="tablist"/g) || []).length, 2);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 5);
  assert.equal((html.match(/role="tab"/g) || []).length, 5);
  assert.match(html, /id="subtab-maximum-slappage"[^>]*aria-controls="project-maximum-slappage"/);
  assert.match(
    html,
    /id="project-smiles"[^>]*role="tabpanel"[^>]*aria-labelledby="subtab-smiles"/,
  );

  const js = readDist();
  assert.match(js, /ArrowRight/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /tabIndex/);
  assert.match(js, /new Set\(\[[`'"]main[`'"]\]\)/);
});

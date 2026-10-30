import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

test('page mounts all four panels in one document', () => {
  const html = readIndex();
  assert.match(html, /data-panel="who-am-i"/);
  assert.match(html, /data-panel="links"/);
  assert.match(html, /data-panel="certifications"/);
  assert.match(html, /data-panel="projects"/);
  assert.equal((html.match(/<html/g) || []).length, 1);
});

test('tab bar exposes the four full labels', () => {
  const html = readIndex();
  assert.match(html, /data-tab-target="who-am-i"[^>]*>\s*Who Am I/);
  assert.match(html, /data-tab-target="links"[^>]*>\s*Links/);
  assert.match(html, /data-tab-target="certifications"[^>]*>\s*Certifications/);
  assert.match(html, /data-tab-target="projects"[^>]*>\s*Projects/);
});

test('exactly one panel starts visible', () => {
  const html = readIndex();
  const hiddenCount = (html.match(/data-panel="[^"]+"[^>]*hidden/g) || []).length;
  assert.equal(hiddenCount, 3);
});

test('Who Am I carries the three approved paragraphs', () => {
  const html = readIndex();
  assert.match(html, /I'm an enthusiast of all things IT, music, audio, and game design and development\./);
  assert.match(html, /I've built many personal game dev and programming projects over the years, driven by my own interests\./);
  assert.match(html, /I'm now using those skills and interests to bring power and togetherness to indie artists and creators\./);
});

test('Links lists eight entries, each with an icon', () => {
  const html = readIndex();
  const labels = ['GITHUB', 'YOUTUBE', 'X', 'BLUESKY', 'LIVE365', 'LAST.FM', 'EMAIL', 'DISCORD'];
  for (const label of labels) assert.match(html, new RegExp(`>\\s*${label.replace('.', '\\.')}<`));
  assert.equal((html.match(/class="icon"/g) || []).length, labels.length);
});

test('Certifications lists four credentials with dates and official pages', () => {
  const html = readIndex();
  const panel = html.match(/data-panel="certifications"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.notEqual(panel, '');
  const expected = [
    ['CompTIA A+', 'CompTIA', 'Sep 2026 – Sep 2029', 'https://www.comptia.org/certifications/a'],
    [
      'Microsoft Office Specialist: Excel Expert (Microsoft 365 Apps)',
      'Microsoft',
      'Mar 2024',
      'https://learn.microsoft.com/en-us/credentials/certifications/mos-excel-expert-m365-apps/',
    ],
    [
      'MTA: Windows Operating System Fundamentals',
      'Microsoft',
      'Dec 2016',
      'https://learn.microsoft.com/en-us/credentials/certifications/exams/98-349',
    ],
    [
      'Autodesk AutoCAD Certified User',
      'Autodesk',
      'Jan 2016',
      'https://certiport.pearsonvue.com/Certifications/Autodesk/Certifications/Certify#AutoCAD',
    ],
  ];
  for (const [name, issuer, dates, href] of expected) {
    assert.ok(panel.includes(name), `missing certification ${name}`);
    assert.ok(panel.includes(issuer), `missing issuer ${issuer}`);
    assert.ok(panel.includes(dates), `missing dates ${dates}`);
    assert.ok(panel.includes(`href="${href}"`), `missing page ${href}`);
  }
  assert.equal((panel.match(/<h3[\s>]/g) || []).length, 4);
  // The LinkedIn note is prose on the page, but LinkedIn itself must not be linked.
  assert.match(panel, /The credential links are omitted from here, but you can find them on my LinkedIn page\./);
  assert.doesNotMatch(panel, /href="https?:\/\/(www\.)?linkedin\.com/);
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
    ['data-tab-target="certifications"', '#certs'],
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

test('projects expose three sub-tabs and three lazy project blocks', () => {
  const html = readIndex();
  assert.match(html, /data-sub-tab-target="maximum-slappage"/);
  assert.match(html, /data-sub-tab-target="portfolio"/);
  assert.match(html, /data-sub-tab-target="smiles"/);
  assert.equal((html.match(/data-project="/g) || []).length, 3);
  assert.equal((html.match(/data-project="[^"]+"[^>]*hidden/g) || []).length, 3);
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
  for (const route of ['#whoami', '#links', '#certs', '#projects', '#radio', '#game']) {
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
  for (const route of ['/#whoami', '/#links', '/#certs', '/#projects', '/#radio', '/#game']) {
    assert.ok(notFound.includes(`href="${route}"`), `404.html is missing ${route}`);
  }
  // The 404 page renders no tab bar, so it must not reference panels that only
  // index.html provides.
  assert.doesNotMatch(notFound, /role="tablist"|aria-controls|data-tab-target|data-sub-tab-target/);

  const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(wrangler, /"not_found_handling"\s*:\s*"404-page"/);
  assert.doesNotMatch(wrangler, /single-page-application/);
});

test('the critical stylesheet is inlined, so nothing blocks the first render', () => {
  const html = readIndex();
  assert.doesNotMatch(html, /rel="stylesheet"/);
  assert.doesNotMatch(html, /\/_astro\//);
  assert.match(html, /<style>[\s\S]*--hover:/);
  assert.equal(existsSync(join(DIST, '_astro')), false);
});

test('both header marks use the small WebP mark and keep the PNG favicon', () => {
  for (const doc of ['index.html', '404.html']) {
    const html = readFileSync(join(DIST, doc), 'utf8');
    assert.match(
      html,
      /<img class="monogram" src="\/monogram\.webp"/,
      `${doc} still loads the old header mark`,
    );
    assert.match(
      html,
      /<link rel="icon" type="image\/png" href="\/favicon\.png">/,
      `${doc} lost its favicon`,
    );
  }
});

test('_headers ships the security headers and no CSP', () => {
  const headers = readFileSync(join(DIST, '_headers'), 'utf8');
  assert.match(headers, /^\/\*$/m);
  for (const name of [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'X-Frame-Options',
    'Cross-Origin-Opener-Policy',
  ]) {
    assert.ok(headers.includes(`${name}:`), `_headers is missing ${name}`);
  }
  assert.doesNotMatch(headers, /Content-Security-Policy/);
});

test('the page has one h1, a skip link, and a focusable main landmark', () => {
  const html = readIndex();
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((html.match(/<h2[\s>]/g) || []).length, 5);
  assert.match(html, /<a class="skip-link" href="#main">/);
  assert.match(html, /<main id="main" tabindex="-1">/);
});

test('tablists use roving tabindex, arrow keys, and paired roles', () => {
  const html = readIndex();
  assert.equal((html.match(/<[a-z]+[^>]*role="tablist"/g) || []).length, 2);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 7);
  assert.equal((html.match(/role="tab"/g) || []).length, 7);
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

test('the embed wrappers carry the focus ring attribute', () => {
  const js = readDist();
  assert.match(js, /\[data-embed-focus[^\]]*\]/);
  assert.match(js, /outline: ?2px solid var\(--magenta\)/);
  assert.match(js, /dataset\.embedFocus/);
});

test('the Portfolio project sits between the radio and the game and carries the repo link', () => {
  const html = readIndex();
  const order = [...html.matchAll(/data-project="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['maximum-slappage', 'portfolio', 'smiles']);
  const subTabOrder = [...html.matchAll(/data-sub-tab-target="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(subTabOrder, ['maximum-slappage', 'portfolio', 'smiles']);
  assert.match(html, /id="subtab-portfolio"[^>]*data-hash="portfolio"[^>]*href="#portfolio"/);
  assert.match(html, /id="project-portfolio"[^>]*role="tabpanel"[^>]*aria-labelledby="subtab-portfolio"/);
  assert.match(html, /class="project-link" href="https:\/\/github\.com\/DecibillyJoel\/portfolio"[^>]*tabindex="0"/);
  assert.match(html, /Cloudflare Workers with Static Assets/);
  const panel = html.slice(html.indexOf('id="project-portfolio"'), html.indexOf('id="project-smiles"'));
  assert.ok(!panel.includes('iframe'), 'the Portfolio project must carry no embed');
});

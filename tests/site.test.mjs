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

// Astro inlines the component script while it stays under the inline limit in
// astro.config.mjs, and writes it to dist/_astro when it grows past it. Read
// the script from either place.
export function readScripts() {
  const dir = join(DIST, '_astro');
  if (existsSync(dir)) return collect(dir).join('\n');
  return (readIndex().match(/<script[^>]*>[\s\S]*?<\/script>/g) || []).join('\n');
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
  // Four tab panels start hidden. The not-found panel starts hidden too, so a
  // link without a hash shows the default view.
  assert.equal(hiddenCount, 4);
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
  assert.match(panel, /These are all the certifications I've earned so far\./);
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
  assert.match(notFound, /404 - Dead Air/);
  assert.match(notFound, /Signal lost\. Tune in to an active frequency below:/);
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
  assert.equal((html.match(/<h2[\s>]/g) || []).length, 6);
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
  assert.match(html, /class="project-link" href="https:\/\/github\.com\/DecibillyJoel\/portfolio"[^>]*>View on GitHub<\/a>/);
  assert.ok(!/class="project-link"[^>]*tabindex/.test(html), 'the project link takes no tabindex');
  assert.match(html, /Cloudflare Workers with Static Assets/);
  const panel = html.slice(html.indexOf('id="project-portfolio"'), html.indexOf('id="project-smiles"'));
  assert.ok(!panel.includes('iframe'), 'the Portfolio project must carry no embed');
});

test('every project carries one blurb and no screen-size text swap', () => {
  const html = readIndex();
  assert.equal((html.match(/class="blurb"/g) || []).length, 3);
  assert.ok(!/blurb-narrow|blurb-wide|blurbNarrow|blurbWide/.test(html), 'no narrow or wide blurb class');
  const js = readDist();
  assert.ok(!/blurbNarrow|blurbWide/.test(js), 'no narrow blurb in the bundle');
});

test('the shell locks the page height and scrolls inside each panel', () => {
  const html = readIndex();
  const css = readDist();

  assert.match(css, /body\{[^}]*height:100vh/, 'the shell keeps a 100vh fallback');
  assert.match(css, /@supports \(height:100dvh\)\{body\{height:100dvh\}\}/, 'the shell upgrades to 100dvh');
  assert.match(css, /body\{[^}]*display:flex/, 'the shell is a flex column');
  assert.match(css, /body\{[^}]*overflow:hidden/, 'the page itself never scrolls');
  assert.match(css, /body\{[^}]*overscroll-behavior-y:none/, 'the page does not chain its scroll');

  assert.match(css, /main\{[^}]*min-height:0/, 'main gives up its content height');
  assert.match(css, /main>\[data-panel\]\{[^}]*overflow-y:auto/, 'each panel scrolls');
  assert.match(css, /main>\[data-panel\]\{[^}]*min-height:0/, 'each panel gives up its content height');
  assert.match(css, /main>\[data-panel\]:focus-visible\{outline-offset:-2px\}/, 'the panel ring sits inside the panel');

  assert.equal((html.match(/<section id="panel-[a-z-]+"[^>]*tabindex="0"/g) || []).length, 4,
    'every panel except projects is focusable, so its scroll region is reachable by keyboard');
  assert.match(html, /<div class="projects-scroll" tabindex="0"/,
    'the projects panel hands that focus target to its scroll body');
});

test('the sub-tab bar sits outside the projects scroll area', () => {
  const html = readIndex();

  const tabs = html.match(/\.sub-tabs\[[^\]]*\]\{[^}]*\}/);
  assert.ok(tabs, 'the sub-tab rule is present');
  assert.match(tabs[0], /flex:(none|0 0 auto)/, 'the sub-tab bar keeps its own height');
  assert.doesNotMatch(tabs[0], /position:sticky/, 'the sub-tab bar does not ride inside the scroll area');
  assert.match(tabs[0], /background:var\(--bg\)/);

  const body = html.match(/\.projects-scroll\[[^\]]*\]\{[^}]*\}/);
  assert.ok(body, 'the scroll body rule is present');
  assert.match(body[0], /overflow-y:auto/, 'the scroll body scrolls');
  assert.match(body[0], /min-height:0/, 'the scroll body gives up its content height');

  const panel = html.match(/main>\[data-panel=projects\]:not\(\[hidden\]\)\{[^}]*\}/);
  assert.ok(panel, 'the projects panel lays out its own children');
  assert.match(panel[0], /display:flex/);
  assert.match(panel[0], /overflow:hidden/, 'the projects panel itself never scrolls');
});

test('every scrollbar takes the site colours', () => {
  const html = readIndex();
  assert.match(html, /--scroll-track:#0c1410/);
  assert.match(html, /scrollbar-color:var\(--muted\) var\(--scroll-track\)/);
  assert.match(html, /::-webkit-scrollbar\{width:10px;height:10px\}/, 'WebKit builds get a fallback');
  assert.match(html, /::-webkit-scrollbar-thumb\{background:var\(--muted\)\}/);
});

test('both pages ask the on-screen keyboard to resize the content', () => {
  for (const doc of ['index.html', '404.html']) {
    const html = readFileSync(join(DIST, doc), 'utf8');
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content"/);
    assert.ok(!/maximum-scale|user-scalable/.test(html), `${doc} must not block zoom`);
  }

  const notFound = readFileSync(join(DIST, '404.html'), 'utf8');
  assert.match(notFound, /main\[data-astro-cid-[a-z]+\]\{min-height:0;overflow-y:auto\}/, 'the 404 page scrolls inside main');
});

test('the page carries a not-found panel that no tab controls', () => {
  const html = readIndex();
  assert.match(
    html,
    /<section id="panel-not-found"[^>]*data-panel="not-found"[^>]*aria-label="Page not found"[^>]*tabindex="0"[^>]*hidden/,
  );
  assert.doesNotMatch(
    html,
    /id="panel-not-found"[^>]*role="tabpanel"/,
    'a tabpanel role would claim a tab that does not exist',
  );

  const panel = html.match(/id="panel-not-found"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(panel, /404 - Dead Air/);
  assert.match(panel, /Signal lost\. Tune in to an active frequency below:/);

  const links = panel.match(/<a [^>]*href="#[a-z-]+"/g) || [];
  assert.equal(links.length, 7);
  assert.match(panel, /href="#game"/);
  assert.doesNotMatch(panel, /href="\/#/, 'the in-page view takes bare hashes');
});

test('the router reads the not-found panel and ignores only the skip link target', () => {
  const scripts = readScripts();
  assert.match(scripts, /404 - @JoeOfSomeTrades/, 'the 404 title lives in the script');
  assert.match(scripts, /["'`]not-found["'`]/, 'the router names the not-found panel');
  assert.match(
    scripts,
    /new Set\(\[["'`]main["'`]\]\)/,
    'only the skip link target escapes the 404 view',
  );
  assert.match(readIndex(), /<main id="main" tabindex="-1">/, 'the ignored hash names a real element');
});

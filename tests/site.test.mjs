import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/data/site.js';
import { links } from '../src/data/links.js';
import { certifications } from '../src/data/certifications.js';
import { projects } from '../src/data/projects.js';
import { routes, tabs, landing } from '../src/data/routes.js';
import { mobileMax, statusRowMax, tabsWrapMax, toggleHideMax, wideMin } from '../src/data/layout.js';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
// The deploy configuration, read by the tests that guard the hosting setup.
const WRANGLER = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url));
// The origin the built absolute URLs must carry. It comes from `site` in
// astro.config.mjs, so a domain move is a one line change there plus this one.
const ORIGIN = 'https://joeofsometrades.com';

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

test('page mounts every view in one document', () => {
  const html = readIndex();
  assert.match(html, /data-panel="about"/);
  assert.match(html, /data-panel="certifications"/);
  assert.match(html, /data-panel="projects"/);
  assert.equal((html.match(/<html/g) || []).length, 1);
});

test('the tab bar carries both tabs and the brand row carries About Me', () => {
  const html = readIndex();
  // The selected tab carries a decorative prompt, so drop the markup first.
  const labels = [...html.matchAll(/data-tab-target="([a-z-]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => [m[1], m[2].replace(/<span[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').trim()]);
  assert.deepEqual(labels, [
    ['projects', 'Projects'],
    ['certifications', 'Certifications'],
  ]);
  // About Me sits in the brand column with the handle, opens its own panel, and
  // is the view a bare address lands on.
  assert.match(
    html,
    /class="brand-link"[^>]*data-view="about"[^>]*data-hash="about"[^>]*data-default[^>]*href="#about"/,
  );
});

test('exactly one panel starts visible', () => {
  const html = readIndex();
  const hiddenCount = (html.match(/data-panel="[^"]+"[^>]*hidden/g) || []).length;
  // The two tabs and the not-found panel start hidden. About Me is the landing
  // view, so it is the one panel that starts visible.
  assert.equal(hiddenCount, 3);
});

test('About Me holds the approved paragraph above the links', () => {
  const html = readIndex();
  const panel = html.match(/data-panel="about"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.notEqual(panel, '');
  assert.match(panel, /class="heading"[^>]*>ABOUT ME</);
  assert.match(
    panel,
    /class="lede"[^>]*>I'm an enthusiast of all things IT, music, audio, and game design and development\. I've made this site to share all my works and passions with you\. Please enjoy exploring these links and the tabs at the top of this site\.</,
  );
  // The view carries no heading of its own for the links beyond the paragraph.
  assert.doesNotMatch(panel, /Socials and profiles|>LINKS</);
});

test('About Me lists nine entries, each with an icon, in the chosen order', () => {
  const html = readIndex();
  const labels = ['LIVE365', 'GITHUB', 'SOUNDCLOUD', 'YOUTUBE', 'BLUESKY', 'X', 'LAST.FM', 'DISCORD', 'EMAIL'];
  const panel = html.match(/data-panel="about"[\s\S]*?<\/section>/)?.[0] ?? '';
  const rendered = [...panel.matchAll(/class="label"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(rendered, labels);
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
  assert.match(html, /href="mailto:joe@joeofsometrades\.com"/);
  assert.match(html, /href="https:\/\/discord\.com\/users\/152963830350217217"/);
});

test('header merges the brand, tabs, and a status badge indicator', () => {
  const html = readIndex();
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.match(header, /<h1[^>]*>@JoeOfSomeTrades<\/h1>/);
  assert.match(header, /data-tab-target="projects"/);
  assert.match(header, /<span[^>]*data-on-air[^>]*data-state="off"[^>]*role="status"/);
  // The words carry the state and the brackets are decoration.
  assert.match(header, /data-on-air-text[^>]*>\s*OFF AIR/);
  assert.equal((header.match(/aria-hidden="true"[^>]*>\[/g) || []).length, 1);
  assert.equal((header.match(/aria-hidden="true"[^>]*>\]/g) || []).length, 1);
  assert.doesNotMatch(header, /data-on-air[^>]*(href|aria-disabled|data-clickable)/);
});

test('the status badge knows all five states and reacts to tab changes', () => {
  const html = readIndex();
  const all = readDist();
  for (const label of ['OFF AIR', 'ON AIR', 'PLAYING', 'PAUSED', 'VIBING']) {
    assert.ok(all.includes(label), `missing ${label}`);
  }
  // No state carries its own brackets. The pair in the markup is the only one.
  assert.ok(
    !['[ OFF AIR ]', '[ ON AIR ]', '[ VIBING ]'].some((s) => all.includes(s)),
    'the brackets left the labels',
  );
  assert.match(all, /tabs:change/);
});

test('every tab and sub-tab is a native link with its own hash', () => {
  const html = readIndex();
  const links = [
    ['data-view="about"', '#about'],
    ['data-tab-target="projects"', '#projects'],
    ['data-tab-target="certifications"', '#certs'],
    ['data-sub-tab-target="maximum-slappage"', '#radio'],
    ['data-sub-tab-target="soundcloud"', '#audio'],
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

test('projects expose four sub-tabs and four lazy project blocks', () => {
  const html = readIndex();
  assert.match(html, /data-sub-tab-target="maximum-slappage"/);
  assert.match(html, /data-sub-tab-target="portfolio"/);
  assert.match(html, /data-sub-tab-target="soundcloud"/);
  assert.match(html, /data-sub-tab-target="smiles"/);
  assert.equal((html.match(/data-project="/g) || []).length, 4);
  assert.equal((html.match(/data-project="[^"]+"[^>]*hidden/g) || []).length, 4);
  // The Projects view opens on its first project, so there is no chooser state.
  assert.doesNotMatch(html, /data-project-empty|Select a project above/);
  const first = html.match(/data-sub-tab-target="([a-z-]+)"/);
  assert.equal(first?.[1], 'portfolio');
});

test('hidden project blocks are display:none, not flex', () => {
  const css = readDist();
  assert.match(css, /\.project\[data-astro-cid-[a-z0-9]+\]\[hidden\]\s*\{\s*display:\s*none/);
});

test('Smiles Sadistic Adventure carries its embed and GitHub link', () => {
  const html = readIndex();
  assert.match(html, /data-src="https:\/\/decibillyjoel\.github\.io\/Smiles-Sadistic-Adventure\/"/);
  assert.match(html, /href="https:\/\/github\.com\/DecibillyJoel\/Smiles-Sadistic-Adventure"/);
  assert.match(html, /a bullet hell I made in high school/);
  assert.match(html, /during my time as Game Development Club President/);
});

test('player holds both embed sizes and lazy iframes carry no src', () => {
  const html = readIndex();
  assert.match(html, /data-src-xl="https:\/\/live365\.com\/embeds\/v1\/player\/a57727\?s=xl&amp;m=dark&amp;c=aac"/);
  assert.match(html, /data-src-sm="https:\/\/live365\.com\/embeds\/v1\/player\/a57727\?s=sm&amp;m=dark&amp;c=aac"/);
  assert.equal((html.match(/data-loaded="false"/g) || []).length, 3, 'one lazy embed per embed project');
  assert.doesNotMatch(html, /<iframe[^>]*\ssrc=/);
});

test('player chooses the embed size once, not on resize', () => {
  const js = readDist();
  // The query comes from data/player.js, so the numbers are written once.
  assert.match(js, /matchMedia\(\w+\.wideQuery\)/);
  // The size is decided where a frame is mounted. A resize handler that re-picked
  // it would have to ask the query again, so the decisions are counted instead.
  assert.equal((js.match(/matchMedia\(/g) || []).length, 2, 'one size decision per embed');
  const source = readFileSync(join(SRC, 'scripts/projects.js'), 'utf8');
  const mount = source.slice(source.indexOf('function mount('), source.indexOf('function show('));
  assert.equal((mount.match(/matchMedia\(/g) || []).length, 2, 'both decisions sit in mount()');
});

test('the mobile layout block uses the shared breakpoint', () => {
  assert.match(readDist(), new RegExp(`max-width:\\s*${mobileMax}px|width\\s*<=\\s*${mobileMax}px`));
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
  for (const route of ['#about', '#projects', '#certs', '#radio', '#portfolio', '#game', '#audio']) {
    assert.ok(llms.includes(route), `llms.txt is missing ${route}`);
  }
});

test('sitemap.xml ships and robots.txt points at it', () => {
  const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const origin = ORIGIN.replace(/\./g, '\\.');
  assert.match(sitemap, new RegExp(`<loc>${origin}/</loc>`));

  const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
  assert.match(robots, new RegExp(`^Sitemap: ${origin}/sitemap\\.xml$`, 'm'));
});

test('a real 404 page ships and points back at every view', () => {
  const notFound = readFileSync(join(DIST, '404.html'), 'utf8');
  assert.match(notFound, /404 - Dead Air/);
  assert.match(notFound, /Signal lost\. Tune in to an active frequency below:/);
  assert.equal((notFound.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((notFound.match(/<h2[\s>]/g) || []).length, 1);
  assert.match(notFound, /<main id="main" tabindex="-1"[^>]*>/);
  assert.match(notFound, /<a class="skip-link" href="#main"[^>]*>/);
  for (const route of ['/#about', '/#projects', '/#certs', '/#radio', '/#portfolio', '/#game', '/#audio']) {
    assert.ok(notFound.includes(`href="${route}"`), `404.html is missing ${route}`);
  }
  // The 404 page renders no tab bar, so it must not reference panels that only
  // index.html provides.
  assert.doesNotMatch(notFound, /role="tablist"|aria-controls|data-tab-target|data-sub-tab-target/);
  // The shared header renders in slim mode: the brand row and the theme
  // control, with no badge and no routing code of its own.
  assert.match(notFound, /<header class="site-header"[^>]*data-slim="true"[^>]*>/);
  assert.match(notFound, /class="brand-name"/);
  assert.doesNotMatch(notFound, /data-on-air/);
  assert.doesNotMatch(notFound, /<script type="module"/);
  // Nothing describes a page that does not exist.
  assert.doesNotMatch(notFound, /rel="canonical"|property="og:|name="twitter:|application\/ld\+json/);

  const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(wrangler, /"not_found_handling"\s*:\s*"404-page"/);
  assert.doesNotMatch(wrangler, /single-page-application/);
});

test('the critical stylesheet is inlined, so nothing blocks the first render', () => {
  const html = readIndex();
  assert.doesNotMatch(html, /rel="stylesheet"/);
  assert.doesNotMatch(html, /\/_astro\//);
  assert.match(html, /<style>[\s\S]*--green:/);
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

test('_headers ships the security headers and a report only CSP', () => {
  const headers = readFileSync(join(DIST, '_headers'), 'utf8');
  assert.match(headers, /^\/\*$/m);
  for (const name of [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'X-Frame-Options',
    'Cross-Origin-Opener-Policy',
    'Permissions-Policy',
  ]) {
    assert.ok(headers.includes(`${name}:`), `_headers is missing ${name}`);
  }
  // A blocking policy would stop the Cloudflare bot check, which injects its own
  // script, so the policy reports first and blocks nothing yet.
  assert.ok(headers.includes('Content-Security-Policy-Report-Only:'), 'the CSP must report only');
  assert.doesNotMatch(headers, /^Content-Security-Policy:/m, 'no blocking CSP yet');
  // Read the directive list alone, because the comment above it names both of
  // these. A report only policy ignores them, and the browser logs an error for
  // the second one on every load.
  const csp = headers.match(/^\s*Content-Security-Policy-Report-Only: (.*)$/m)[1];
  assert.ok(!csp.includes('upgrade-insecure-requests'), 'a report only policy ignores this directive');
  assert.ok(!csp.includes('frame-ancestors'), 'X-Frame-Options already covers framing');
  // The report names every embed, so a later blocking policy would keep them.
  for (const origin of ['https://live365.com', 'https://w.soundcloud.com', 'https://decibillyjoel.github.io']) {
    assert.ok(headers.includes(origin), `the CSP frame-src is missing ${origin}`);
  }
});

test('the page has one h1, a skip link, and a focusable main landmark', () => {
  const html = readIndex();
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((html.match(/<h2[\s>]/g) || []).length, 7);
  assert.match(html, /<a class="skip-link" href="#main">/);
  assert.match(html, /<main id="main" tabindex="-1"[^>]*>/);
});

test('tablists use roving tabindex, arrow keys, and paired roles', () => {
  const html = readIndex();
  assert.equal((html.match(/<[a-z]+[^>]*role="tablist"/g) || []).length, 2);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 6);
  assert.equal((html.match(/role="tab"/g) || []).length, 6);
  // About Me has no tab of its own, so its panel is a labelled region.
  assert.match(html, /id="panel-about"[^>]*role="region"[^>]*aria-label="About Me"/);
  assert.ok(!/id="tab-about"/.test(html), 'the About Me view is not a tab');
  assert.match(html, /id="subtab-maximum-slappage"[^>]*aria-controls="project-maximum-slappage"/);
  assert.match(
    html,
    /id="project-smiles"[^>]*role="tabpanel"[^>]*aria-labelledby="subtab-smiles"/,
  );

  const js = readDist();
  assert.match(js, /ArrowRight/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /tabIndex/);
  assert.match(js, /\[data-route-ignore\]/, 'the router takes the ignored targets from the page');
});

test('the embed wrappers carry the focus ring attribute', () => {
  const js = readDist();
  assert.match(js, /\[data-embed-focus[^\]]*\]/);
  assert.match(js, /outline: ?2px solid var\(--magenta\)/);
  assert.match(js, /dataset\.embedFocus/);
});

test('the Portfolio project opens the list and carries the repo link', () => {
  const html = readIndex();
  const order = [...html.matchAll(/data-project="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['portfolio', 'maximum-slappage', 'smiles', 'soundcloud']);
  const subTabOrder = [...html.matchAll(/data-sub-tab-target="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(subTabOrder, ['portfolio', 'maximum-slappage', 'smiles', 'soundcloud']);
  assert.match(html, /id="subtab-portfolio"[^>]*data-hash="portfolio"[^>]*href="#portfolio"/);
  assert.match(html, /id="project-portfolio"[^>]*role="tabpanel"[^>]*aria-labelledby="subtab-portfolio"/);
  assert.match(
    html,
    /class="project-link ext-link" href="https:\/\/github\.com\/DecibillyJoel\/portfolio"[^>]*>View on GitHub<span class="arrow"[^>]*>↗<\/span>/,
  );
  assert.ok(!/class="project-link[^"]*"[^>]*tabindex/.test(html), 'the project link takes no tabindex');
  assert.match(html, /Cloudflare Workers with Static Assets/);
  const panel = html.slice(html.indexOf('id="project-portfolio"'), html.indexOf('id="project-maximum-slappage"'));
  assert.ok(!panel.includes('iframe'), 'the Portfolio project must carry no embed');
});

test('every project carries one intro line and no screen-size text swap', () => {
  const html = readIndex();
  assert.equal((html.match(/class="lede"/g) || []).length, 6, 'four projects, the About Me view and the certifications view');
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
  assert.match(css, /main>\*\{[^}]*overflow-y:auto/, 'each view scrolls');
  assert.match(css, /main>\*\{[^}]*min-height:0/, 'each view gives up its content height');
  assert.match(css, /main>\[data-panel\]:focus-visible\{outline-offset:-2px\}/, 'the panel ring sits inside the panel');

  assert.equal((html.match(/<section id="panel-[a-z-]+"[^>]*tabindex=/g) || []).length, 0,
    'no panel carries a static focus stop');
  assert.doesNotMatch(html, /class="projects-scroll" tabindex=/,
    'the projects scroll body carries no static focus stop either');
  const js = readDist();
  assert.ok(js.includes('scrollHeight-e.clientHeight>'), 'the router measures the overflow');
  assert.ok(js.includes('setAttribute(`tabindex`,`0`)'), 'a region that scrolls takes a focus stop');
  assert.ok(js.includes('removeAttribute(`tabindex`)'), 'a region that fits gives the stop back');
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
  assert.match(html, /::-webkit-scrollbar\{width:0?\.625rem;height:0?\.625rem\}/, 'WebKit builds get a fallback');
  assert.match(html, /::-webkit-scrollbar-thumb\{background:var\(--muted\)\}/);
});

test('both pages ask the on-screen keyboard to resize the content', () => {
  for (const doc of ['index.html', '404.html']) {
    const html = readFileSync(join(DIST, doc), 'utf8');
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content"/);
    assert.ok(!/maximum-scale|user-scalable/.test(html), `${doc} must not block zoom`);
  }
});

test('the page carries a not-found panel that no tab controls', () => {
  const html = readIndex();
  assert.match(
    html,
    /<section id="panel-not-found"[^>]*data-panel="not-found"[^>]*aria-label="Page not found"[^>]*hidden/,
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

test('the router reads the not-found panel and leaves in-page targets alone', () => {
  const scripts = readScripts();
  assert.match(scripts, /["'`]not-found["'`]/, 'the router names the not-found panel');
  assert.match(
    scripts,
    /\[data-route-ignore\]/,
    'the ignored targets come from the page, not a second list',
  );
  assert.match(scripts, /404 - /, 'the router prefixes the page title for the 404 view');
  const html = readIndex();
  assert.match(html, /<main id="main" tabindex="-1"[^>]*data-route-ignore/, 'the marker sits on a real element');
  assert.match(html, /<title>@JoeOfSomeTrades<\/title>/, 'the base title comes from the page');
});

function metaMap(html) {
  const map = {};
  for (const tag of html.match(/<meta [^>]*>/g) || []) {
    const key = tag.match(/(?:name|property)="([^"]+)"/)?.[1];
    const content = tag.match(/content="([^"]*)"/)?.[1];
    if (key && content !== undefined) map[key] = content;
  }
  return map;
}

function readGraph() {
  const raw = readIndex().match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(raw, 'the page carries one JSON-LD block');
  const data = JSON.parse(raw);
  return {
    data,
    byType: Object.fromEntries(data['@graph'].map((node) => [node['@type'], node])),
  };
}

test('the head carries a canonical link and a full social card', () => {
  const html = readIndex();
  const meta = metaMap(html);

  assert.match(html, new RegExp(`<html lang="${site.lang}">`));
  assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}/">`));

  assert.equal(meta['og:type'], 'profile');
  assert.equal(meta['og:site_name'], site.title);
  assert.equal(meta['og:title'], site.title);
  assert.equal(meta['og:description'], site.description);
  assert.equal(meta['og:url'], `${ORIGIN}/`);
  assert.equal(meta['og:image'], `${ORIGIN}${site.image}`);
  assert.equal(meta['og:image:type'], site.imageType);
  assert.equal(meta['og:image:width'], String(site.imageWidth));
  assert.equal(meta['og:image:height'], String(site.imageHeight));
  assert.equal(meta['og:image:alt'], site.imageAlt);

  assert.equal(meta['twitter:card'], 'summary_large_image');
  assert.equal(meta['twitter:title'], site.title);
  assert.equal(meta['twitter:description'], site.description);
  assert.equal(meta['twitter:image'], `${ORIGIN}${site.image}`);
  assert.equal(meta['twitter:image:alt'], site.imageAlt);
});

test('the social card is a real png of the declared size', () => {
  const file = join(DIST, site.image.replace(/^\//, ''));
  assert.ok(existsSync(file), 'dist must hold the social card');
  const bytes = readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(bytes.readUInt32BE(16), site.imageWidth, 'the card is wide enough for a large preview');
  assert.equal(bytes.readUInt32BE(20), site.imageHeight);
});

test('the structured data is one graph of the person, the site and the projects', () => {
  const { data, byType } = readGraph();
  assert.equal(data['@context'], 'https://schema.org');
  assert.deepEqual(Object.keys(byType).sort(), ['Person', 'RadioStation', 'VideoGame', 'WebSite']);
});

test('the person node carries the profiles, the credentials and the address', () => {
  const { byType } = readGraph();
  const person = byType.Person;

  assert.equal(person['@id'], `${ORIGIN}/#person`);
  assert.equal(person.name, site.title);
  assert.equal(person.alternateName, site.title.replace(/^@/, ''));
  assert.equal(person.url, `${ORIGIN}/`);
  assert.equal(person.image, `${ORIGIN}${site.image}`);
  assert.equal(person.email, links.find((link) => link.id === 'email').value);
  assert.equal(person.description, site.description);
  assert.deepEqual(person.knowsAbout, site.topics);

  const sameAs = person.sameAs;
  for (const id of ['github', 'youtube', 'x', 'bluesky', 'lastfm', 'discord']) {
    assert.ok(sameAs.includes(links.find((link) => link.id === id).href), `sameAs needs ${id}`);
  }
  assert.ok(
    !sameAs.includes(links.find((link) => link.id === 'live365').href),
    'the station is its own node, not a profile link',
  );

  assert.equal(person.hasCredential.length, certifications.length);
  for (const certification of certifications) {
    const node = person.hasCredential.find((entry) => entry.name === certification.name);
    assert.ok(node, `hasCredential needs ${certification.name}`);
    assert.equal(node['@type'], 'EducationalOccupationalCredential');
    assert.equal(node.name, certification.name);
    assert.equal(node.url, certification.href);
    assert.equal(node.recognizedBy.name, certification.issuer);
  }
});

test('the site, the station and the game point back at the person', () => {
  const { byType } = readGraph();
  const personId = byType.Person['@id'];
  const smiles = projects.find((project) => project.id === 'smiles');

  assert.equal(byType.WebSite['@id'], `${ORIGIN}/#website`);
  assert.equal(byType.WebSite.url, `${ORIGIN}/`);
  assert.equal(byType.WebSite.inLanguage, site.lang);
  assert.equal(byType.WebSite.author['@id'], personId);

  assert.equal(byType.RadioStation.url, links.find((link) => link.id === 'live365').href);
  assert.equal(byType.RadioStation.founder['@id'], personId);

  assert.equal(byType.VideoGame.url, smiles.embed);
  assert.equal(byType.VideoGame.codeRepository, smiles.href);
  assert.equal(byType.VideoGame.author['@id'], personId);
});

// ---- Theme ---------------------------------------------------------------

const TOGGLE_ICONS = ['auto', 'light', 'dark'];
const SRC = fileURLToPath(new URL('../src', import.meta.url));

function collectFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(full) : [full];
  });
}

test('both pages mount one theme toggle with an accessible name', () => {
  const index = readIndex();
  const notFound = readFileSync(join(DIST, '404.html'), 'utf8');

  for (const html of [index, notFound]) {
    assert.match(
      html,
      /<button[^>]*data-theme-toggle[^>]*aria-label="Theme: auto"/,
    );
    assert.equal((html.match(/<button[^>]*data-theme-toggle/g) || []).length, 1);

    for (const icon of TOGGLE_ICONS) {
      const tag = html.match(new RegExp(`<svg[^>]*data-theme-icon="${icon}"[^>]*>`));
      assert.ok(tag, `missing the ${icon} icon`);
      // The label says the state, so each icon stays out of the name.
      assert.match(tag[0], /aria-hidden="true"/);
    }
  }
});

test('the theme script applies the stored preference before the first paint', () => {
  const scripts = readScripts();

  assert.match(scripts, /KEY = 'theme-pref'/);
  assert.match(scripts, /ORDER = \['auto', 'light', 'dark'\]/);
  assert.match(scripts, /root\.dataset\.themePref = pref/);
  assert.match(scripts, /localStorage\.setItem\(KEY, pref\)/);
  assert.match(scripts, /localStorage\.removeItem\(KEY\)/);
  // The button is not in the document yet while the head script runs.
  assert.match(scripts, /addEventListener\('DOMContentLoaded'/);
});

test('the stylesheet resolves both palettes through light-dark', () => {
  const css = readDist();

  assert.match(css, /@supports \(color: ?light-dark\(#000, ?#fff\)\)/);
  assert.match(css, /color-scheme: ?light dark/);
  assert.match(css, /:root\[data-theme-pref=light\]/);
  assert.match(css, /:root\[data-theme-pref=dark\]/);

  // The dark values stay as the fallback for a browser without light-dark().
  assert.match(css, /--bg: ?#080b09/);
  assert.match(css, /--green: ?#78e16b/);

  // The light values, which are the layered theme: page, then the darker
  // cool wells for the cards, the embed box and the scrollbar track.
  for (const hex of ['#e9efe7', '#f0f4ee', '#d5e0d7', '#c7d4c9', '#bfcdc2', '#a3b8a6', '#65836e', '#0b2411', '#43626a', '#0a6b16', '#95117a']) {
    assert.ok(css.includes(hex), `missing the light value ${hex}`);
  }
});

// A colour written into a component cannot follow the theme, so every colour
// name lives in the token layer.
test('only the token layer names a colour', () => {
  const offenders = [];
  for (const file of collectFiles(SRC)) {
    if (file.endsWith(join('styles', 'global.css'))) continue;
    const text = readFileSync(file, 'utf8').replace(/@supports \((?:[^()]|\([^()]*\))*\)/g, '');
    if (/#[0-9a-fA-F]{3,8}\b/.test(text)) offenders.push(file.slice(SRC.length + 1));
  }

  assert.deepEqual(offenders, []);
});

test('every project link names the project it opens', () => {
  const html = readIndex();
  const links = [...html.matchAll(/class="project-link ext-link" href="([^"]+)"[^>]*>([^<]+)<span class="arrow"/g)]
    .map((m) => [m[2], m[1]]);
  assert.deepEqual(links, [
    ['View on GitHub', 'https://github.com/DecibillyJoel/portfolio'],
    ['View on Live365', 'https://live365.com/station/Maximum-Slappage-a57727'],
    ['View on GitHub', 'https://github.com/DecibillyJoel/Smiles-Sadistic-Adventure'],
    ['View on SoundCloud', 'https://soundcloud.com/joeofsometrades'],
  ]);
});

// The heading style lives in one place now. A component that sets its own
// heading size drifts away from the rest, so this fails as soon as one appears.
test('one shared rule styles every panel heading', () => {
  const offenders = [];
  for (const file of collectFiles(SRC)) {
    if (!file.endsWith('.astro')) continue;
    if (/(^|\s)h2\s*\{/.test(readFileSync(file, 'utf8'))) {
      offenders.push(file.slice(SRC.length + 1));
    }
  }
  assert.deepEqual(offenders, []);

  const html = readIndex();
  assert.equal((html.match(/class="heading/g) || []).length, 7);
  assert.match(html, /\.heading\{[^}]*color:var\(--magenta\)/);
  assert.match(html, /\.heading--tight\{margin-bottom:var\(--heading-gap-tight\)\}/);
});

// Every view is named once, in src/data/routes.js. The rendered page must carry
// exactly those hashes, in that order.
test('the page renders the navigation from the one route list', () => {
  const html = readIndex();
  const rendered = [...html.matchAll(/data-hash="([^"]+)"/g)].map((match) => match[1]);
  // Every route in the list reaches the page, and the page invents none.
  assert.deepEqual([...rendered].sort(), routes.map(({ hash }) => hash).sort());
  // About Me leads, because it sits in the brand row, and the tab bar then
  // keeps the order the list gives it.
  assert.deepEqual(rendered, [
    landing.hash,
    ...tabs.map(({ hash }) => hash),
    ...projects.map(({ hash }) => hash),
  ]);
});

// The 404 document shares the head and the header with the other pages, so the
// markup and its styling live in one place.
test('the 404 document reuses the shared layout', () => {
  const page = readFileSync(join(SRC, 'pages/404.astro'), 'utf8');
  assert.doesNotMatch(page, /<(html|head|body|header)\b/, 'the page holds no document markup of its own');

  const headerRules = collectFiles(SRC)
    .filter((file) => /\.site-header\s*\{/.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(SRC.length + 1));
  assert.deepEqual(headerRules, ['components/Header.astro']);
});

// ---- Modern layout hints -------------------------------------------------

test('headings balance their lines and prose avoids a lone last word', () => {
  const css = readDist();
  assert.match(css, /\.heading\{[^}]*text-wrap:balance/);
  assert.match(css, /p\{text-wrap:pretty\}/, 'prose carries the pretty hint');
});

test('the tablist answers Up and Down as well as Left and Right', () => {
  const js = readScripts();
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
    assert.ok(js.includes(key), `the tablist listens for ${key}`);
  }
});

test('an icon name that is not in the set stops the build', () => {
  const source = readFileSync(join(SRC, 'components', 'Icon.astro'), 'utf8');
  assert.match(source, /throw new Error/);
  assert.match(source, /icons\[id\]/);
});

test('every size is a rem value written where it is used', () => {
  const html = readIndex();
  assert.doesNotMatch(html, /--type-scale|font-size: ?calc\(/, 'no size dial and no font size is a multiplier');
  assert.doesNotMatch(html, /transform:|zoom:/, 'nothing is scaled after layout');
  assert.doesNotMatch(html, /font-size: ?[\d.]+px/, 'no font size stays in px, so the reader font sets the scale');
  // The whole type scale, one deliberate step at a time.
  const sizes = [...new Set([...html.matchAll(/font-size: ?(-?[\d.]+)rem/g)].map((m) => Number(m[1])))];
  assert.deepEqual(sizes.sort((a, b) => a - b), [0.875, 1, 1.125, 1.25, 1.3125, 1.6875, 2.4375]);
});

test('nothing on the page carries a text glow', () => {
  const dist = readDist();
  assert.ok(!dist.includes('text-shadow'), 'no text-shadow is left anywhere');
  for (const token of [
    '--glow-green',
    '--glow-green-strong',
    '--glow-magenta',
    '--glow-magenta-soft',
    '--hover-glow-color',
  ]) {
    assert.ok(!dist.includes(token), `${token} was removed with its last user`);
  }
});

test('every clickable wears the one link colour, and the badge wears the handle colour', () => {
  const html = readIndex();

  // The tabs, the sub-tabs, the Links link in the brand row and the theme
  // button all take the link colour, so every clickable reads as one group.
  // The tab anchors are scoped by their own attribute rather than by a
  // descendant selector, so their rule starts with a bare `a`.
  for (const [pattern, label] of [
    [/\}a\[[^\]]*\]\{font:inherit;color:var\(--green\)/, 'a tab'],
    [/\.sub-tabs\[[^\]]*\] a\[[^\]]*\]\{font:inherit;color:var\(--green\)/, 'a sub-tab'],
    [/\.brand-link\[[^\]]*\]\{color:var\(--green\)/, 'the Links link'],
    [/\.theme-toggle\[[^\]]*\]\{height:var\(--control-h\);color:var\(--green\)/, 'the theme button'],
  ]) {
    assert.match(html, pattern, `${label} takes the link colour`);
  }

  // Selection is shown by the prompt alone, so no clickable needs a second
  // colour, and hover underlines instead of recolouring.
  assert.match(html, /\{a\[[^\]]*\]:hover\{text-decoration:underline\}/);
  assert.match(html, /\.sub-tabs\[[^\]]*\] a\[[^\]]*\]:hover\{text-decoration:underline\}/);
  assert.match(html, /\.brand-link\[[^\]]*\]:hover\{text-decoration:underline\}/);

  // The badge is a status rather than a control, so an active state wears the
  // colour of the handle. A brand mark in a card is a picture, not a control,
  // so it stays off the link colour as well.
  assert.match(
    html,
    /\.on-air\[[^\]]*\]\[data-state=on-air\],\.on-air\[[^\]]*\]\[data-state=running\],\.on-air\[[^\]]*\]\[data-state=vibing\]\{color:var\(--text\)\}/,
    'the active badge takes the handle colour',
  );
  assert.match(html, /\.card\[[^\]]*\] \.icon\{color:var\(--text\)\}/, 'a card mark takes it too');

  // The two extra ramps that the one colour replaced are gone from the token
  // layer, with the hover colour they were paired with.
  const css = readFileSync(join(SRC, 'styles', 'global.css'), 'utf8');
  for (const token of ['--magenta-hover', '--magenta-dim', '--hover']) {
    assert.ok(!css.includes(`${token}:`), `${token} was removed with its last user`);
  }

  // The link colour lands on the page background and inside the header, where
  // the badge sits, so it must clear AA on both in both themes.
  const plain = (name) => css.match(new RegExp(`^\\s*${name}:\\s*(#[0-9a-f]{6});`, 'm'))?.[1];
  const pair = (name) =>
    css.match(new RegExp(`${name}:\\s*light-dark\\(\\s*(#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`))?.slice(1, 3);
  const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  for (const [colour, background] of [
    ['--green', '--bg'],
    ['--green', '--header'],
    ['--text', '--header'],
  ]) {
    assert.ok(
      ratio(plain(colour), plain(background)) >= 4.5,
      `${colour} clears AA on the dark ${background}`,
    );
    const [light] = pair(background) ?? [];
    assert.ok(
      ratio(pair(colour)[0], light) >= 4.5,
      `${colour} clears AA on the light ${background}`,
    );
  }
});

test('the badge and the toggle share one control height', () => {
  const html = readIndex();
  // They share a row, so they share one height token.
  assert.match(html, /--control-h: ?2\.375rem/, 'one token holds the control height');
  assert.match(html, /\.on-air\[[^\]]*\]\{[^}]*height:var\(--control-h\)/, 'the badge takes that height');
  assert.match(html, /\.theme-toggle\[[^\]]*\]\{[^}]*height:var\(--control-h\)/, 'the toggle takes it too');
});

test('the Links link takes the same selected prompt as a tab', () => {
  const html = readIndex();
  assert.match(html, /class="brand-link"[^>]*>.*?<span class="prompt" aria-hidden="true"[^>]*>/, 'the Links link carries a prompt span like a tab does');
  assert.match(html, /\.brand-link\[[^\]]*\] \.prompt\[[^\]]*\]\{display:none/);
  assert.match(html, /\.brand-link\[[^\]]*\]\[aria-current=true\] \.prompt\[[^\]]*\]\{display:inline\}/);
});

test('every link that leaves the site looks and reads the same', () => {
  const html = readIndex();
  const external = [...html.matchAll(/<a [^>]*target="_blank"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
  assert.equal(external.length, 16, 'eight social links, four credential links and four project links');
  for (const inner of external) {
    assert.match(inner, /<span class="arrow"[^>]*>↗<\/span>/, 'the arrow is missing');
    assert.match(inner, /<span class="visually-hidden"[^>]*>[^<]*opens in a new tab<\/span>/, 'the new tab note is missing');
  }
  assert.match(html, /\.ext-link\{text-decoration:none\}/);
  assert.match(html, /\.ext-link:focus-visible\{text-decoration:underline\}/);
  assert.match(html, /@media \(hover:hover\)\{\.ext-link:hover\{text-decoration:underline\}\}/);
});

test('a long address cannot push the About card off a narrow screen', () => {
  const html = readIndex();
  assert.match(html, /\.card\[[^\]]*\] a\[[^\]]*\]\{[^}]*overflow-wrap:anywhere/);
  assert.match(html, /minmax\(0,1fr\)/);
});

test('every stylesheet uses the one breakpoint from data/layout.js', () => {
  // A media query cannot read a custom property, so the number is written into
  // each stylesheet. This keeps every copy equal to data/layout.js.
  const queries = collectFiles(SRC)
    .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/@media \(max-width: (\d+)px\)/g)])
    .map((match) => Number(match[1]));
  assert.equal(queries.length, 10, 'one block per part that has to give way, including the two controls');
  assert.deepEqual(
    [...new Set(queries)].sort((a, b) => b - a),
    [mobileMax, tabsWrapMax, statusRowMax, toggleHideMax],
    'every mobile block uses one of the shared widths',
  );

  assert.match(readDist(), new RegExp(`min-width: ?${wideMin}px`), 'the scripts read the wide query');
  for (const file of collectFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/(?:max-width|min-width): (?:899|900|959)px/.test(text), `${file.slice(SRC.length + 1)} keeps an old breakpoint`);
  }
});

test('a hairline divides the tabs and the sub-tabs', () => {
  const html = readIndex();
  // The line is a pseudo element, so it costs no gap of its own: it sits at the
  // halfway point of the gap, and the mobile gap gets its own offset.
  assert.match(html, /\.tab-bar\[[^\]]*\] a\[[^\]]*\]?:not\(:last-of-type\):after\{[^}]*background:var\(--border\)/);
  assert.match(html, /\.sub-tabs\[[^\]]*\] a\[[^\]]*\]?:not\(:last-of-type\):after\{[^}]*background:var\(--border\)/);
  assert.match(html, /:not\(:last-of-type\):after\{[^}]*right:-1\.0625rem\}/, 'the desktop tab line sits at half the gap');
  assert.match(html, /:not\(:last-of-type\):after\{right:-\.65625rem\}/, 'the mobile tab line and the sub-tab line sit at half the narrow gap');
  assert.match(html, /\.sub-tabs\[[^\]]*\] a\[[^\]]*\]\{[^}]*position:relative/);
});

test('a wrapped bar drops its hairline and draws a rule between its rows', () => {
  const css = readDist();
  const html = readIndex();
  // rows.js measures the rows the browser made, so the marks reach the page.
  assert.match(css, /dataset\.rowEnd/);
  assert.match(css, /dataset\.wrapped/);
  assert.ok(css.includes('[data-row-end]:after'), 'the stylesheet reads the row-end mark');
  // The header and both bars are measured, and a rule sits in each gap.
  assert.equal((html.match(/<[^>]+\sdata-rows[^>]*>/g) || []).length, 3, 'three bars are measured');
  assert.match(css, /row-rule/);
  assert.ok(
    css.includes('.row-rule{left:var(--rule-inset);right:var(--rule-inset);pointer-events:none;background:var(--border);height:1px;position:absolute}'),
    'the rule stops short of each side of its bar',
  );
  assert.ok(css.includes('--rule-inset:1.5rem') && css.includes('--rule-inset:1rem'), 'one token holds the inset');
  // Both bars read their wrapped row gap from the header's own air, and one
  // token holds that value. Two documents carry the same inlined stylesheet.
  const wrapped = css.split('[data-wrapped]{gap:var(--wrap-gap) 1.3125rem}').length - 1;
  assert.ok(wrapped >= 2, `both bars share the wrapped row gap, found ${wrapped}`);
  assert.ok(css.includes('--wrap-gap:16px'), 'one token holds the air between two rows');
});

test('no built file still names the workers.dev fallback', () => {
  const dist = readDist();
  const hits = dist.match(/[a-z0-9.-]*workers\.dev/g) || [];
  assert.deepEqual(hits, [], 'every absolute URL moved to the custom domain');
});

// The site answers on the custom domain alone. The old workers.dev address and
// every version preview URL are switched off, so the Worker only ever hands a
// request to the built assets.
test('the worker hands every request to the built assets', async () => {
  const { default: worker } = await import('../src/worker.js');
  const served = [];
  const env = {
    ASSETS: {
      fetch(request) {
        served.push(new URL(request.url).pathname);
        return new Response('asset body', { status: 200 });
      },
    },
  };

  for (const host of ['joeofsometrades.com', 'www.joeofsometrades.com']) {
    const response = await worker.fetch(new Request(`https://${host}/robots.txt`), env);
    assert.equal(response.status, 200, `${host} is served`);
  }
  assert.deepEqual(served, ['/robots.txt', '/robots.txt']);
});

// Only the real site is live. The workers.dev address that was live first and
// the per-version preview URLs must stay off, and both domain names stay
// claimed, so a later config edit cannot quietly open either door again.
test('the workers.dev address and the preview URLs stay switched off', () => {
  const config = readFileSync(WRANGLER, 'utf8');
  assert.match(config, /"workers_dev": false/, 'the old address is off');
  assert.match(config, /"preview_urls": false/, 'the preview URLs are off');
  assert.match(config, /"pattern": "joeofsometrades\.com"/, 'the apex is claimed');
  assert.match(config, /"pattern": "www\.joeofsometrades\.com"/, 'www is claimed');
});

test('every embed is sandboxed, and only the two players may autoplay', () => {
  const html = readIndex();
  const frames = [...html.matchAll(/<iframe[\s\S]*?>/g)].map((m) => m[0]);
  assert.equal(frames.length, 3, 'the radio, the game and the audio list');
  for (const frame of frames) {
    assert.match(frame, /sandbox="allow-scripts allow-same-origin allow-popups"/, 'every frame is sandboxed');
  }
  const autoplay = frames.filter((frame) => frame.includes('allow="autoplay"'));
  assert.equal(autoplay.length, 2, 'the radio and the audio list ask for autoplay');
});

test('the structured data cannot break out of its script element', () => {
  const html = readIndex();
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(block, 'the structured data block is missing');
  assert.ok(!block[1].includes('<'), 'a raw < would end the script element early');
  const source = readFileSync(join(SRC, 'layouts', 'Base.astro'), 'utf8');
  assert.match(source, /\.replace\(\/<\/g, '\\\\u003c'\)/, 'the source must keep the escape');
});

test('gitignore keeps environment files and keys out of the repo', () => {
  const ignore = readFileSync(fileURLToPath(new URL('../.gitignore', import.meta.url)), 'utf8');
  const lines = ignore.split('\n');
  for (const pattern of ['.dev.vars*', '.env', '.env.*', '*.pem', '*.key', 'docs/superpowers/']) {
    assert.ok(lines.includes(pattern), `gitignore is missing ${pattern}`);
  }
});

test('the mail row opens the mail client in place', () => {
  const html = readIndex();
  const anchors = [...html.matchAll(/<a [^>]*href="mailto:[^"]*"[^>]*>[\s\S]*?<\/a>/g)];
  assert.equal(anchors.length, 1, 'one mail link');
  const mail = anchors[0][0];
  assert.match(mail, /rel="me"/);
  assert.ok(!mail.includes('target="_blank"'), 'the mail client opens in place');
  assert.ok(!mail.includes('arrow'), 'the mail row carries no outward arrow');
});

test('the security policy is served from the well known path', () => {
  const file = join(DIST, '.well-known', 'security.txt');
  assert.ok(existsSync(file), 'dist/.well-known/security.txt is missing');
  const text = readFileSync(file, 'utf8');
  assert.match(text, /^Contact: mailto:joe@joeofsometrades\.com$/m);
  assert.match(text, /^Canonical: https:\/\/joeofsometrades\.com\/\.well-known\/security\.txt$/m);
  const expires = text.match(/^Expires: (.+)$/m);
  assert.ok(expires, 'the policy needs an Expires field');
  assert.ok(Date.parse(expires[1]) > Date.now(), 'the policy must not be expired');
});

test('the chooser folds away on a project route', () => {
  const css = readDist();
  const html = readIndex();
  // The bar carries a flex display of its own, which would beat the hidden
  // attribute, so it needs a rule of its own to fold away.
  assert.match(css, /\.sub-tabs[^{]*\[hidden\][^{]*\{display:none\}/);
  // The route folds the bar as the address lands, and a press on the Projects
  // tab toggles it back and forth.
  assert.match(css, /showBar/);
  assert.match(css, /toggleBar/);
  // A folded bar takes its links out of the tab order, so the project that is
  // on screen takes the focus instead.
  assert.equal(
    (html.match(/id="project-[a-z-]+"[^>]*tabindex="-1"/g) || []).length,
    4,
    'each project can take the focus',
  );
});

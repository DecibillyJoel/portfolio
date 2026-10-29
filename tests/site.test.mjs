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

test('Links lists seven entries', () => {
  const html = readIndex();
  const labels = ['GITHUB', 'YOUTUBE', 'BLUESKY', 'LIVE365', 'LAST.FM', 'EMAIL', 'DISCORD'];
  for (const label of labels) assert.match(html, new RegExp(`>\\s*${label.replace('.', '\\.')}<`));
});

test('pending links are not clickable', () => {
  const html = readIndex();
  assert.doesNotMatch(html, /href="[^"]*bsky\.social/);
  assert.doesNotMatch(html, /href="mailto:/);
});

test('live links point at the approved URLs', () => {
  const html = readIndex();
  assert.match(html, /href="https:\/\/github\.com\/DecibillyJoel"/);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/@JoeOfSomeTrades"/);
  assert.match(html, /href="https:\/\/www\.last\.fm\/user\/DecibillyJoel"/);
  assert.match(html, /href="https:\/\/live365\.com\/station\/a57727"/);
});

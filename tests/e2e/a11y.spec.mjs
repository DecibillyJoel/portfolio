import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

const ROUTES = [
  { hash: '#whoami', panel: 'who-am-i' },
  { hash: '#links', panel: 'links' },
  { hash: '#certs', panel: 'certifications' },
  { hash: '#projects', panel: 'projects' },
  { hash: '#radio', panel: 'projects' },
  { hash: '#portfolio', panel: 'projects' },
  { hash: '#game', panel: 'projects' },
  // An unknown hash shows the 404 view inside the same document.
  { hash: '#thisdoesntexist', panel: 'not-found' },
];

async function blockEmbed(page) {
  await page.route(/live365\.com/, (route) => route.abort());
  await page.route(/decibillyjoel\.github\.io/, (route) => route.abort());
}

async function audit(page) {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    }));
  });
}

for (const { hash, panel } of ROUTES) {
  test(`${hash} has no WCAG 2.0 or 2.1 A and AA violations`, async ({ page }) => {
    await blockEmbed(page);
    await page.goto(`/${hash}`);
    await expect(page.locator(`#panel-${panel}`)).toBeVisible();

    expect(await audit(page)).toEqual([]);
  });
}

test('the 404 page has no WCAG 2.0 or 2.1 A and AA violations', async ({ page }) => {
  await blockEmbed(page);
  const response = await page.goto('/some/typo');
  expect(response?.status()).toBe(404);

  expect(await audit(page)).toEqual([]);
});

// A short viewport makes every panel overflow, which exercises the
// scrollable-region-focusable rule.
test('every view passes at a short mobile viewport', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 390, height: 480 });

  const failures = [];
  for (const { hash, panel } of ROUTES) {
    await page.goto(`/${hash}`);
    await expect(page.locator(`#panel-${panel}`)).toBeVisible();
    const violations = await audit(page);
    if (violations.length > 0) failures.push({ hash, violations });
  }

  expect(failures).toEqual([]);
});

// The light palette carries its own contrast on a light background, so it needs
// its own pass rather than a shared one.
test('every view passes in the light theme', async ({ page }) => {
  await blockEmbed(page);
  await page.emulateMedia({ colorScheme: 'light' });

  const failures = [];
  for (const { hash, panel } of ROUTES) {
    await page.goto(`/${hash}`);
    await expect(page.locator(`#panel-${panel}`)).toBeVisible();
    const violations = await audit(page);
    if (violations.length > 0) failures.push({ hash, violations });
  }

  expect(failures).toEqual([]);
});

test('the dark theme keeps the toggle reachable and correctly named', async ({ page }) => {
  await blockEmbed(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const toggle = page.locator('[data-theme-toggle]');
  await expect(toggle).toHaveAttribute('aria-label', 'Theme: auto');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-pref', 'light');
  await expect(toggle).toHaveAttribute('aria-label', 'Theme: light');

  expect(await audit(page)).toEqual([]);
});

import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

const ROUTES = [
  { hash: '#whoami', panel: 'who-am-i' },
  { hash: '#links', panel: 'links' },
  { hash: '#projects', panel: 'projects' },
  { hash: '#radio', panel: 'projects' },
  { hash: '#game', panel: 'projects' },
];

async function blockEmbed(page) {
  await page.route(/live365\.com/, (route) => route.abort());
  await page.route(/decibillyjoel\.github\.io/, (route) => route.abort());
}

for (const { hash, panel } of ROUTES) {
  test(`${hash} has no WCAG 2.0 or 2.1 A and AA violations`, async ({ page }) => {
    await blockEmbed(page);
    await page.goto(`/${hash}`);
    await expect(page.locator(`#panel-${panel}`)).toBeVisible();

    await page.addScriptTag({ path: AXE_PATH });
    const violations = await page.evaluate(async () => {
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

    expect(violations).toEqual([]);
  });
}

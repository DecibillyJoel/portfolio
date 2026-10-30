import { test, expect } from '@playwright/test';

const TAB_IDS = ['who-am-i', 'links', 'projects'];
const tab = (page, id) => page.locator(`#tab-${id}`);
const panel = (page, id) => page.locator(`#panel-${id}`);
const subTab = (page, id) => page.locator(`[data-sub-tab-target="${id}"]`);
const loadedFrames = (page) => page.locator('iframe[data-loaded="true"]');

async function blockEmbed(page) {
  await page.route(/live365\.com/, (route) => route.abort());
  await page.route(/decibillyjoel\.github\.io/, (route) => route.abort());
}

test('viewport below 320px does not scroll sideways', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 319, height: 700 });
  await page.goto('/');
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test('resizing across the 900px breakpoint does not swap or reload the embed', async ({ page }) => {
  await blockEmbed(page);
  await page.addInitScript(() => {
    window.__loads = (window.__loads ?? 0) + 1;
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  await tab(page, 'projects').click();
  await subTab(page, 'maximum-slappage').click();
  const before = await page.evaluate(() => {
    const frame = document.querySelector('iframe');
    window.__iframeRef = frame;
    return frame.getAttribute('src');
  });
  expect(before).toContain('s=xl');

  await page.setViewportSize({ width: 390, height: 844 });
  const afterShrink = await page.evaluate(() => ({
    loads: window.__loads,
    same: document.querySelector('iframe') === window.__iframeRef,
    src: document.querySelector('iframe').getAttribute('src'),
  }));
  expect(afterShrink.loads).toBe(1);
  expect(afterShrink.same).toBe(true);
  expect(afterShrink.src).toContain('s=xl');

  await page.setViewportSize({ width: 1280, height: 720 });
  const afterGrow = await page.evaluate(() => ({
    loads: window.__loads,
    same: document.querySelector('iframe') === window.__iframeRef,
    src: document.querySelector('iframe').getAttribute('src'),
  }));
  expect(afterGrow.loads).toBe(1);
  expect(afterGrow.same).toBe(true);
  expect(afterGrow.src).toContain('s=xl');
});

test('blocked embeds still render the page and switch tabs', async ({ page }) => {
  await blockEmbed(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(panel(page, 'who-am-i')).toBeVisible();

  await tab(page, 'projects').click();
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(page.locator('[data-project="maximum-slappage"] h3')).toHaveText('MAXIMUM SLAPPAGE');
  await expect(page.locator('[data-project="maximum-slappage"] .tagline')).toContainText('live internet radio');
  await expect(subTab(page, 'maximum-slappage')).toBeVisible();
  await expect(subTab(page, 'smiles')).toBeVisible();

  await tab(page, 'links').click();
  await expect(panel(page, 'links')).toBeVisible();
  await expect(panel(page, 'who-am-i')).toBeHidden();

  await tab(page, 'projects').click();
  await expect(panel(page, 'projects')).toBeVisible();

  await tab(page, 'who-am-i').click();
  await expect(panel(page, 'who-am-i')).toBeVisible();

  expect(errors).toEqual([]);
});

test('all tabs and the sub-tabs are reachable and activatable with the keyboard', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  let seen = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      return { id: active?.id ?? null, isSubTab: !!active?.closest('.sub-tabs') };
    });
    seen.push(focus.id ?? (focus.isSubTab ? 'sub-tab' : 'other'));
    if (focus.id === 'tab-projects') break;
  }
  for (const id of TAB_IDS) {
    expect(seen).toContain(`tab-${id}`);
  }

  await page.keyboard.press('Enter');
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'true');

  let onSubTab = false;
  for (let i = 0; i < 5 && !onSubTab; i += 1) {
    await page.keyboard.press('Tab');
    onSubTab = await page.evaluate(() => !!document.activeElement?.closest('.sub-tabs'));
  }
  expect(onSubTab).toBe(true);
  await page.keyboard.press('Enter');
  await expect(loadedFrames(page)).toHaveCount(1);
});

test('first load and mid-session reload land on the default tab with no autoplay', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await expect(panel(page, 'who-am-i')).toBeVisible();
  await expect(tab(page, 'who-am-i')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'false');

  await tab(page, 'projects').click();
  await expect(panel(page, 'projects')).toBeVisible();

  await page.reload();
  await expect(panel(page, 'who-am-i')).toBeVisible();
  await expect(tab(page, 'who-am-i')).toHaveAttribute('aria-selected', 'true');

  const autoplay = await page.evaluate(() => ({
    attributeCount: document.querySelectorAll('[autoplay]').length,
    iframeAllows: document.querySelector('iframe').getAttribute('allow') ?? '',
    iframeSrc: document.querySelector('iframe').getAttribute('src') ?? '',
  }));
  expect(autoplay.attributeCount).toBe(0);
  expect(autoplay.iframeAllows).not.toContain('autoplay');
  expect(autoplay.iframeSrc).not.toContain('autoplay');
});

test('projects load nothing until a project is chosen', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();

  await expect(loadedFrames(page)).toHaveCount(0);
  await expect(page.locator('[data-project]:visible')).toHaveCount(0);
  await expect(page.locator('[data-project-empty]')).toBeVisible();
  await expect(subTab(page, 'maximum-slappage')).toHaveAttribute('aria-selected', 'false');
  await expect(subTab(page, 'smiles')).toHaveAttribute('aria-selected', 'false');
});

test('only one project embed is loaded at a time', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();

  await subTab(page, 'maximum-slappage').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /live365\.com/);
  await expect(page.locator('[data-project]:visible')).toHaveCount(1);
  await expect(page.locator('[data-project="maximum-slappage"]')).toBeVisible();
  await expect(page.locator('[data-project-empty]')).toBeHidden();

  await subTab(page, 'smiles').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /decibillyjoel\.github\.io/);
  await expect(page.locator('[data-project]:visible')).toHaveCount(1);
  await expect(page.locator('[data-project="smiles"]')).toBeVisible();

  await subTab(page, 'maximum-slappage').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /live365\.com/);
  await expect(page.locator('[data-project]:visible')).toHaveCount(1);
  await expect(page.locator('[data-project="maximum-slappage"]')).toBeVisible();
});

test('status badge tracks the radio and game embeds', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  const badge = page.locator('[data-on-air]');
  await expect(badge).toHaveText('[ OFF AIR ]');
  await expect(badge).toBeDisabled();

  await tab(page, 'projects').click();
  await expect(badge).toHaveText('[ OFF AIR ]');

  await subTab(page, 'maximum-slappage').click();
  await expect(badge).toHaveText('[ ON AIR ]');
  await expect(badge).toBeEnabled();

  await subTab(page, 'smiles').click();
  await expect(badge).toHaveText('[ GAME PLAYING ]');
  await expect(badge).toBeDisabled();

  await tab(page, 'links').click();
  await expect(badge).toHaveText('[ GAME PAUSED ]');
  await expect(badge).toBeEnabled();

  await page.evaluate(() => {
    window.__gameFrame = document.querySelector('iframe[data-embed-kind="iframe"]');
  });
  await badge.click();
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(badge).toHaveText('[ GAME PLAYING ]');
  await expect(subTab(page, 'smiles')).toHaveAttribute('aria-selected', 'true');
  const same = await page.evaluate(
    () => document.querySelector('iframe[data-embed-kind="iframe"]') === window.__gameFrame,
  );
  expect(same).toBe(true);
});

test('clicking the ON AIR badge returns to the radio', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();
  await subTab(page, 'maximum-slappage').click();
  const badge = page.locator('[data-on-air]');
  await expect(badge).toHaveText('[ ON AIR ]');

  await tab(page, 'who-am-i').click();
  await expect(panel(page, 'who-am-i')).toBeVisible();
  await expect(badge).toHaveText('[ ON AIR ]');
  await badge.click();

  await expect(panel(page, 'projects')).toBeVisible();
  await expect(subTab(page, 'maximum-slappage')).toHaveAttribute('aria-selected', 'true');
  await expect(loadedFrames(page)).toHaveCount(1);
});

test('leaving Projects to a non-project tab keeps the project loaded', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();
  await subTab(page, 'maximum-slappage').click();
  await expect(loadedFrames(page)).toHaveCount(1);

  await tab(page, 'links').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(page.locator('[data-on-air]')).toHaveText('[ ON AIR ]');

  await tab(page, 'projects').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(subTab(page, 'maximum-slappage')).toHaveAttribute('aria-selected', 'true');
});

test('every Links card shows a brand icon', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await tab(page, 'links').click();
  await expect(panel(page, 'links')).toBeVisible();
  await expect(page.locator('#panel-links .card')).toHaveCount(8);
  await expect(page.locator('#panel-links .card .icon')).toHaveCount(8);
});

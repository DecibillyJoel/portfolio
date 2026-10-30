import { test, expect } from '@playwright/test';

const TAB_IDS = ['who-am-i', 'links', 'projects'];
const tab = (page, id) => page.locator(`#tab-${id}`);
const panel = (page, id) => page.locator(`#panel-${id}`);

async function blockEmbed(page) {
  await page.route(/live365\.com/, (route) => route.abort());
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

test('blocked Live365 embed still renders the page and switches tabs', async ({ page }) => {
  await blockEmbed(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.locator('h3')).toHaveText('MAXIMUM SLAPPAGE');
  await expect(page.locator('.tagline')).toContainText('live internet radio');
  await expect(page.locator('iframe')).toHaveCount(1);

  await tab(page, 'links').click();
  await expect(panel(page, 'links')).toBeVisible();
  await expect(panel(page, 'who-am-i')).toBeHidden();

  await tab(page, 'projects').click();
  await expect(panel(page, 'projects')).toBeVisible();

  await tab(page, 'who-am-i').click();
  await expect(panel(page, 'who-am-i')).toBeVisible();

  expect(errors).toEqual([]);
});

test('all tabs and the sub-tab are reachable and activatable with the keyboard', async ({ page }) => {
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

  await page.keyboard.press('Tab');
  const onSubTab = await page.evaluate(() => !!document.activeElement?.closest('.sub-tabs'));
  expect(onSubTab).toBe(true);
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
    iframeSrc: document.querySelector('iframe').getAttribute('src'),
  }));
  expect(autoplay.attributeCount).toBe(0);
  expect(autoplay.iframeAllows).not.toContain('autoplay');
  expect(autoplay.iframeSrc).not.toContain('autoplay');
});

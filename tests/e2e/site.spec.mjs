import { test, expect } from '@playwright/test';

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
  await expect(loadedFrames(page)).toHaveAttribute('src', /live365\.com/);
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
  await expect(page.locator('[data-project="maximum-slappage"] h2')).toHaveText('MAXIMUM SLAPPAGE');
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

test('keyboard alone reaches the tab bar and the sub-tabs and loads a project', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(tab(page, 'who-am-i')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'projects')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'true');

  let onSubTab = false;
  for (let i = 0; i < 5 && !onSubTab; i += 1) {
    await page.keyboard.press('Tab');
    onSubTab = await page.evaluate(() => !!document.activeElement?.closest('.sub-tabs'));
  }
  expect(onSubTab).toBe(true);
  await expect(subTab(page, 'maximum-slappage')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(subTab(page, 'smiles')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#game$/);
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(page.locator('[data-on-air]')).toHaveText('[ GAME RUNNING ]');
});

test('first load defaults to #whoami and reload keeps the current hash', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await expect(page).toHaveURL(/#whoami$/);
  await expect(panel(page, 'who-am-i')).toBeVisible();
  await expect(tab(page, 'who-am-i')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'false');

  await tab(page, 'projects').click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(panel(page, 'projects')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/#projects$/);
  await expect(panel(page, 'projects')).toBeVisible();

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

test('status badge announces the current state and never takes focus', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  const badge = page.locator('[data-on-air]');

  async function expectState(text) {
    await expect(badge).toHaveText(text);
    await expect(badge).toHaveAttribute('role', 'status');
    await expect(badge).not.toHaveAttribute('href');
    expect(await badge.evaluate((element) => element.tagName)).toBe('SPAN');
    expect(await badge.evaluate((element) => element.tabIndex)).toBe(-1);
    expect(
      await badge.evaluate((element) => {
        element.focus();
        return document.activeElement === element;
      }),
    ).toBe(false);
  }

  await expectState('[ OFF AIR ]');

  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab');
    const onBadge = await page.evaluate(
      () => document.activeElement?.hasAttribute('data-on-air') ?? false,
    );
    expect(onBadge).toBe(false);
  }

  await tab(page, 'projects').click();
  await expectState('[ OFF AIR ]');

  await subTab(page, 'maximum-slappage').click();
  await expectState('[ ON AIR ]');

  await subTab(page, 'smiles').click();
  await expectState('[ GAME RUNNING ]');

  await tab(page, 'links').click();
  await expectState('[ GAME PAUSED ]');
  await expect(panel(page, 'links')).toBeVisible();
});

test('the tab bar moves focus with arrow keys and activates with Enter', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await expect(page).toHaveURL(/#whoami$/);

  const focusableTabs = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[role="tablist"] [role="tab"]')]
        .filter((item) => item.dataset.tabTarget)
        .filter((item) => item.tabIndex === 0)
        .map((item) => item.id),
    );
  expect(await focusableTabs()).toEqual(['tab-who-am-i']);

  await tab(page, 'links').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'certifications')).toBeFocused();
  await expect(page).toHaveURL(/#whoami$/);

  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'projects')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'who-am-i')).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'projects')).toBeFocused();

  await page.keyboard.press('Home');
  await expect(tab(page, 'who-am-i')).toBeFocused();

  await page.keyboard.press('End');
  await expect(tab(page, 'projects')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'who-am-i')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'links')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#links$/);
  await expect(panel(page, 'links')).toBeVisible();
  await expect(tab(page, 'links')).toBeFocused();
  expect(await focusableTabs()).toEqual(['tab-links']);
});

test('the skip link reaches main content without changing the visible view', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/#projects');
  await expect(panel(page, 'projects')).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await expect(page.locator('#main')).toBeFocused();
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'true');
});

test('leaving Projects to a non-project tab keeps the project loaded', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();
  await subTab(page, 'maximum-slappage').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await page.evaluate(() => {
    window.__radioFrame = document.querySelector('iframe[data-embed-kind="player"]');
  });

  await tab(page, 'links').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(page.locator('[data-on-air]')).toHaveText('[ ON AIR ]');

  await tab(page, 'projects').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(subTab(page, 'maximum-slappage')).toHaveAttribute('aria-selected', 'true');
  expect(
    await page.evaluate(
      () => document.querySelector('iframe[data-embed-kind="player"]') === window.__radioFrame,
    ),
  ).toBe(true);
});

test('every Links card shows a brand icon', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await tab(page, 'links').click();
  await expect(panel(page, 'links')).toBeVisible();
  await expect(page.locator('#panel-links .card')).toHaveCount(8);
  await expect(page.locator('#panel-links .card .icon')).toHaveCount(8);
});

test('every Certification card shows its issuer, dates, and an official page', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await tab(page, 'certifications').click();
  await expect(panel(page, 'certifications')).toBeVisible();

  const cards = page.locator('#panel-certifications .cert');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText('CompTIA A+');
  await expect(cards.nth(0)).toContainText('Sep 2026 – Sep 2029');
  await expect(cards.nth(3)).toContainText('Autodesk AutoCAD Certified User');
  await expect(cards.nth(3)).toContainText('Jan 2016');

  const anchors = page.locator('#panel-certifications .cert a');
  await expect(anchors).toHaveCount(4);
  expect(await anchors.evaluateAll((nodes) => nodes.map((node) => node.href))).toEqual([
    'https://www.comptia.org/certifications/a',
    'https://learn.microsoft.com/en-us/credentials/certifications/mos-excel-expert-m365-apps/',
    'https://learn.microsoft.com/en-us/credentials/certifications/exams/98-349',
    'https://certiport.pearsonvue.com/Certifications/Autodesk/Certifications/Certify#AutoCAD',
  ]);
  expect(
    await anchors.evaluateAll((nodes) =>
      nodes.every((node) => node.target === '_blank' && node.rel.includes('noopener')),
    ),
  ).toBe(true);

  // The credential links live on LinkedIn, but the page must not link to it.
  await expect(page.locator('#panel-certifications a[href*="linkedin"]')).toHaveCount(0);
  await expect(panel(page, 'certifications')).toContainText('you can find them on my LinkedIn page');
});

test('every view has its own hash URL', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await expect(page).toHaveURL(/#whoami$/);

  await tab(page, 'links').click();
  await expect(page).toHaveURL(/#links$/);

  await tab(page, 'certifications').click();
  await expect(page).toHaveURL(/#certs$/);

  await tab(page, 'projects').click();
  await expect(page).toHaveURL(/#projects$/);

  await subTab(page, 'maximum-slappage').click();
  await expect(page).toHaveURL(/#radio$/);

  await subTab(page, 'smiles').click();
  await expect(page).toHaveURL(/#game$/);
});

test('a deep link opens the matching view on first load', async ({ page }) => {
  await blockEmbed(page);

  await page.goto('/#game');
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(subTab(page, 'smiles')).toHaveAttribute('aria-selected', 'true');
  await expect(loadedFrames(page)).toHaveAttribute('src', /decibillyjoel\.github\.io/);
  await expect(page.locator('[data-on-air]')).toHaveText('[ GAME RUNNING ]');

  await page.goto('/#radio');
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(subTab(page, 'maximum-slappage')).toHaveAttribute('aria-selected', 'true');
  await expect(loadedFrames(page)).toHaveAttribute('src', /live365\.com/);
  await expect(page.locator('[data-on-air]')).toHaveText('[ ON AIR ]');

  await page.goto('/#certs');
  await expect(panel(page, 'certifications')).toBeVisible();
  await expect(tab(page, 'certifications')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-certifications h3')).toHaveCount(4);
});

test('browser back and forward move between views without a reload', async ({ page }) => {
  await blockEmbed(page);
  await page.addInitScript(() => {
    window.__loads = (window.__loads ?? 0) + 1;
  });
  await page.goto('/');
  await tab(page, 'projects').click();
  await subTab(page, 'maximum-slappage').click();
  await expect(page).toHaveURL(/#radio$/);

  await page.goBack();
  await expect(page).toHaveURL(/#projects$/);
  await expect(panel(page, 'projects')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#whoami$/);
  await expect(panel(page, 'who-am-i')).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/#projects$/);

  expect(await page.evaluate(() => window.__loads)).toBe(1);
});

test('an unknown path returns a 404 page with links back to the views', async ({ page }) => {
  await blockEmbed(page);

  const response = await page.goto('/some/typo');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /404/ })).toBeVisible();
  await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main');
  await expect(page.locator('#main')).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveCount(0);

  const links = page.locator('.routes a');
  await expect(links).toHaveCount(6);
  const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(hrefs).toEqual(['/#whoami', '/#links', '/#certs', '/#projects', '/#radio', '/#game']);

  await page.locator('.routes a', { hasText: 'Projects' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(panel(page, 'projects')).toBeVisible();
});

import { test, expect } from '@playwright/test';
import {
  mobileMax,
  pairRowMin,
  statusRowMax,
  tabsInlineMin,
  tabsWrapMax,
  toggleHideMax,
  toggleInlineMin,
  wideMin,
} from '../../src/data/layout.js';

const tab = (page, id) => page.locator(`#tab-${id}`);
const viewLink = (page, id) => page.locator(`[data-view="${id}"]`);
const panel = (page, id) => page.locator(`#panel-${id}`);
const subTab = (page, id) => page.locator(`[data-sub-tab-target="${id}"]`);
const loadedFrames = (page) => page.locator('iframe[data-loaded="true"]');

async function blockEmbed(page) {
  await page.route(/live365\.com/, (route) => route.abort());
  await page.route(/decibillyjoel\.github\.io/, (route) => route.abort());
  await page.route(/soundcloud\.com/, (route) => route.abort());
}

// A stub keeps the focus tests offline. It stays cross-origin, and its focusable
// canvas keeps the frame in the parent tab order the way the real embeds do.
const EMBED_STUB =
  '<!doctype html><html lang="en"><body><canvas tabindex="0"></canvas></body></html>';

async function stubEmbed(page) {
  await page.route(/live365\.com|decibillyjoel\.github\.io|soundcloud\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: EMBED_STUB }),
  );
}

async function tabIntoEmbed(page, selector) {
  await page.evaluate(() => document.getElementById('main')?.focus());
  // The budget covers the sub-tabs, the scrolling body and the project link that
  // sit between the top of the panel and the frame.
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(
      (sel) => document.activeElement === document.querySelector(sel),
      selector,
    );
    if (inside) return true;
  }
  return false;
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
  await expect(panel(page, 'about')).toBeVisible();

  await tab(page, 'projects').click();
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(page.locator('[data-project="maximum-slappage"] h2')).toHaveText('MAXIMUM SLAPPAGE');
  await expect(page.locator('[data-project="maximum-slappage"] .tagline')).toContainText('live internet radio');
  await expect(subTab(page, 'maximum-slappage')).toBeVisible();
  await expect(subTab(page, 'portfolio')).toBeVisible();
  await expect(subTab(page, 'smiles')).toBeVisible();

  await viewLink(page, 'about').click();
  await expect(panel(page, 'about')).toBeVisible();
  await expect(panel(page, 'projects')).toBeHidden();

  await tab(page, 'projects').click();
  await expect(panel(page, 'projects')).toBeVisible();

  await tab(page, 'certifications').click();
  await expect(panel(page, 'certifications')).toBeVisible();

  await viewLink(page, 'about').click();
  await expect(panel(page, 'about')).toBeVisible();

  expect(errors).toEqual([]);
});

test('keyboard alone reaches the tab bar and the sub-tabs and loads a project', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(viewLink(page, 'about')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(tab(page, 'projects')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'certifications')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(tab(page, 'projects')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(tab(page, 'certifications')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'projects')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'certifications')).toBeFocused();
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
  await expect(subTab(page, 'portfolio')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(subTab(page, 'maximum-slappage')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(subTab(page, 'smiles')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#game$/);
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(page.locator('[data-on-air]')).toHaveText('[ PLAYING ]');
});

test('first load defaults to #about and reload keeps the current hash', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await expect(page).toHaveURL(/#about$/);
  await expect(panel(page, 'about')).toBeVisible();
  // About Me is a view, not a tab, so the landing view selects no tab.
  await expect(viewLink(page, 'about')).toHaveAttribute('aria-current', 'true');
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'false');
  await expect(tab(page, 'certifications')).toHaveAttribute('aria-selected', 'false');

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

test('the Projects view opens on its first project and loads no embed', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();

  // The view opens on the Portfolio project, which carries no embed of its own,
  // so nothing third party loads until a project with one is chosen.
  await expect(page.locator('[data-project]:visible')).toHaveCount(1);
  await expect(page.locator('[data-project="portfolio"]')).toBeVisible();
  await expect(loadedFrames(page)).toHaveCount(0);
  await expect(page.locator('[data-project-empty]')).toHaveCount(0);
  await expect(subTab(page, 'portfolio')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/#projects$/);

  await page.goto('/#projects');
  await expect(page.locator('[data-project="portfolio"]')).toBeVisible();
  await expect(subTab(page, 'portfolio')).toHaveAttribute('aria-selected', 'true');
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

test('the Portfolio project leaves the radio player mounted', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();

  await subTab(page, 'maximum-slappage').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /live365\.com/);
  await page.evaluate(() => {
    window.__radio = document.querySelector('[data-project="maximum-slappage"] iframe[data-embed]');
  });

  await subTab(page, 'portfolio').click();
  await expect(page.locator('[data-project="portfolio"]')).toBeVisible();
  await expect(page.locator('[data-project="maximum-slappage"]')).toBeHidden();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(page.locator('[data-on-air]')).toHaveText('[ ON AIR ]');

  const radio = await page.evaluate(() => ({
    same: window.__radio === document.querySelector('[data-project="maximum-slappage"] iframe[data-embed]'),
    src: window.__radio.getAttribute('src'),
  }));
  expect(radio.same).toBe(true);
  expect(radio.src).toMatch(/live365\.com/);

  await subTab(page, 'smiles').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /decibillyjoel\.github\.io/);
  await expect(page.locator('[data-project="maximum-slappage"] iframe[data-embed]')).toHaveAttribute(
    'src',
    'about:blank',
  );
});

test('the Portfolio project leaves the game mounted', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();

  await subTab(page, 'smiles').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /decibillyjoel\.github\.io/);

  await subTab(page, 'portfolio').click();
  await expect(page.locator('[data-project="portfolio"]')).toBeVisible();
  await expect(page.locator('[data-project="smiles"]')).toBeHidden();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /decibillyjoel\.github\.io/);
  await expect(page.locator('[data-on-air]')).toHaveText('[ PLAYING ]');
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
  await expectState('[ PLAYING ]');

  await viewLink(page, 'about').click();
  await expectState('[ PAUSED ]');
  await expect(panel(page, 'about')).toBeVisible();

  await tab(page, 'projects').click();
  await expectState('[ PLAYING ]');

  await subTab(page, 'soundcloud').click();
  await expectState('[ VIBING ]');

  await viewLink(page, 'about').click();
  await expectState('[ VIBING ]');
});

test('the tab bar moves focus with arrow keys and activates with Enter', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await expect(page).toHaveURL(/#about$/);

  const focusableTabs = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[role="tablist"] [role="tab"]')]
        .filter((item) => item.dataset.tabTarget)
        .filter((item) => item.tabIndex === 0)
        .map((item) => item.id),
    );
  expect(await focusableTabs()).toEqual(['tab-projects']);

  await tab(page, 'projects').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'certifications')).toBeFocused();
  await expect(page).toHaveURL(/#about$/);

  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'projects')).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'certifications')).toBeFocused();

  await page.keyboard.press('Home');
  await expect(tab(page, 'projects')).toBeFocused();

  await page.keyboard.press('End');
  await expect(tab(page, 'certifications')).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#certs$/);
  await expect(panel(page, 'certifications')).toBeVisible();
  await expect(tab(page, 'certifications')).toBeFocused();
  expect(await focusableTabs()).toEqual(['tab-certifications']);
});

test('the brand row link opens the About Me view and marks itself current', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();
  await expect(page).toHaveURL(/#projects$/);

  const link = viewLink(page, 'about');
  await link.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/#about$/);
  await expect(panel(page, 'about')).toBeVisible();
  await expect(link).toHaveAttribute('aria-current', 'true');
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'false');

  await page.goBack();
  await expect(page).toHaveURL(/#projects$/);
  await expect(link).not.toHaveAttribute('aria-current', 'true');
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'true');
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
  await expect(panel(page, 'not-found')).toBeHidden();
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

  await viewLink(page, 'about').click();
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

test('every About Me card shows a brand icon', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await expect(panel(page, 'about')).toBeVisible();
  await expect(page.locator('#panel-about .card')).toHaveCount(9);
  await expect(page.locator('#panel-about .card .icon')).toHaveCount(9);
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
  await expect(page).toHaveURL(/#about$/);

  await tab(page, 'projects').click();
  await expect(page).toHaveURL(/#projects$/);

  await tab(page, 'certifications').click();
  await expect(page).toHaveURL(/#certs$/);

  await viewLink(page, 'about').click();
  await expect(page).toHaveURL(/#about$/);

  await tab(page, 'projects').click();
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
  await expect(page.locator('[data-on-air]')).toHaveText('[ PLAYING ]');

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
  await expect(page).toHaveURL(/#about$/);
  await expect(panel(page, 'about')).toBeVisible();

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
  await expect(links).toHaveCount(7);
  const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(hrefs).toEqual(['/#about', '/#projects', '/#certs', '/#portfolio', '/#radio', '/#game', '/#audio']);

  await page.locator('.routes a', { hasText: 'Projects' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(panel(page, 'projects')).toBeVisible();
});

test('an unknown hash shows the 404 view in place, without a reload', async ({ page }) => {
  await blockEmbed(page);
  await page.addInitScript(() => {
    window.__loads = (window.__loads ?? 0) + 1;
  });
  await page.goto('/#about');
  await expect(panel(page, 'about')).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = '#thisdoesntexist';
  });

  await expect(panel(page, 'not-found')).toBeVisible();
  await expect(page).toHaveURL(/#thisdoesntexist$/);
  await expect(page.locator('[data-panel]:visible')).toHaveCount(1);
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(0);
  await expect(page).toHaveTitle('404 - @JoeOfSomeTrades');

  await page.goBack();
  await expect(page).toHaveURL(/#about$/);
  await expect(panel(page, 'about')).toBeVisible();
  await expect(viewLink(page, 'about')).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveTitle('@JoeOfSomeTrades');

  expect(await page.evaluate(() => window.__loads)).toBe(1);
});

test('the 404 view links back to every live view without a reload', async ({ page }) => {
  await blockEmbed(page);
  await page.addInitScript(() => {
    window.__loads = (window.__loads ?? 0) + 1;
  });
  await page.goto('/#nope');
  await expect(panel(page, 'not-found')).toBeVisible();

  const links = page.locator('#panel-not-found .routes a');
  await expect(links).toHaveCount(7);
  const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(hrefs).toEqual(['#about', '#projects', '#certs', '#portfolio', '#radio', '#game', '#audio']);

  await page.locator('#panel-not-found .routes a', { hasText: 'Certifications' }).click();
  await expect(page).toHaveURL(/#certs$/);
  await expect(panel(page, 'certifications')).toBeVisible();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  await expect(page).toHaveTitle('@JoeOfSomeTrades');

  expect(await page.evaluate(() => window.__loads)).toBe(1);
});

test('the game frame shows the site focus ring for keyboard focus only', async ({ page }) => {
  await stubEmbed(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/#game');
  await expect(loadedFrames(page)).toHaveCount(1);

  const frame = page.locator('#project-smiles iframe');
  const wrap = page.locator('#project-smiles .game');
  await expect(wrap).toHaveAttribute('data-embed-focus', 'false');

  expect(await tabIntoEmbed(page, '#project-smiles iframe')).toBe(true);
  await expect(wrap).toHaveAttribute('data-embed-focus', 'true');
  // A token resolves to a different colour in each theme, so the expectation
  // comes from rendering the same token rather than from a literal.
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('#project-smiles .game'));
    const probe = document.createElement('span');
    probe.style.color = 'var(--magenta)';
    document.body.appendChild(probe);
    const token = getComputedStyle(probe).color;
    probe.remove();
    return {
      outline: `${style.outlineStyle} ${style.outlineWidth}`,
      color: style.outlineColor,
      token,
    };
  });
  expect(ring.color).toBe(ring.token);
  expect(ring.outline).toBe('solid 2px');

  // A mouse click in the page drops the ring, and a later mouse click into the
  // game does not bring it back, because no keyboard reached the frame.
  await page.locator('#project-smiles h2').click();
  await expect(wrap).toHaveAttribute('data-embed-focus', 'false');

  const box = await frame.boundingBox();
  const body = await page.locator('.projects-scroll').boundingBox();
  // The frame is taller than the scrolling body, so its middle can sit below
  // the fold. Click the middle of the part that is on screen.
  const bottom = Math.min(box.y + box.height, body.y + body.height);
  await page.mouse.click(box.x + box.width / 2, box.y + (bottom - box.y) / 2);
  expect(await page.evaluate(() => document.activeElement.tagName)).toBe('IFRAME');
  await expect(wrap).toHaveAttribute('data-embed-focus', 'false');

  expect(await tabIntoEmbed(page, '#project-smiles iframe')).toBe(true);
  await expect(wrap).toHaveAttribute('data-embed-focus', 'true');
});

test('the radio player uses the same focus ring', async ({ page }) => {
  await stubEmbed(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/#radio');
  await expect(loadedFrames(page)).toHaveCount(1);

  const wrap = page.locator('#project-maximum-slappage .player');
  await expect(wrap).toHaveAttribute('data-embed-focus', 'false');

  expect(await tabIntoEmbed(page, '#project-maximum-slappage iframe')).toBe(true);
  await expect(wrap).toHaveAttribute('data-embed-focus', 'true');
});

const SHELL_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
];

test('the page fills the viewport at every size and only the panel body scrolls', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/#game');

  for (const size of SHELL_VIEWPORTS) {
    await page.setViewportSize(size);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const header = document.querySelector('.site-header');
      const tabs = document.querySelector('#panel-projects .sub-tabs');
      return {
        docHeight: [de.scrollHeight, de.clientHeight],
        docWidth: [de.scrollWidth, de.clientWidth],
        scrollY: window.scrollY,
        headerTop: header.getBoundingClientRect().top,
        headerBottom: header.getBoundingClientRect().bottom,
        tabsTop: tabs.getBoundingClientRect().top,
        panelOverflow: [...document.querySelectorAll('[data-panel]')]
          .filter((p) => !p.hidden)
          .map((p) => p.scrollHeight - p.clientHeight),
      };
    });
    const where = `${size.width}x${size.height}`;
    expect(m.docHeight[0], `document height at ${where}`).toBe(m.docHeight[1]);
    expect(m.docWidth[0], `document width at ${where}`).toBeLessThanOrEqual(m.docWidth[1]);
    expect(m.scrollY, `document scroll at ${where}`).toBe(0);
    expect(m.headerTop, `header top at ${where}`).toBe(0);
    expect(m.headerBottom, `header bottom at ${where}`).toBeLessThanOrEqual(size.height);
    expect(m.tabsTop, `sub-tab top at ${where}`).toBeLessThan(size.height);
    expect(m.panelOverflow, `panel scroll at ${where}`).toEqual([0]);
  }
});

test('the projects body scrolls while the header and the sub-tab bar stay in place', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/#game');

  const before = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const tabs = document.querySelector('#panel-projects .sub-tabs');
    const body = document.querySelector('#panel-projects .projects-scroll');
    return {
      headerTop: header.getBoundingClientRect().top,
      tabsTop: tabs.getBoundingClientRect().top,
      tabsBottom: tabs.getBoundingClientRect().bottom,
      bodyTop: body.getBoundingClientRect().top,
    };
  });

  // The scroll body starts where the sub-tab bar ends, so the scrollbar never
  // runs alongside the bar.
  expect(before.bodyTop).toBeGreaterThanOrEqual(before.tabsBottom);

  await page.evaluate(() => {
    const body = document.querySelector('#panel-projects .projects-scroll');
    body.scrollTop = body.scrollHeight;
  });

  const after = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const tabs = document.querySelector('#panel-projects .sub-tabs');
    const panel = document.querySelector('#panel-projects');
    const body = document.querySelector('#panel-projects .projects-scroll');
    return {
      scrollable: body.scrollHeight > body.clientHeight,
      bodyScrollTop: body.scrollTop,
      panelScrolls: panel.scrollHeight > panel.clientHeight,
      headerTop: header.getBoundingClientRect().top,
      tabsTop: tabs.getBoundingClientRect().top,
      scrollY: window.scrollY,
    };
  });

  expect(after.scrollable).toBe(true);
  expect(after.bodyScrollTop).toBeGreaterThan(0);
  expect(after.panelScrolls, 'the panel itself never scrolls').toBe(false);
  expect(after.tabsTop).toBe(before.tabsTop);
  expect(after.headerTop).toBe(before.headerTop);
  expect(after.scrollY).toBe(0);
});

test('the radio player scrolls inside the projects body on a short screen', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#radio');

  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const body = document.querySelector('#panel-projects .projects-scroll');
    return {
      docHeight: [de.scrollHeight, de.clientHeight],
      bodyHeight: [body.scrollHeight, body.clientHeight],
    };
  });

  expect(m.docHeight[0]).toBe(m.docHeight[1]);
  expect(m.bodyHeight[0]).toBeGreaterThan(m.bodyHeight[1]);
});

test('the projects body keeps its scroll position across a tab change', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/#game');

  await page.evaluate(() => {
    document.querySelector('#panel-projects .projects-scroll').scrollTop = 150;
  });
  await viewLink(page, 'about').click();
  await expect(panel(page, 'about')).toBeVisible();
  await tab(page, 'projects').click();
  await expect(panel(page, 'projects')).toBeVisible();

  const m = await page.evaluate(() => {
    const body = document.querySelector('#panel-projects .projects-scroll');
    return { scrollTop: body.scrollTop, scrollable: body.scrollHeight > body.clientHeight };
  });
  expect(m.scrollable).toBe(true);
  expect(m.scrollTop).toBe(150);
});

// ---- Theme --------------------------------------------------------------

function bodyBackground(page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

function themeState(page) {
  return page.evaluate(() => {
    const button = document.querySelector('[data-theme-toggle]');
    const shown = [...document.querySelectorAll('[data-theme-icon]')]
      .filter((svg) => getComputedStyle(svg).display !== 'none')
      .map((svg) => svg.dataset.themeIcon);
    return {
      attr: document.documentElement.getAttribute('data-theme-pref'),
      label: button.getAttribute('aria-label'),
      title: button.title,
      shown,
      stored: window.localStorage.getItem('theme-pref'),
      bg: getComputedStyle(document.body).backgroundColor,
    };
  });
}

const LIGHT_BG = 'rgb(233, 239, 231)';
const DARK_BG = 'rgb(8, 11, 9)';

test('the auto theme follows the system setting with no attribute set', async ({ page }) => {
  await blockEmbed(page);

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  expect(await page.locator('html').getAttribute('data-theme-pref')).toBe(null);
  expect(await bodyBackground(page)).toBe(LIGHT_BG);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => bodyBackground(page)).toBe(DARK_BG);
  expect(await page.locator('html').getAttribute('data-theme-pref')).toBe(null);
});

test('the toggle cycles auto, light, dark and back', async ({ page }) => {
  await blockEmbed(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const toggle = page.locator('[data-theme-toggle]');
  const auto = {
    attr: null,
    label: 'Theme: auto',
    title: 'Theme: auto',
    shown: ['auto'],
    stored: null,
    bg: DARK_BG,
  };

  expect(await themeState(page)).toEqual(auto);

  await toggle.click();
  expect(await themeState(page)).toEqual({
    attr: 'light',
    label: 'Theme: light',
    title: 'Theme: light',
    shown: ['light'],
    stored: 'light',
    bg: LIGHT_BG,
  });

  await toggle.click();
  expect(await themeState(page)).toEqual({
    attr: 'dark',
    label: 'Theme: dark',
    title: 'Theme: dark',
    shown: ['dark'],
    stored: 'dark',
    bg: DARK_BG,
  });

  await toggle.click();
  expect(await themeState(page)).toEqual(auto);
});

test('a pinned theme overrides the system setting and survives a reload', async ({ page }) => {
  await blockEmbed(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await page.locator('[data-theme-toggle]').click();
  expect(await bodyBackground(page)).toBe(LIGHT_BG);

  await page.reload();
  expect(await page.locator('html').getAttribute('data-theme-pref')).toBe('light');
  expect(await bodyBackground(page)).toBe(LIGHT_BG);
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute(
    'aria-label',
    'Theme: light',
  );
});

test('the toggle sits in the header after the status badge and hides its icons', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await expect(page.locator('.site-header [data-on-air] + [data-theme-toggle]')).toHaveCount(1);
  await expect(page.locator('[data-theme-toggle] svg')).toHaveCount(3);
  await expect(page.locator('[data-theme-toggle] svg[aria-hidden="true"]')).toHaveCount(3);
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('title', /^Theme: /);
});

test('neither theme scrolls the document at 1280x720 or 390x844', async ({ page }) => {
  await blockEmbed(page);

  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const size of [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.goto('/');
      const m = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        headerHeight: Math.round(
          document.querySelector('.site-header').getBoundingClientRect().height,
        ),
      }));
      const note = JSON.stringify({ scheme, size, m });
      expect(m.scrollWidth, note).toBe(m.viewportWidth);
      expect(m.scrollHeight, note).toBe(m.viewportHeight);
      // The header is three rows at this width once the type is large, so the
      // guard is a share of the screen rather than a pixel height.
      if (size.width === 390) expect(m.headerHeight, note).toBeLessThan(m.viewportHeight / 3);
    }
  }
});

// The prompt and the brackets are decoration. A screen reader must hear the
// plain words, so check the accessible name, not the markup.
test('the tabs, the sub-tabs, the badge and the route links are named without decoration', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');

  await expect(tab(page, 'projects')).toHaveAccessibleName('Projects');
  await expect(tab(page, 'certifications')).toHaveAccessibleName('Certifications');
  await expect(page.locator('[data-on-air]')).toHaveText('[ OFF AIR ]');
  // A status region takes no name from content, so read what it exposes.
  expect(await page.locator('[data-on-air]').ariaSnapshot()).toBe('- status: OFF AIR');

  await tab(page, 'projects').click();
  await expect(subTab(page, 'smiles')).toHaveAccessibleName('Smiles Sadistic Adventure');
  await subTab(page, 'maximum-slappage').click();
  await expect(subTab(page, 'maximum-slappage')).toHaveAccessibleName('Maximum Slappage');
  await expect(page.locator('[data-on-air]')).toHaveText('[ ON AIR ]');
  expect(await page.locator('[data-on-air]').ariaSnapshot()).toBe('- status: ON AIR');

  await page.goto('/#thisdoesntexist');
  await expect(page.locator('.routes a').first()).toHaveAccessibleName('About Me');
});

// The mobile browser bar should match the page, including when the choice is
// pinned against the system setting.
test('the browser chrome colour follows the page colour in both themes', async ({ page }) => {
  await blockEmbed(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const metaColor = () => page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.content ?? null,
  );

  await expect.poll(metaColor).toBe(DARK_BG);
  expect(await metaColor()).toBe(await bodyBackground(page));

  await page.click('[data-theme-toggle]');
  await expect.poll(() => bodyBackground(page)).toBe(LIGHT_BG);
  await expect.poll(metaColor).toBe(LIGHT_BG);
});

test('the sub-tab bar reads as the second level of chrome', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/#portfolio');

  const m = await page.evaluate(() => {
    const height = (el) => Math.round(el.getBoundingClientRect().height);
    const sub = document.querySelector('#panel-projects .sub-tabs a');
    return {
      header: height(document.querySelector('.site-header')),
      bar: height(document.querySelector('#panel-projects .sub-tabs')),
      tabFont: parseFloat(getComputedStyle(document.querySelector('.tab-bar a')).fontSize),
      subFont: parseFloat(getComputedStyle(sub).fontSize),
      subTarget: height(sub),
      subColor: getComputedStyle(sub).color,
    };
  });

  expect(m.bar, JSON.stringify(m)).toBeLessThan(m.header);
  expect(m.subFont, JSON.stringify(m)).toBeLessThan(m.tabFont);
  expect(m.subTarget, 'a sub-tab keeps a 24px pointer target').toBeGreaterThanOrEqual(24);
});

// Each part of the header gives way only at its own measured threshold, so the
// header keeps one row while the handle, the tabs and the status pair fit
// together, and only the part that no longer fits drops a line.
test('the header gives way one part at a time as the width falls', async ({ page }) => {
  await blockEmbed(page);

  const measure = async (width) => {
    await page.setViewportSize({ width, height: 800 });
    // The game view carries the widest badge, PLAYING, and a selected tab adds
    // its prompt to the tab list, so this is the tightest the header gets.
    await page.goto('/#game');
    await expect(panel(page, 'projects')).toBeVisible();
    return page.evaluate(() => {
      const box = (sel) => {
        const rect = document.querySelector(sel).getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      };
      return {
        brand: box('.brand'),
        status: box('.status'),
        badge: box('.on-air'),
        toggle: box('.theme-toggle'),
        bar: box('.tab-bar'),
        divider: box('.divider'),
        dividerDisplay: getComputedStyle(document.querySelector('.divider')).display,
        badgeDisplay: getComputedStyle(document.querySelector('.on-air')).display,
        statusDisplay: getComputedStyle(document.querySelector('.status')).display,
        scrollW: document.documentElement.scrollWidth,
        vw: window.innerWidth,
      };
    });
  };

  // The pair reads as one control wherever it sits: the badge and the toggle
  // always share one row.
  const sameRow = (m) => Math.abs(m.badge.top - m.toggle.top) <= 8;
  // The divider belongs to the row the handle and the tabs share, so it goes as
  // soon as the tabs take a line of their own.
  const dividerShown = (m) => m.dividerDisplay !== 'none';
  // While the pair has room beside the handle it shares the handle's row.
  const sharesHandleRow = (m) => m.status.top <= m.brand.bottom;

  for (const width of [1280, 1200, wideMin, mobileMax, 960, tabsInlineMin, tabsWrapMax, 600, pairRowMin]) {
    const m = await measure(width);
    expect(sameRow(m), `the pair stays one row at ${width}`).toBe(true);
    // The badge sits on the tabs' row or above it, never below the tabs.
    expect(m.badge.top, `the badge against the tab bar at ${width}`).toBeLessThanOrEqual(m.bar.top + 4);
    expect(m.scrollW, `sideways scroll at ${width}`).toBe(m.vw);
    expect(m.badge.right, `the badge stays inside ${width}`).toBeLessThanOrEqual(m.vw);
  }

  // There is room for all three parts, so the tabs keep the top row and the
  // divider stands between the handle and the tabs.
  for (const width of [1280, wideMin, mobileMax, 960, tabsInlineMin]) {
    const m = await measure(width);
    expect(Math.abs(m.bar.top - m.badge.top), `the tabs share the top row at ${width}`).toBeLessThanOrEqual(20);
    expect(dividerShown(m), `the divider stands at ${width}`).toBe(true);
    expect(m.divider.bottom - m.divider.top, `the divider spans the handle at ${width}`).toBe(
      m.brand.bottom - m.brand.top,
    );
  }

  // The tabs no longer fit beside the pair, so they take a line of their own.
  // The divider goes with them, and the pair keeps the handle's row.
  for (const width of [tabsWrapMax, 600, pairRowMin]) {
    const m = await measure(width);
    expect(m.bar.top, `the tabs drop a line at ${width}`).toBeGreaterThan(m.badge.top + 20);
    expect(dividerShown(m), `the divider goes at ${width}`).toBe(false);
    expect(sameRow(m), `the pair keeps its row at ${width}`).toBe(true);
    expect(sharesHandleRow(m), `the pair shares the handle row at ${width}`).toBe(true);
  }

  // Under that width the badge has no room beside the handle either, so it
  // steps out of the header and the toggle keeps the handle's row on its own.
  for (const width of [statusRowMax, 390, toggleInlineMin]) {
    const m = await measure(width);
    expect(m.badgeDisplay, `the badge steps out at ${width}`).toBe('none');
    expect(m.statusDisplay, `the toggle stays at ${width}`).not.toBe('none');
    expect(m.toggle.top, `the toggle keeps the handle row at ${width}`).toBeLessThan(m.brand.bottom);
    expect(m.toggle.right, `the toggle stays inside ${width}`).toBeLessThanOrEqual(m.vw);
    expect(m.bar.top, `the tabs take their own row at ${width}`).toBeGreaterThan(m.brand.bottom);
    expect(m.scrollW, `sideways scroll at ${width}`).toBe(m.vw);
  }

  // Under that width the toggle has no room either, so the header keeps only
  // the handle and the tabs. Neither control wraps to a line of its own.
  for (const width of [toggleHideMax, 320]) {
    const m = await measure(width);
    expect(m.statusDisplay, `the controls step out at ${width}`).toBe('none');
    expect(m.bar.top, `the tabs take their own row at ${width}`).toBeGreaterThan(m.brand.bottom);
    expect(m.brand.right, `the handle stays inside ${width}`).toBeLessThanOrEqual(m.vw);
    expect(m.scrollW, `sideways scroll at ${width}`).toBe(m.vw);
  }
});

test('the landing view marks the brand row link as current', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await expect(page).toHaveURL(/#about$/);

  await expect(panel(page, 'about')).toBeVisible();
  await expect(viewLink(page, 'about')).toHaveAttribute('aria-current', 'true');
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('.brand-link .prompt')).toBeVisible();

  // Leaving the view clears the mark, so only one item ever shows the prompt.
  await tab(page, 'projects').click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(viewLink(page, 'about')).not.toHaveAttribute('aria-current', 'true');
  await expect(tab(page, 'projects')).toHaveAttribute('aria-selected', 'true');
});

test('the Audio Productions project loads one frame and unloads the others', async ({ page }) => {
  await blockEmbed(page);
  await page.goto('/');
  await tab(page, 'projects').click();

  await subTab(page, 'maximum-slappage').click();
  await expect(loadedFrames(page)).toHaveCount(1);

  await subTab(page, 'soundcloud').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /soundcloud\.com/);
  await expect(page.locator('[data-project="soundcloud"]')).toBeVisible();
  await expect(page.locator('[data-project="maximum-slappage"] iframe[data-embed]')).toHaveAttribute(
    'src',
    'about:blank',
  );
  await expect(page.locator('[data-on-air]')).toHaveText('[ VIBING ]');

  await subTab(page, 'smiles').click();
  await expect(loadedFrames(page)).toHaveCount(1);
  await expect(loadedFrames(page)).toHaveAttribute('src', /decibillyjoel\.github\.io/);
  await expect(page.locator('[data-project="soundcloud"] iframe[data-embed]')).toHaveAttribute(
    'src',
    'about:blank',
  );
});

test('the Audio Productions frame picks its size from the viewport', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await tab(page, 'projects').click();
  await subTab(page, 'soundcloud').click();

  const frame = page.locator('[data-project="soundcloud"] iframe[data-embed]');
  await expect(frame).toHaveAttribute('src', /soundcloud\.com/);
  await expect(frame).toHaveAttribute('width', '800');
  await expect(frame).toHaveAttribute('height', '450');

  await page.setViewportSize({ width: 390, height: 844 });
  // A reload is the only way to mount again, because mounting happens once.
  await page.reload();
  await expect(frame).toHaveAttribute('src', /soundcloud\.com/);
  await expect(frame).toHaveAttribute('width', '324');
  await expect(frame).toHaveAttribute('height', '520');
});

test('a wrapped row of tabs takes the same air the header uses between its rows', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#projects');
  await expect(panel(page, 'projects')).toBeVisible();

  const marks = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-sub-tab-target]')];
    return items.map((item) => ({
      label: item.textContent.trim(),
      rowEnd: item.dataset.rowEnd === 'true',
      hairline: getComputedStyle(item, '::after').display,
    }));
  });

  // Three rows at this width, so the two items that end a row carry no hairline
  // and every other item keeps one.
  expect(marks.filter((m) => m.rowEnd).map((m) => m.label)).toEqual([
    '> Maximum Slappage',
    '> Smiles Sadistic Adventure',
  ]);
  for (const mark of marks) {
    if (mark.rowEnd) expect(mark.hairline, `${mark.label} ends a row`).toBe('none');
  }
  expect(marks[0].hairline).not.toBe('none');

  const gaps = await page.evaluate(() => {
    // The bars are measured by the boxes of their items, which is what the row
    // rule is placed against: it sits midway between the two rows.
    const box = (el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    };
    const rows = (els) => {
      const groups = [];
      for (const el of els) {
        const rect = box(el);
        const last = groups.at(-1);
        if (last && Math.abs(last.top - rect.top) <= 2) last.bottom = Math.max(last.bottom, rect.bottom);
        else groups.push({ ...rect });
      }
      return groups;
    };
    const subs = rows([...document.querySelectorAll('[data-sub-tab-target]')]);
    const tabs = rows([...document.querySelectorAll('[data-tab-target]')]);
    const brand = box(document.querySelector('.brand-link'));
    const rule = document.querySelector('.sub-tabs > .row-rule').getBoundingClientRect();
    return {
      subRows: subs.length,
      subGap: subs[1].top - subs[0].bottom,
      // The gap the header leaves between the handle row and the row of tabs
      // when the tabs have a row of their own.
      headerGap: tabs[0].top - brand.bottom,
      // How far the rule stands off the row above and the row below it.
      above: Math.round(rule.top - subs[0].bottom),
      below: Math.round(subs[1].top - rule.bottom),
    };
  });

  expect(gaps.subRows).toBeGreaterThan(1);
  expect(Math.abs(gaps.subGap - gaps.headerGap)).toBeLessThanOrEqual(1);
  // The line clears both rows it divides by the same amount, and that amount is
  // the one the sections leave between their entries and their outlines.
  expect(gaps.above).toBeGreaterThanOrEqual(7);
  expect(Math.abs(gaps.above - gaps.below)).toBeLessThanOrEqual(1);
});

test('a single row of sub-tabs keeps its hairline between every pair', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/#projects');
  await expect(panel(page, 'projects')).toBeVisible();

  const marks = await page.evaluate(() => ({
    wrapped: document.querySelector('.sub-tabs').dataset.wrapped ?? null,
    items: [...document.querySelectorAll('[data-sub-tab-target]')].map((item) => ({
      rowEnd: item.dataset.rowEnd ?? null,
      hairline: getComputedStyle(item, '::after').display,
    })),
  }));

  expect(marks.wrapped).toBeNull();
  expect(marks.items.map((m) => m.rowEnd)).toEqual([null, null, null, null]);
  // Every item but the last keeps a hairline, since no item here ends a row.
  expect(marks.items.slice(0, -1).map((m) => m.hairline)).toEqual(['block', 'block', 'block']);
});

test('a wrapped bar draws a rule between its rows and drops the hairline at a row end', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: tabsWrapMax, height: 720 });
  await page.goto('/');

  // The header puts the tabs on a row of their own, so one rule divides them.
  const header = page.locator('.site-header');
  await expect(header).toHaveAttribute('data-wrapped', 'true');
  await expect(header.locator(':scope > .row-rule')).toHaveCount(1);
  // The tab bar holds that row alone, so it draws none, and the last tab on the
  // row above carries no hairline.
  await expect(page.locator('.tab-bar')).not.toHaveAttribute('data-wrapped', 'true');
  await expect(page.locator('.tab-bar a[data-row-end]')).toHaveCount(0);
  // A rule is furniture: it never swallows a click on the row it divides.
  await expect(header.locator(':scope > .row-rule')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('.tab-bar a').first()).toHaveCSS('pointer-events', 'auto');

  // Wide again, the header holds one row and its rule goes away.
  await page.setViewportSize({ width: wideMin, height: 720 });
  await expect(header).not.toHaveAttribute('data-wrapped', 'true');
  await expect(header.locator(':scope > .row-rule')).toHaveCount(0);
});

test('the sub-tabs draw a rule per wrapped row and end each row without a hairline', async ({ page }) => {
  await blockEmbed(page);
  // Narrow enough that four sub-tabs cannot share one line.
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/#projects');

  const subs = page.locator('.sub-tabs');
  await expect(subs).toHaveAttribute('data-wrapped', 'true');
  const rows = await page.evaluate(() => {
    const bar = document.querySelector('.sub-tabs');
    const tops = new Set(
      [...bar.querySelectorAll('a')].map((a) => Math.round(a.getBoundingClientRect().top)),
    );
    return { lines: tops.size, rules: bar.querySelectorAll(':scope > .row-rule').length };
  });
  expect(rows.lines).toBeGreaterThan(1);
  expect(rows.rules).toBe(rows.lines - 1);
  // Every row but the last ends without a hairline, and every item still sits
  // in the list the keyboard walks.
  await expect(page.locator('.sub-tabs a[data-row-end]')).toHaveCount(rows.lines - 1);
  await expect(page.locator('.sub-tabs a[role="tab"]')).toHaveCount(4);
});

test('a view takes a focus stop only while it can scroll', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: wideMin, height: 720 });
  await page.goto('/');

  // About Me is taller than the panel at this height, so it keeps a stop.
  await expect(panel(page, 'about')).toHaveAttribute('tabindex', '0');
  // Given room, the same view fits and gives the stop back.
  await page.setViewportSize({ width: wideMin, height: 2000 });
  await expect(panel(page, 'about')).not.toHaveAttribute('tabindex', '0');

  // A hidden view never takes one, and the projects scroll body takes one only
  // while the project inside it is taller than the body.
  await expect(panel(page, 'certifications')).not.toHaveAttribute('tabindex', '0');
  await expect(page.locator('.projects-scroll')).not.toHaveAttribute('tabindex', '0');
  await page.setViewportSize({ width: wideMin, height: 420 });
  await tab(page, 'projects').click();
  await expect(page.locator('.projects-scroll')).toHaveAttribute('tabindex', '0');
});

test('a row rule is as wide as the tab bar, whatever bar draws it', async ({ page }) => {
  await blockEmbed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#projects');

  const widths = await page.evaluate(() => {
    const width = (el) => Math.round(el.getBoundingClientRect().width * 10) / 10;
    const bar = document.querySelector('.tab-bar');
    const header = document.querySelector('.site-header');
    const subs = document.querySelector('.sub-tabs');
    return {
      bar: width(bar),
      headerRule: width(header.querySelector(':scope > .row-rule')),
      subRule: width(subs.querySelector(':scope > .row-rule')),
    };
  });
  // The header pads its own box and the sub-tab bar pads its children, so one
  // shared inset is what makes the two rules come out the same length.
  expect(widths.headerRule).toBe(widths.bar);
  expect(widths.subRule).toBe(widths.bar);
});

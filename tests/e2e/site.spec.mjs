import { test, expect } from '@playwright/test';

const tab = (page, id) => page.locator(`#tab-${id}`);
const panel = (page, id) => page.locator(`#panel-${id}`);
const subTab = (page, id) => page.locator(`[data-sub-tab-target="${id}"]`);
const loadedFrames = (page) => page.locator('iframe[data-loaded="true"]');

async function blockEmbed(page) {
  await page.route(/live365\.com/, (route) => route.abort());
  await page.route(/decibillyjoel\.github\.io/, (route) => route.abort());
}

// A stub keeps the focus tests offline. It stays cross-origin, and its focusable
// canvas keeps the frame in the parent tab order the way the real embeds do.
const EMBED_STUB =
  '<!doctype html><html lang="en"><body><canvas tabindex="0"></canvas></body></html>';

async function stubEmbed(page) {
  await page.route(/live365\.com|decibillyjoel\.github\.io/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: EMBED_STUB }),
  );
}

async function tabIntoEmbed(page, selector) {
  await page.evaluate(() => document.getElementById('main')?.focus());
  for (let i = 0; i < 6; i += 1) {
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
  await expect(panel(page, 'who-am-i')).toBeVisible();

  await tab(page, 'projects').click();
  await expect(panel(page, 'projects')).toBeVisible();
  await expect(page.locator('[data-project="maximum-slappage"] h2')).toHaveText('MAXIMUM SLAPPAGE');
  await expect(page.locator('[data-project="maximum-slappage"] .tagline')).toContainText('live internet radio');
  await expect(subTab(page, 'maximum-slappage')).toBeVisible();
  await expect(subTab(page, 'portfolio')).toBeVisible();
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
  await expect(subTab(page, 'portfolio')).toBeFocused();
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
  await expect(page.locator('[data-on-air]')).toHaveText('[ GAME RUNNING ]');
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
  await expect(links).toHaveCount(7);
  const hrefs = await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(hrefs).toEqual(['/#whoami', '/#links', '/#certs', '/#projects', '/#radio', '/#portfolio', '/#game']);

  await page.locator('.routes a', { hasText: 'Projects' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(panel(page, 'projects')).toBeVisible();
});

test('an unknown hash shows the 404 view in place, without a reload', async ({ page }) => {
  await blockEmbed(page);
  await page.addInitScript(() => {
    window.__loads = (window.__loads ?? 0) + 1;
  });
  await page.goto('/#links');
  await expect(panel(page, 'links')).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = '#thisdoesntexist';
  });

  await expect(panel(page, 'not-found')).toBeVisible();
  await expect(page).toHaveURL(/#thisdoesntexist$/);
  await expect(page.locator('[data-panel]:visible')).toHaveCount(1);
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(0);
  await expect(page).toHaveTitle('404 - @JoeOfSomeTrades');

  await page.goBack();
  await expect(page).toHaveURL(/#links$/);
  await expect(panel(page, 'links')).toBeVisible();
  await expect(tab(page, 'links')).toHaveAttribute('aria-selected', 'true');
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
  expect(hrefs).toEqual(['#whoami', '#links', '#certs', '#projects', '#radio', '#portfolio', '#game']);

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
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
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
  await tab(page, 'who-am-i').click();
  await expect(panel(page, 'who-am-i')).toBeVisible();
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

const LIGHT_BG = 'rgb(230, 241, 228)';
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
    label: 'Theme: auto. Activate to change.',
    title: 'Theme: auto',
    shown: ['auto'],
    stored: null,
    bg: DARK_BG,
  };

  expect(await themeState(page)).toEqual(auto);

  await toggle.click();
  expect(await themeState(page)).toEqual({
    attr: 'light',
    label: 'Theme: light. Activate to change.',
    title: 'Theme: light',
    shown: ['light'],
    stored: 'light',
    bg: LIGHT_BG,
  });

  await toggle.click();
  expect(await themeState(page)).toEqual({
    attr: 'dark',
    label: 'Theme: dark. Activate to change.',
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
    'Theme: light. Activate to change.',
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
      if (size.width === 390) expect(m.headerHeight, note).toBe(88);
    }
  }
});

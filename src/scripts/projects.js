import { initTablistKeys, setRovingTabindex } from './tablist.js';
import { player } from '../data/player.js';
import { soundcloud } from '../data/soundcloud.js';

const FOCUS_POLL_MS = 200;

export function initProjects(root = document) {
  const buttons = [...root.querySelectorAll('[data-sub-tab-target]')];
  const panels = [...root.querySelectorAll('[data-project]')];
  if (!buttons.length) return;

  const list = buttons[0].closest('[role="tablist"]');
  const badge = root.querySelector('[data-on-air]');
  const badgeText = badge?.querySelector('[data-on-air-text]');
  const projectsPanel = root.querySelector('[data-panel="projects"]');

  // A project with an embed names its own kind, so no project id is repeated here.
  function embedPanelOf(kind) {
    return panels.find((panel) => panel.querySelector('iframe[data-embed]')?.dataset.embedKind === kind);
  }

  const radioPanel = embedPanelOf('player');
  const gamePanel = embedPanelOf('iframe');
  const soundcloudPanel = embedPanelOf('soundcloud');

  function isLoaded(panel) {
    const frame = panel?.querySelector('iframe[data-embed]');
    return frame?.dataset.loaded === 'true';
  }

  // A frame element never matches :focus in its parent, so the parent cannot
  // style the ring with a pseudo-class. Watch activeElement instead. The ring
  // mirrors :focus-visible: it shows only when the keyboard brought focus in.
  let keyboardInput = true;
  let focusTimer = null;

  function syncEmbedFocus() {
    const active = root.activeElement ?? document.activeElement;
    for (const frame of root.querySelectorAll('iframe[data-embed]')) {
      const wrap = frame.closest('.player, .game, .soundcloud');
      if (wrap) wrap.dataset.embedFocus = String(keyboardInput && active === frame);
    }
  }

  function startFocusWatch() {
    if (focusTimer === null) focusTimer = setInterval(syncEmbedFocus, FOCUS_POLL_MS);
    syncEmbedFocus();
  }

  function stopFocusWatch() {
    if (panels.some(isLoaded)) return;
    if (focusTimer !== null) clearInterval(focusTimer);
    focusTimer = null;
    syncEmbedFocus();
  }

  // The brackets around the badge are decoration, so the words alone carry the
  // state to assistive tech.
  const BADGE_LABELS = {
    off: 'OFF AIR',
    'on-air': 'ON AIR',
    running: 'PLAYING',
    paused: 'PAUSED',
    vibing: 'VIBING',
  };

  function syncBadge() {
    if (!badge || !badgeText) return;
    const running = isLoaded(gamePanel);
    const onAir = isLoaded(radioPanel);
    const vibing = isLoaded(soundcloudPanel);
    const onProjects = projectsPanel ? !projectsPanel.hidden : true;

    let state = 'off';
    if (running) state = onProjects ? 'running' : 'paused';
    else if (onAir) state = 'on-air';
    // The SoundCloud frame keeps playing on another tab, like the radio, so
    // this state does not look at the visible panel.
    else if (vibing) state = 'vibing';

    badgeText.textContent = BADGE_LABELS[state];
    badge.dataset.state = state;
  }

  function unload(panel) {
    const frame = panel.querySelector('iframe[data-embed]');
    if (!frame || frame.dataset.loaded !== 'true') return;
    frame.dataset.loaded = 'false';
    frame.src = 'about:blank';
    stopFocusWatch();
  }

  function mount(panel) {
    const frame = panel.querySelector('iframe[data-embed]');
    if (!frame || frame.dataset.loaded === 'true') return;
    if (frame.dataset.embedKind === 'player') {
      const layout = window.matchMedia(player.wideQuery).matches ? 'xl' : 'sm';
      const size = player.sizes[layout];
      frame.width = String(size.width);
      frame.height = String(size.height);
      frame.src = layout === 'xl' ? frame.dataset.srcXl : frame.dataset.srcSm;
    } else if (frame.dataset.embedKind === 'soundcloud') {
      const layout = window.matchMedia(soundcloud.wideQuery).matches ? 'xl' : 'sm';
      const size = soundcloud.sizes[layout];
      frame.width = String(size.width);
      frame.height = String(size.height);
      frame.src = frame.dataset.src;
    } else {
      frame.src = frame.dataset.src;
    }
    frame.dataset.loaded = 'true';
    startFocusWatch();
  }

  function hasEmbed(panel) {
    return Boolean(panel?.querySelector('iframe[data-embed]'));
  }

  // The project on screen, so the router only sends a bare #projects to the
  // first project when the view is empty. Otherwise the loaded project stays.
  let currentId = null;

  function show(id) {
    const activePanel = panels.find((panel) => panel.dataset.project === id);
    if (activePanel) currentId = id;
    // A project with no embed of its own leaves the mounted embed alone, so
    // the radio keeps playing and the game keeps its state.
    const spareEmbeds = Boolean(activePanel) && !hasEmbed(activePanel);
    for (const panel of panels) {
      const active = panel.dataset.project === id;
      panel.hidden = !active;
      if (!active && !spareEmbeds) unload(panel);
    }
    let activeButton = null;
    for (const button of buttons) {
      const active = button.dataset.subTabTarget === id;
      button.setAttribute('aria-selected', String(active));
      if (active) activeButton = button;
    }
    setRovingTabindex(buttons, activeButton ?? buttons[0]);
    if (activePanel) mount(activePanel);
    syncBadge();
    // The scroll body may now be shorter than its viewport, so the router
    // rechecks whether it still needs a focus stop of its own.
    root.dispatchEvent(new CustomEvent('projects:change', { detail: { project: id } }));
  }

  // The first project is the one the Projects view opens with, so the router can
  // send a bare #projects there instead of showing a chooser.
  const defaultId = buttons[0]?.dataset.subTabTarget ?? null;

  initTablistKeys(list, buttons);
  setRovingTabindex(buttons, buttons[0]);
  root.addEventListener('tabs:change', syncBadge);
  root.addEventListener('keydown', () => { keyboardInput = true; }, true);
  root.addEventListener('pointerdown', () => { keyboardInput = false; }, true);
  window.addEventListener('blur', syncEmbedFocus);
  window.addEventListener('focus', syncEmbedFocus);
  syncBadge();
  syncEmbedFocus();

  return { show, syncBadge, defaultId, current: () => currentId };
}

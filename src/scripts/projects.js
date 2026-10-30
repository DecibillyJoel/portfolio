import { initTablistKeys, setRovingTabindex } from './tablist.js';

const FOCUS_POLL_MS = 200;

export function initProjects(root = document) {
  const buttons = [...root.querySelectorAll('[data-sub-tab-target]')];
  const panels = [...root.querySelectorAll('[data-project]')];
  if (!buttons.length) return;

  const list = buttons[0].closest('[role="tablist"]');
  const empty = root.querySelector('[data-project-empty]');
  const badge = root.querySelector('[data-on-air]');
  const projectsPanel = root.querySelector('[data-panel="projects"]');
  const radioPanel = panels.find((panel) => panel.dataset.project === 'maximum-slappage');
  const gamePanel = panels.find((panel) => {
    const frame = panel.querySelector('iframe[data-embed]');
    return frame?.dataset.embedKind === 'iframe';
  });

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
      const wrap = frame.closest('.player, .game');
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

  function syncBadge() {
    if (!badge) return;
    const running = isLoaded(gamePanel);
    const onAir = isLoaded(radioPanel);
    const onProjects = projectsPanel ? !projectsPanel.hidden : true;

    let state = 'off';
    let label = '[ OFF AIR ]';

    if (running) {
      state = onProjects ? 'running' : 'paused';
      label = onProjects ? '[ GAME RUNNING ]' : '[ GAME PAUSED ]';
    } else if (onAir) {
      state = 'on-air';
      label = '[ ON AIR ]';
    }

    badge.textContent = label;
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
      const wide = window.matchMedia('(min-width: 900px)').matches;
      frame.width = wide ? '800' : '300';
      frame.height = wide ? '296' : '614';
      frame.src = wide ? frame.dataset.srcXl : frame.dataset.srcSm;
      const wrap = frame.closest('.player');
      if (wrap) wrap.dataset.embedSize = wide ? 'xl' : 'sm';
    } else {
      frame.src = frame.dataset.src;
    }
    frame.dataset.loaded = 'true';
    startFocusWatch();
  }

  function hasEmbed(panel) {
    return Boolean(panel?.querySelector('iframe[data-embed]'));
  }

  function show(id) {
    const activePanel = panels.find((panel) => panel.dataset.project === id);
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
      button.dataset.active = String(active);
      button.setAttribute('aria-selected', String(active));
      if (active) activeButton = button;
    }
    setRovingTabindex(buttons, activeButton ?? buttons[0]);
    if (empty) empty.hidden = Boolean(id);
    if (activePanel) mount(activePanel);
    syncBadge();
  }

  initTablistKeys(list, buttons);
  setRovingTabindex(buttons, buttons[0]);
  root.addEventListener('tabs:change', syncBadge);
  root.addEventListener('keydown', () => { keyboardInput = true; }, true);
  root.addEventListener('pointerdown', () => { keyboardInput = false; }, true);
  window.addEventListener('blur', syncEmbedFocus);
  window.addEventListener('focus', syncEmbedFocus);
  syncBadge();
  syncEmbedFocus();

  return { show, syncBadge };
}

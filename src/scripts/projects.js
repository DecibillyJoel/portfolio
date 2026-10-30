export function initProjects(root = document) {
  const buttons = [...root.querySelectorAll('[data-sub-tab-target]')];
  const panels = [...root.querySelectorAll('[data-project]')];
  if (!buttons.length) return;

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

  function syncBadge() {
    if (!badge) return;
    const playing = isLoaded(gamePanel);
    const onAir = isLoaded(radioPanel);
    const onProjects = projectsPanel ? !projectsPanel.hidden : true;

    let state = 'off';
    let label = '[ OFF AIR ]';
    let clickable = false;

    if (playing) {
      state = onProjects ? 'playing' : 'paused';
      label = onProjects ? '[ GAME PLAYING ]' : '[ GAME PAUSED ]';
      clickable = !onProjects;
    } else if (onAir) {
      state = 'on-air';
      label = '[ ON AIR ]';
      clickable = true;
    }

    badge.textContent = label;
    badge.dataset.state = state;
    badge.dataset.clickable = String(clickable);
    badge.disabled = !clickable;
  }

  function unload(panel) {
    const frame = panel.querySelector('iframe[data-embed]');
    if (!frame || frame.dataset.loaded !== 'true') return;
    frame.dataset.loaded = 'false';
    frame.src = 'about:blank';
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
  }

  function show(id) {
    for (const panel of panels) {
      const active = panel.dataset.project === id;
      panel.hidden = !active;
      if (!active) unload(panel);
    }
    for (const button of buttons) {
      const active = button.dataset.subTabTarget === id;
      button.dataset.active = String(active);
      button.setAttribute('aria-selected', String(active));
    }
    if (empty) empty.hidden = Boolean(id);
    const activePanel = panels.find((panel) => panel.dataset.project === id);
    if (activePanel) mount(activePanel);
    syncBadge();
  }

  for (const button of buttons) {
    button.addEventListener('click', () => show(button.dataset.subTabTarget));
  }

  if (badge) {
    badge.addEventListener('click', () => {
      if (badge.disabled) return;
      root.querySelector('[data-tab-target="projects"]')?.click();
    });
  }
  root.addEventListener('tabs:change', syncBadge);

  syncBadge();
}

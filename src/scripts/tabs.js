import { initTablistKeys, setRovingTabindex } from './tablist.js';

export function initTabs(root = document) {
  const buttons = [...root.querySelectorAll('[data-tab-target]')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  if (!buttons.length) return;

  const list = buttons[0].closest('[role="tablist"]');

  function show(id) {
    for (const panel of panels) {
      panel.hidden = panel.dataset.panel !== id;
    }
    let activeButton = null;
    for (const button of buttons) {
      const active = button.dataset.tabTarget === id;
      button.setAttribute('aria-selected', String(active));
      if (active) activeButton = button;
    }
    if (activeButton) setRovingTabindex(buttons, activeButton);
    root.dispatchEvent(new CustomEvent('tabs:change', { detail: { tab: id } }));
  }

  initTablistKeys(list, buttons);
  setRovingTabindex(buttons, buttons.find((button) => button.getAttribute('aria-selected') === 'true') ?? buttons[0]);

  return { show };
}

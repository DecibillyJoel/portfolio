import { initTablistKeys, setRovingTabindex } from './tablist.js';

export function initTabs(root = document) {
  const buttons = [...root.querySelectorAll('[data-tab-target]')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  // A view outside the tab list, such as the Links link in the brand row, is
  // marked as the current view rather than as a selected tab.
  const viewLinks = [...root.querySelectorAll('[data-view]')];
  if (!buttons.length) return;

  const list = buttons[0].closest('[role="tablist"]');

  function show(id) {
    for (const panel of panels) {
      panel.hidden = panel.dataset.panel !== id;
    }
    for (const link of viewLinks) {
      if (link.dataset.view === id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
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

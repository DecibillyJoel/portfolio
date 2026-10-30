export function initTabs(root = document) {
  const buttons = [...root.querySelectorAll('[data-tab-target]')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  if (!buttons.length) return;

  function show(id, moveFocus) {
    for (const panel of panels) {
      panel.hidden = panel.dataset.panel !== id;
    }
    for (const button of buttons) {
      const active = button.dataset.tabTarget === id;
      button.dataset.active = String(active);
      button.setAttribute('aria-selected', String(active));
      if (active && moveFocus) button.focus();
    }
    root.dispatchEvent(new CustomEvent('tabs:change', { detail: { tab: id } }));
  }

  for (const button of buttons) {
    button.addEventListener('click', () => show(button.dataset.tabTarget, false));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        show(button.dataset.tabTarget, true);
      }
    });
  }

  show(buttons[0].dataset.tabTarget, false);
}

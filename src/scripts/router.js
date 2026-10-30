import { initTabs } from './tabs.js';
import { initProjects } from './projects.js';

const DEFAULT_HASH = 'whoami';
// In-page targets (the skip link) are not routes. Leave the visible tab alone.
const IGNORED_HASHES = new Set(['main']);

export function initRouter(root = document) {
  const tabs = initTabs(root);
  const projects = initProjects(root);
  if (!tabs) return;

  const tabRoutes = new Map();
  const projectRoutes = new Map();

  for (const link of root.querySelectorAll('[data-tab-target][data-hash]')) {
    tabRoutes.set(link.dataset.hash, link.dataset.tabTarget);
  }
  for (const link of root.querySelectorAll('[data-sub-tab-target][data-hash]')) {
    projectRoutes.set(link.dataset.hash, link.dataset.subTabTarget);
  }

  const projectTab = root.querySelector('[data-sub-tab-target]')?.closest('[data-panel]')?.dataset.panel;

  function apply(name) {
    if (projectRoutes.has(name)) {
      if (projectTab) tabs.show(projectTab, false);
      projects.show(projectRoutes.get(name));
      return;
    }
    tabs.show(tabRoutes.get(name) ?? tabRoutes.get(DEFAULT_HASH), false);
  }

  function route() {
    const name = window.location.hash.replace(/^#/, '');
    if (IGNORED_HASHES.has(name)) return;
    if (tabRoutes.has(name) || projectRoutes.has(name)) {
      apply(name);
      return;
    }
    window.history.replaceState(null, '', `#${DEFAULT_HASH}`);
    apply(DEFAULT_HASH);
  }

  // Links activate with Enter natively. Space is not native for links, so
  // mirror the tablist keyboard behavior.
  for (const link of root.querySelectorAll('a[data-hash]')) {
    link.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        window.location.hash = link.dataset.hash;
      }
    });
  }

  window.addEventListener('hashchange', route);
  route();

  return { route };
}

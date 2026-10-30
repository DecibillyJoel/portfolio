import { initTabs } from './tabs.js';
import { initProjects } from './projects.js';

const NOT_FOUND_PANEL = 'not-found';

export function initRouter(root = document) {
  const tabs = initTabs(root);
  const projects = initProjects(root);
  if (!tabs) return;

  // The tab the page marks as selected is where a bare address lands, so the
  // default hash is not written twice.
  const defaultHash =
    root.querySelector('[data-tab-target][aria-selected="true"]')?.dataset.hash ??
    root.querySelector('[data-tab-target][data-hash]')?.dataset.hash;

  // In-page targets, such as the skip link, are not routes, so the visible tab
  // stays as it is. The target element itself carries the marker, which keeps
  // this list from drifting away from the markup.
  const ignoredHashes = new Set(
    [...root.querySelectorAll('[data-route-ignore]')].map((element) => element.id),
  );

  const tabRoutes = new Map();
  const projectRoutes = new Map();

  // A tab and a view that sits outside the tab list, such as the Links link in
  // the brand row, both open a panel by name.
  for (const link of root.querySelectorAll('[data-tab-target][data-hash], [data-view][data-hash]')) {
    tabRoutes.set(link.dataset.hash, link.dataset.tabTarget ?? link.dataset.view);
  }
  for (const link of root.querySelectorAll('[data-sub-tab-target][data-hash]')) {
    projectRoutes.set(link.dataset.hash, link.dataset.subTabTarget);
  }

  const projectTab = root.querySelector('[data-sub-tab-target]')?.closest('[data-panel]')?.dataset.panel;

  const defaultTitle = document.title;

  function apply(name) {
    document.title = defaultTitle;
    if (projectRoutes.has(name)) {
      if (projectTab) tabs.show(projectTab);
      projects.show(projectRoutes.get(name));
      return;
    }
    tabs.show(tabRoutes.get(name) ?? tabRoutes.get(defaultHash));
  }

  // An unknown hash is a real address the user asked for. Keep it in the
  // address bar, hide every tab, and show the 404 view instead.
  function showNotFound() {
    tabs.show(NOT_FOUND_PANEL);
    document.title = `404 - ${defaultTitle}`;
  }

  function route() {
    const name = window.location.hash.replace(/^#/, '');
    if (ignoredHashes.has(name)) return;
    if (tabRoutes.has(name) || projectRoutes.has(name)) {
      apply(name);
      return;
    }
    if (name) {
      showNotFound();
      return;
    }
    window.history.replaceState(null, '', `#${defaultHash}`);
    apply(defaultHash);
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

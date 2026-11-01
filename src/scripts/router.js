import { initTabs } from './tabs.js';
import { initProjects } from './projects.js';
import { initRowRules } from './rows.js';
import { initScrollFocus } from './scroll.js';

const NOT_FOUND_PANEL = 'not-found';

export function initRouter(root = document) {
  const tabs = initTabs(root);
  const projects = initProjects(root);
  if (!tabs) return;

  // The bars that wrap draw their own row rules, and every scrollable region
  // takes a focus stop only while it can actually scroll.
  initRowRules(root);
  initScrollFocus(root);

  // The view the page marks as its landing view is where a bare address lands,
  // so the default hash is not written twice. The landing view is not a tab, so
  // the marker sits on the link in the brand row.
  const defaultHash =
    root.querySelector('[data-default][data-hash]')?.dataset.hash ??
    root.querySelector('[data-tab-target][data-hash]')?.dataset.hash;

  // In-page targets, such as the skip link, are not routes, so the visible tab
  // stays as it is. The target element itself carries the marker, which keeps
  // this list from drifting away from the markup.
  const ignoredHashes = new Set(
    [...root.querySelectorAll('[data-route-ignore]')].map((element) => element.id),
  );

  const tabRoutes = new Map();
  const projectRoutes = new Map();

  // A tab and a view that sits outside the tab list, such as the About Me link
  // in the brand row, both open a panel by name.
  for (const link of root.querySelectorAll('[data-tab-target][data-hash], [data-view][data-hash]')) {
    tabRoutes.set(link.dataset.hash, link.dataset.tabTarget ?? link.dataset.view);
  }
  for (const link of root.querySelectorAll('[data-sub-tab-target][data-hash]')) {
    projectRoutes.set(link.dataset.hash, link.dataset.subTabTarget);
  }

  const projectTab = root.querySelector('[data-sub-tab-target]')?.closest('[data-panel]')?.dataset.panel;

  // The tab that carries the chooser, so a press on it can be read as a toggle.
  const projectsTabLink = projectTab
    ? root.querySelector(`[data-tab-target="${projectTab}"][data-hash]`)
    : null;

  function isCurrent(link) {
    return window.location.hash.replace(/^#/, '') === link?.dataset.hash;
  }

  // Pressing the Projects tab while its view is already open folds the chooser
  // away, rather than doing nothing. The address does not change then, so no
  // route runs and the press is handled here.
  function toggleOpenView(link) {
    if (link !== projectsTabLink || !isCurrent(link)) return false;
    projects?.toggleBar();
    return true;
  }

  projectsTabLink?.addEventListener('click', () => toggleOpenView(projectsTabLink));

  const defaultTitle = document.title;

  function apply(name) {
    document.title = defaultTitle;
    if (projectRoutes.has(name)) {
      if (projectTab) tabs.show(projectTab);
      projects.show(projectRoutes.get(name));
      // A project fills the view, so the chooser folds away.
      projects.showBar(false);
      return;
    }
    const tab = tabRoutes.get(name) ?? tabRoutes.get(defaultHash);
    tabs.show(tab);
    // The Projects view opens on its first project rather than on a chooser, so
    // a bare #projects always has something in it. A project already on screen
    // stays, so returning to the view does not switch away from it.
    if (projectTab && tab === projectTab) {
      if (projects.defaultId && !projects.current()) projects.show(projects.defaultId);
      // The view carries the chooser, which a project route folded away.
      projects.showBar(true);
    }
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
        if (!toggleOpenView(link)) window.location.hash = link.dataset.hash;
      }
    });
  }

  window.addEventListener('hashchange', route);
  route();

  return { route };
}

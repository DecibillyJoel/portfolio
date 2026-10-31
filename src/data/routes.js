import { projects } from './projects.js';

// Every view the site can open. The header and the 404 list both read this
// file, so a hash is named once and the router has nothing to repeat.
export const views = [
  // About Me sits with the handle rather than in the tab list, and it is the
  // view a bare address lands on.
  { id: 'about', hash: 'about', label: 'About Me', tab: false, landing: true },
  { id: 'projects', hash: 'projects', label: 'Projects', tab: true },
  { id: 'certifications', hash: 'certs', label: 'Certifications', tab: true },
];

// The tab bar carries the views that are not the landing view.
export const tabs = views.filter((view) => view.tab);

// A bare address lands on the view marked as the landing view.
export const landing = views.find((view) => view.landing);
export const defaultHash = landing.hash;

// Every hash a visitor can open, in the order the 404 view lists them.
export const routes = [
  ...views.map(({ hash, label }) => ({ hash, label })),
  ...projects.map(({ hash, label }) => ({ hash, label })),
];

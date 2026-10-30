import { projects } from './projects.js';

// Every view the site can open. The header and the 404 list both read this
// file, so a hash is named once and the router has nothing to repeat.
export const views = [
  { id: 'who-am-i', hash: 'whoami', label: 'Who Am I', tab: true },
  { id: 'links', hash: 'links', label: 'Links', tab: false },
  { id: 'certifications', hash: 'certs', label: 'Certifications', tab: true },
  { id: 'projects', hash: 'projects', label: 'Projects', tab: true },
];

// Links sits with the handle rather than in the tab list, so the bar carries
// the other three views.
export const tabs = views.filter((view) => view.tab);

// A bare address lands on the first tab.
export const defaultHash = tabs[0].hash;

// Every hash a visitor can open, in the order the 404 view lists them.
export const routes = [
  ...views.map(({ hash, label }) => ({ hash, label })),
  ...projects.map(({ hash, label }) => ({ hash, label })),
];

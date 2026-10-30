import { projects } from './projects.js';

// Every view the site can open. The header tabs and the sub-tabs both read
// this file, so a hash is named once and the router has nothing to repeat.
export const tabs = [
  { id: 'who-am-i', hash: 'whoami', label: 'Who Am I' },
  { id: 'links', hash: 'links', label: 'Links' },
  { id: 'certifications', hash: 'certs', label: 'Certifications' },
  { id: 'projects', hash: 'projects', label: 'Projects' },
];

// A bare address lands on the first tab.
export const defaultHash = tabs[0].hash;

// Every hash a visitor can open, in the order the 404 view lists them.
export const routes = [
  ...tabs.map(({ hash, label }) => ({ hash, label })),
  ...projects.map(({ hash, label }) => ({ hash, label })),
];

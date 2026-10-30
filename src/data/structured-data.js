import { site } from './site.js';
import { links } from './links.js';
import { certifications } from './certifications.js';
import { projects } from './projects.js';

// The site itself is the `portfolio` project, so that project provides the
// WebSite node instead of a node of its own.
const ALTERNATE_NAME = site.title.replace(/^@/, '');

function findLink(id) {
  return links.find((link) => link.id === id);
}

function findProject(id) {
  return projects.find((project) => project.id === id);
}

// One @graph keeps the person, the site, and the projects in a single script.
export function buildStructuredData(origin) {
  const root = origin.replace(/\/+$/, '');
  const personId = `${root}/#person`;
  const portfolio = findProject('portfolio');
  const radio = findProject('maximum-slappage');
  const game = findProject('smiles');

  const graph = [
    {
      '@type': 'Person',
      '@id': personId,
      name: site.title,
      alternateName: ALTERNATE_NAME,
      url: `${root}/`,
      image: `${root}${site.image}`,
      email: findLink('email')?.value,
      description: site.description,
      knowsAbout: site.topics,
      // The radio station is its own node below, so it is not a profile link.
      sameAs: links
        .filter((link) => link.href?.startsWith('http') && link.id !== 'live365')
        .map((link) => link.href),
      hasCredential: certifications.map((certification) => ({
        '@type': 'EducationalOccupationalCredential',
        name: certification.name,
        url: certification.href,
        recognizedBy: { '@type': 'Organization', name: certification.issuer },
      })),
    },
    {
      '@type': 'WebSite',
      '@id': `${root}/#website`,
      name: portfolio.label,
      alternateName: site.title,
      url: `${root}/`,
      description: portfolio.blurb,
      inLanguage: site.lang,
      author: { '@id': personId },
    },
    {
      '@type': 'RadioStation',
      '@id': `${root}/#radio`,
      name: radio.label,
      url: findLink('live365')?.href,
      description: radio.blurb,
      founder: { '@id': personId },
    },
    {
      '@type': 'VideoGame',
      '@id': `${root}/#game`,
      name: game.label,
      url: game.embed,
      codeRepository: game.href,
      description: game.blurb,
      author: { '@id': personId },
    },
  ];

  return { '@context': 'https://schema.org', '@graph': graph };
}

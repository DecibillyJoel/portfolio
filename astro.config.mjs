import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: { inlineStylesheets: 'always' },
  // Astro inlines a component script only while it stays under this limit.
  // Vite defaults to 4096 bytes, and the router bundle sits just above it.
  // The site serves no separate asset files, and this keeps it that way.
  vite: { build: { assetsInlineLimit: 8192 } },
});

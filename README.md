# portfolio

My personal site. It's a single page with a retro-arcade look. The About Me view lands first and holds my links, and two tabs beside it open my certifications and my projects. The projects tab embeds my Live365 radio station, Maximum Slappage, my game, Smiles Sadistic Adventure, and my SoundCloud audio, and it also describes this site itself.

Live at https://portfolio.joeofsometrades.workers.dev

## Running it locally

You'll need Node.js installed. Then:

```
npm install
npm run dev
```

That starts a dev server at http://localhost:4321. Edit anything under `src/` and the page updates on its own.

## Other commands

- `npm run build` — builds the static site into `dist/`.
- `npm run preview` — serves the built site, so you can check the real output.
- `npm run test` — runs the unit tests, which read the built HTML.
- `npm run test:e2e` — runs the Playwright browser tests, including an accessibility pass.
- `npm run deploy` — builds and deploys to Cloudflare Workers.

## How it's built

Astro generates the static site. Cloudflare Workers serves the files in `dist/`, with `public/` copied in as-is. The tab switching and the project embeds are plain JavaScript in `src/scripts/`, and each view has its own hash URL, like `#about` or `#radio`.

// The SoundCloud profile embed reflows to whatever frame it gets, so the page
// reserves one wide box and one narrow box and tells the script which one it
// chose. These numbers live here and nowhere else.
import { wideQuery } from './layout.js';

export const soundcloud = {
  profile: 'https://soundcloud.com/JoeOfSomeTrades',
  // The widget takes its accent as an unprefixed hex inside a query value, so
  // this is not a CSS colour. It mirrors the dark --magenta token.
  tint: 'ff2fd0',
  sizes: {
    xl: { width: 800, height: 450 },
    sm: { width: 324, height: 520 },
  },
  // The wide layout stops fitting once the page leaves the desktop layout, so
  // the page and the frame switch at the same width.
  wideQuery,
  title: 'SoundCloud player',
};

// visual=true draws the profile card: the header, the follower count and the
// track rows. SoundCloud serves the list, so an upload appears with no code
// change here.
export function soundcloudSrc() {
  const params = new URLSearchParams({
    visual: 'true',
    show_artwork: 'true',
    color: `#${soundcloud.tint}`,
    url: soundcloud.profile,
  });
  return `https://w.soundcloud.com/player/?${params}`;
}

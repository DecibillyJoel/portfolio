export const links = [
  { id: 'github',  label: 'GITHUB',   value: 'github.com/DecibillyJoel',            href: 'https://github.com/DecibillyJoel',            pending: false },
  { id: 'youtube', label: 'YOUTUBE',  value: 'youtube.com/@JoeOfSomeTrades',        href: 'https://www.youtube.com/@JoeOfSomeTrades',    pending: false },
  { id: 'bluesky', label: 'BLUESKY',  value: '@joeofsometrades.bsky.social',        href: null,                                          pending: true  },
  { id: 'live365', label: 'LIVE365',  value: 'Maximum Slappage',                    href: 'https://live365.com/station/a57727',          pending: false },
  { id: 'lastfm',  label: 'LAST.FM',  value: 'last.fm/user/DecibillyJoel',          href: 'https://www.last.fm/user/DecibillyJoel',      pending: false },
  { id: 'email',   label: 'EMAIL',    value: 'joe@placeholder',                     href: null,                                          pending: true  },
  // Discord has no profile URL without the numeric user id, so it stays plain text.
  // `pending: false` keeps its color live, unlike the Bluesky and email placeholders.
  { id: 'discord', label: 'DISCORD',  value: '@JoeOfSomeTrades',                    href: null,                                          pending: false },
];

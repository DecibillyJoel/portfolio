// The station serves one wide player layout and one narrow one. The page picks
// a layout, reserves the matching box and tells the script which one it chose,
// so these numbers live here and nowhere else.
export const player = {
  station: 'a57727',
  sizes: {
    xl: { width: 800, height: 296 },
    sm: { width: 300, height: 614 },
  },
  // The wide layout stops fitting once the panel is narrower than this.
  wideQuery: '(min-width: 900px)',
};

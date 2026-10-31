// The one breakpoint on the site: below this width the page wears the single
// column mobile layout and the tighter mobile spacing. A CSS media query cannot
// read a custom property, so each stylesheet writes the number as a literal and
// the tests compare every literal against this value. One number, written once,
// checked everywhere else.
export const mobileMax = 1149;

// The desktop layout starts one pixel above the mobile one, and both embeds ask
// for the wide frame from the same width the layout goes wide.
export const wideMin = mobileMax + 1;

export const wideQuery = `(min-width: ${wideMin}px)`;

// The header carries three parts on one row for as long as the width allows
// them: the handle column, the tab list and the status pair. A divider sits
// between the handle and the tabs, and a hairline sits between every pair of
// tabs. The numbers below are the widths at which one part stops fitting beside
// the others, worked out from the widths the stylesheet gives them at the
// mobile sizes.
//
//   handle 233, divider 1, tabs 251, pair 174, each gap 16, header padding 32
//
//   tabs stay inline    233 + 16 + 1 + 16 + 251 + 16 + 174 + 32 = 739, plus a
//                       5 px buffer, so the row holds from 744
//   badge steps out     233 + 16 + 174 + 32                      = 455
//   toggle steps out    233 + 16 + 42 + 32                       = 323, plus a
//                       5 px buffer, so the toggle holds from 328
//
// Two states decide the tab number. A selected tab adds its prompt to the tab
// list, and the widest badge, OFF AIR or PLAYING, makes the pair 174 wide. Both
// states were measured together in the browser, on the game view with a tab
// selected: the row holds at 744 and the tabs drop a line at 743.
//
// Each control gives way on its own instead of wrapping: the badge leaves the
// header at 455 and below, and the toggle at 327 and below.
//
// The stylesheet writes each one as a literal, as it does for the mobile
// breakpoint above, and the tests compare every copy against these values.
export const tabsInlineMin = 744;
export const pairRowMin = 456;
export const toggleInlineMin = 328;

// One pixel below each threshold: the width at which that part gives way.
export const tabsWrapMax = tabsInlineMin - 1;
export const statusRowMax = pairRowMin - 1;
export const toggleHideMax = toggleInlineMin - 1;

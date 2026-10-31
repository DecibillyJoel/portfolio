// A region that can scroll needs a way in from the keyboard, so it carries a
// focus stop. A region whose content fits needs none, and the stop only costs
// the reader a press of the Tab key, so the stop is added and taken away as the
// content grows and shrinks.
//
// Only a region that actually scrolls is considered: the projects panel keeps
// its own scroll body and clips its overflow, so the panel itself never holds a
// stop.

const SCROLL_SLACK = 2;

export function initScrollFocus(root = document) {
  const regions = [...root.querySelectorAll('[data-panel], .projects-scroll')];

  function sync() {
    for (const region of regions) {
      const overflowY = getComputedStyle(region).overflowY;
      const scrolls =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        region.scrollHeight - region.clientHeight > SCROLL_SLACK;
      if (scrolls) region.setAttribute('tabindex', '0');
      else region.removeAttribute('tabindex');
    }
  }

  root.addEventListener('tabs:change', sync);
  root.addEventListener('projects:change', sync);
  window.addEventListener('resize', sync);

  const observer = new ResizeObserver(sync);
  for (const region of regions) observer.observe(region);

  sync();
  return { sync };
}

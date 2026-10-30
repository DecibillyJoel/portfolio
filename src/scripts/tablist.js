// Roving tabindex and arrow-key movement for a horizontal tablist.
// Arrow keys move focus only. Activation stays with Enter and Space.

export function setRovingTabindex(items, activeItem) {
  for (const item of items) {
    item.tabIndex = item === activeItem ? 0 : -1;
  }
}

export function initTablistKeys(list, items) {
  if (!list || items.length < 2) return;

  list.addEventListener('keydown', (event) => {
    const current = items.indexOf(document.activeElement);
    if (current === -1) return;

    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowRight') next = (current + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + items.length) % items.length;
    else return;

    event.preventDefault();
    setRovingTabindex(items, items[next]);
    items[next].focus();
  });
}

// Row geometry for a bar that wraps.
//
// Only the browser knows where a flex line broke, so each marked bar is
// measured here. Two things come out of the measurement.
//
//   - The last item on a row other than the final one is marked, so the
//     stylesheets can drop a hairline that would hang beside nothing.
//   - One rule is drawn between each pair of rows, so a second row reads as a
//     continuation of the first. The rules are absolutely positioned children,
//     which keeps them out of the flex layout.
//
// A hidden bar measures as no rows at all, so the marks a wider layout left
// behind are cleared with it. The observer runs again the moment the bar becomes
// visible, and again whenever the browser rewraps it.

const RULE_CLASS = 'row-rule';

// The rows of a bar, each holding the items the browser placed on that line.
// Hidden children are skipped: they measure as a zero box at the top corner.
function measure(list) {
  const items = [...list.children].filter(
    (child) => child.nodeType === 1 && !child.classList.contains(RULE_CLASS),
  );
  const rows = [];
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (!rect.width && !rect.height) continue;
    // Items on one flex line overlap vertically, whatever their heights are.
    // Two lines never do, so the boxes alone tell the rows apart. The rows are
    // sorted at the end, because a later child can belong to an earlier line.
    const row = rows.find((one) => rect.top < one.bottom && rect.bottom > one.top);
    if (row) {
      row.items.push(item);
      row.top = Math.min(row.top, rect.top);
      row.bottom = Math.max(row.bottom, rect.bottom);
    } else {
      rows.push({ top: rect.top, bottom: rect.bottom, items: [item] });
    }
  }
  rows.sort((a, b) => a.top - b.top);
  return { rows, count: items.length };
}

function drawRules(list, rows, top) {
  const rules = [...list.children].filter((child) => child.classList.contains(RULE_CLASS));
  const needed = Math.max(rows.length - 1, 0);

  while (rules.length > needed) rules.pop().remove();
  while (rules.length < needed) {
    const rule = document.createElement('span');
    rule.className = RULE_CLASS;
    rule.setAttribute('aria-hidden', 'true');
    list.append(rule);
    rules.push(rule);
  }

  rows.slice(1).forEach((row, index) => {
    // Halfway down the gap, so the rule reads as a separator rather than as an
    // edge of either row.
    const middle = (rows[index].bottom + row.top) / 2;
    rules[index].style.top = `${Math.round(middle - top)}px`;
  });
}

export function markRows(list) {
  const { rows, count } = measure(list);
  // Fewer than two visible items, as in a hidden bar, means no wrap and no
  // rules. Take away anything a wider layout left behind.
  if (count < 2) {
    for (const child of [...list.children]) {
      if (child.classList.contains(RULE_CLASS)) child.remove();
      else delete child.dataset.rowEnd;
    }
    delete list.dataset.wrapped;
    return;
  }

  rows.forEach((row, index) => {
    const last = index < rows.length - 1;
    row.items.forEach((item, position) => {
      if (last && position === row.items.length - 1) item.dataset.rowEnd = 'true';
      else delete item.dataset.rowEnd;
    });
  });

  if (rows.length > 1) list.dataset.wrapped = 'true';
  else delete list.dataset.wrapped;

  drawRules(list, rows, list.getBoundingClientRect().top + list.clientTop);
}

export function initRowRules(root = document) {
  const bars = [...root.querySelectorAll('[data-rows]')];
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) markRows(entry.target);
  });
  for (const bar of bars) {
    markRows(bar);
    observer.observe(bar);
  }
  return { markRows, bars };
}

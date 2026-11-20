/**
 * Low quality: strip SVG filter effects from theme markup.
 * - Elements that only exist to be filtered (a rect without a fill, or a blurred circle/ellipse used as
 *   shadow/halo) are removed.
 * - Groups and other content simply lose their `filter`.
 */
export function stripFilters(nodes: Node[]): Node[] {
  const out: Node[] = [];
  for (const n of nodes) {
    if (!(n instanceof Element)) {
      out.push(n);
      continue;
    }
    if (!process(n)) continue;
    out.push(n);
  }
  return out;
}

/** Returns false if the element itself should be dropped. */
function process(el: Element): boolean {
  if (el.hasAttribute('filter')) {
    const tag = el.tagName.toLowerCase();
    const generator = (tag === 'rect' && !el.hasAttribute('fill')) || tag === 'circle' || tag === 'ellipse';
    if (generator) return false;
    el.removeAttribute('filter');
  }
  for (const child of Array.from(el.children)) {
    if (!process(child)) child.remove();
  }
  return true;
}

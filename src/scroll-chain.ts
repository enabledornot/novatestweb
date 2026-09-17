/** Walks up from `el` to find the nearest actually-scrollable ancestor. */
export function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    const scrollable = style.overflowY === "auto" || style.overflowY === "scroll";
    if (scrollable && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

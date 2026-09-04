export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function anchor(href: string, label: string): HTMLAnchorElement {
  const a = el('a', undefined, label);
  a.href = href;
  a.rel = 'noopener';
  a.target = '_blank';
  return a;
}

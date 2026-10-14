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

export function need(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`missing ${selector}`);
  return node;
}

/** Settles a beat after the page has loaded, once the first frames are out. */
const pageLoaded = new Promise<void>((resolve) => {
  const soon = (): void => void window.setTimeout(resolve, 250);
  if (document.readyState === 'complete') soon();
  else window.addEventListener('load', soon, { once: true });
});

/**
 * Photos off the first screen are fetched once that screen has loaded. The
 * sections sit faded out in the viewport, so `loading="lazy"` cannot hold them
 * back, and on a slow line they would otherwise starve the hero of bandwidth.
 */
export function loadLater(image: HTMLImageElement, src: string): void {
  void pageLoaded.then(() => {
    image.src = src;
  });
}

import { EASE_OUT, EASE_SETTLE, gsap, SplitText } from './motion';

/**
 * Text and card reveals as each section arrives on the climb. The scroll
 * stays the only clock for *where* things are (sections.ts publishes --in and
 * --sweep); these timelines only choreograph what happens once a section has
 * arrived, and reset invisibly once it has gone, so it plays again on return.
 *
 *   head — kicker chars, title chars rising out of a mask, then the lede
 *          and body copy line by line, then fact rows and contact rows.
 *   body — a station's cards, each one's contents settling in, card by card.
 *
 * Under reduced motion nothing is split or hidden.
 */

export type RevealPart = 'head' | 'body';

interface SectionParts {
  bands: SplitText[];
  titles: SplitText[];
  lines: SplitText[];
  links: HTMLElement[];
  /** Objects that sit in the head, like the About photo stack: hidden means gone, not just clear. */
  objects: HTMLElement[];
  cards: HTMLElement[][];
  shown: Record<RevealPart, boolean>;
  timeline: Partial<Record<RevealPart, gsap.core.Timeline>>;
}

const LINE_TARGETS = '.station__lede, .panel__lede, .panel__body p, .panel__foot';
/** The pieces of a card that settle in, in reading order. */
const CARD_PIECES =
  '.rail__divider-label, .card__label, .card__cover, .card__body, .card__logo, .card__content, .edu__cover, .edu__card > *, .edu__row';

export class Reveals {
  private readonly sections = new Map<HTMLElement, SectionParts>();

  constructor(private readonly reduced: () => boolean) {}

  /** Split a section's text and park it hidden. Call once the section's DOM is built. */
  prepare(section: HTMLElement): void {
    if (this.reduced() || this.sections.has(section)) return;
    const parts: SectionParts = {
      bands: [],
      titles: [],
      lines: [],
      links: [...section.querySelectorAll<HTMLElement>('.links li, .facts__row')],
      objects: [...section.querySelectorAll<HTMLElement>('.snaps, .recovery')],
      cards: [...section.querySelectorAll<HTMLElement>('.card, .edu, .rail__divider')].map((card) => [
        ...card.querySelectorAll<HTMLElement>(CARD_PIECES),
      ]),
      shown: { head: false, body: false },
      timeline: {},
    };
    // Re-splitting on resize or font load must not show hidden text, or
    // re-hide text that has already arrived.
    const settle = (split: SplitText, pieces: () => Element[]): void => {
      gsap.set(pieces(), parts.shown.head ? { yPercent: 0, opacity: 1 } : this.hiddenType(split));
    };
    for (const band of section.querySelectorAll<HTMLElement>('.panel__band')) {
      parts.bands.push(
        SplitText.create(band, {
          type: 'chars',
          autoSplit: true,
          onSplit: (self) => gsap.set(self.chars, { opacity: parts.shown.head ? 1 : 0 }),
        }),
      );
    }
    for (const title of section.querySelectorAll<HTMLElement>('.panel__title')) {
      parts.titles.push(
        SplitText.create(title, {
          type: 'lines,chars',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) => settle(self, () => self.chars),
        }),
      );
    }
    for (const block of section.querySelectorAll<HTMLElement>(LINE_TARGETS)) {
      parts.lines.push(
        SplitText.create(block, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) => settle(self, () => self.lines),
        }),
      );
    }
    gsap.set(parts.links, { y: 12, opacity: 0 });
    gsap.set(parts.objects, { y: 22, autoAlpha: 0 });
    for (const pieces of parts.cards) gsap.set(pieces, { y: 22, opacity: 0 });
    this.sections.set(section, parts);
  }

  private hiddenType(split: SplitText): gsap.TweenVars {
    return split.masks.length > 0 ? { yPercent: 108 } : { opacity: 0 };
  }

  /** The section has arrived (shown) or fully left (hidden). */
  set(section: HTMLElement, part: RevealPart, shown: boolean): void {
    const parts = this.sections.get(section);
    if (!parts || parts.shown[part] === shown) return;
    parts.shown[part] = shown;
    parts.timeline[part]?.kill();
    parts.timeline[part] = undefined;
    parts.timeline[part] = shown
      ? part === 'head'
        ? this.playHead(parts)
        : this.playBody(parts)
      : this.hide(parts, part);
  }

  private playHead(parts: SectionParts): gsap.core.Timeline {
    const tl = gsap.timeline();
    const bandChars = parts.bands.flatMap((split) => split.chars);
    const titleChars = parts.titles.flatMap((split) => split.chars);
    const lines = parts.lines.flatMap((split) => split.lines);
    tl.to(bandChars, { opacity: 1, duration: 0.18, stagger: 0.018, ease: 'none' }, 0);
    tl.to(titleChars, { yPercent: 0, duration: 0.7, stagger: 0.024, ease: EASE_OUT }, 0.08);
    tl.to(lines, { yPercent: 0, duration: 0.85, stagger: 0.07, ease: EASE_OUT }, 0.28);
    tl.to(parts.links, { y: 0, opacity: 1, duration: 0.6, stagger: 0.07, ease: EASE_SETTLE }, 0.45);
    tl.to(parts.objects, { y: 0, autoAlpha: 1, duration: 0.8, ease: EASE_SETTLE }, 0.3);
    return tl;
  }

  private playBody(parts: SectionParts): gsap.core.Timeline {
    const tl = gsap.timeline();
    parts.cards.forEach((pieces, index) => {
      tl.to(pieces, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: EASE_SETTLE }, index * 0.12);
    });
    return tl;
  }

  /**
   * Reset for the next arrival. Usually the section has already faded, so
   * this is never seen; About resets while still faintly in at the pad, so
   * the copy drops back into its masks rather than blinking out.
   */
  private hide(parts: SectionParts, part: RevealPart): gsap.core.Timeline {
    const tl = gsap.timeline({ defaults: { duration: 0.3, ease: 'power2.in' } });
    if (part === 'body') {
      for (const pieces of parts.cards) tl.to(pieces, { y: 22, opacity: 0 }, 0);
      return tl;
    }
    tl.to(parts.bands.flatMap((split) => split.chars), { opacity: 0 }, 0);
    tl.to(parts.titles.flatMap((split) => split.chars), { yPercent: 108 }, 0);
    tl.to(parts.lines.flatMap((split) => split.lines), { yPercent: 108 }, 0);
    tl.to(parts.links, { y: 12, opacity: 0 }, 0);
    tl.to(parts.objects, { y: 22, autoAlpha: 0 }, 0);
    return tl;
  }
}

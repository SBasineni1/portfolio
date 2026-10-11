import { about, bands, contact, education, experience, projects, site, type Band } from '../content';
import { progressForAltitude } from '../world/camera';
import { educationSplit, experienceCard, projectCard } from './cards';
import { anchor, el } from './dom';
import { attachRail } from './rail';

/**
 * Turns content.ts into DOM, parks each section at its altitude band, and
 * reveals it as the balloon approaches. Sections stay in document order for
 * assistive tech; only their position and opacity are scripted.
 */

interface Positioned {
  el: HTMLElement;
  band: Band;
  altitude: number;
  center: number;
  kind: 'panel' | 'station';
  /** Last published reveal amount, 0..1. Starts off-scale to force a write. */
  shown: number;
  exit: boolean;
  gate: number;
  shownSweep: number;
  /** Whether the head (titles, copy) and body (cards) have arrived, for the reveals. */
  arrived: boolean;
  bodyArrived: boolean;
}

/** A section has arrived (`shown`) or fully left; `body` is a station's cards. */
export type RevealListener = (section: HTMLElement, part: 'head' | 'body', shown: boolean) => void;

/** 0 → "0", 900 → "0.9", 10000 → "10": kilometres without trailing zeros. */
const km = (m: number): string => String(Math.round(m / 100) / 10);

/** Distance, in viewports, at which a section has faded out entirely. */
const REVEAL_FAR = 0.85;
/** Length of the fade, in viewports. Full opacity by 0.35 viewports out. */
const REVEAL_RAMP = 0.5;

export class Sections {
  private readonly items: Positioned[] = [];
  private readonly content: HTMLElement;
  private readonly relayouts: (() => void)[] = [];
  private pageHeight = 0;
  /** Phone-width layout: text panels also send the balloon off-screen (see update). */
  private narrow = false;
  private exitState = 0;

  constructor(
    private readonly reduced: () => boolean,
    private readonly onStationEnter: (band: Band) => void,
    private readonly onReveal: RevealListener = () => undefined,
  ) {
    const content = document.querySelector<HTMLElement>('#content');
    if (!content) throw new Error('#content missing');
    this.content = content;
    this.render();
  }

  private render(): void {
    for (const node of document.querySelectorAll('[data-name]')) node.textContent = site.name;
    for (const station of ['projects', 'experience', 'education'] as const) {
      const lede = document.querySelector(`[data-lede="${station}"]`);
      if (lede) lede.textContent = site.ledes[station];
    }

    const aboutHost = document.querySelector('[data-about]');
    if (aboutHost) {
      aboutHost.append(el('p', 'panel__lede', about.lede));
      for (const p of about.paragraphs) aboutHost.append(el('p', undefined, p));
      if (about.facts.length > 0) {
        const facts = el('dl', 'facts');
        for (const fact of about.facts) {
          const row = el('div', 'facts__row');
          row.append(el('dt', undefined, fact.label), el('dd', undefined, fact.value));
          facts.append(row);
        }
        aboutHost.append(facts);
      }
    }

    // Kicker: section number, the layer of sky it sits in, and its altitude range.
    bands.forEach((band, index) => {
      const host = document.querySelector(`[data-band="${band.id}"]`);
      if (!host) return;
      host.append(el('span', 'panel__index', String(index + 1).padStart(2, '0')));
      host.append(el('span', 'panel__layer', band.layer));
      host.append(el('span', 'panel__range', `${km(band.from)}–${km(band.to)} km`));
    });

    const projectHost = document.querySelector<HTMLElement>('[data-projects]');
    if (projectHost) {
      for (let i = 0; i < projects.length; i++) projectHost.append(projectCard(projects[i], i));
      const ruler = document.querySelector<HTMLElement>('[data-ruler="projects"]');
      this.relayouts.push(attachRail(projectHost, ruler, this.reduced));
    }

    const expHost = document.querySelector<HTMLElement>('[data-experience]');
    if (expHost) {
      for (let i = 0; i < experience.length; i++) {
        expHost.append(experienceCard(experience[i], i));
      }
      const ruler = document.querySelector<HTMLElement>('[data-ruler="experience"]');
      this.relayouts.push(attachRail(expHost, ruler, this.reduced));
    }

    const eduHost = document.querySelector('[data-education]');
    if (eduHost) eduHost.append(educationSplit(education));

    const contactHost = document.querySelector('[data-contact]');
    if (contactHost) {
      contactHost.append(link('Email', `mailto:${contact.email}`, contact.email));
      contactHost.append(
        link('GitHub', `https://github.com/${contact.github}`, `github.com/${contact.github}`),
      );
      if (contact.linkedin) {
        contactHost.append(
          link('LinkedIn', `https://www.linkedin.com/in/${contact.linkedin}/`, `linkedin.com/in/${contact.linkedin}`),
        );
      }
    }

    for (const band of bands) {
      const section = document.querySelector<HTMLElement>(`#${band.id}`);
      if (section) {
        this.items.push({
          el: section,
          band,
          altitude: band.altitude,
          center: 0,
          kind: section.classList.contains('station') ? 'station' : 'panel',
          shown: -1,
          exit: false,
          gate: 0,
          shownSweep: -1,
          arrived: false,
          bodyArrived: false,
        });
      }
    }
  }

  /**
   * Position every section for the current viewport. On narrow screens the
   * panels sit low in the frame instead of centred, so the balloon still has
   * the top of the screen to itself.
   */
  layout(pageHeight: number, viewportHeight: number, bottomAnchored = false): void {
    this.pageHeight = pageHeight;
    this.narrow = bottomAnchored;
    this.content.style.height = `${pageHeight}px`;
    const range = Math.max(1, pageHeight - viewportHeight);
    for (const item of this.items) {
      const center = progressForAltitude(item.altitude) * range + viewportHeight * 0.5;
      item.center = center;
      const h = item.el.offsetHeight;
      const top = bottomAnchored
        ? center + viewportHeight * 0.5 - h - 74
        : center - h / 2;
      item.el.style.top = `${Math.round(Math.max(viewportHeight * 0.06, top))}px`;
    }
    for (const relayout of this.relayouts) relayout();
  }

  /**
   * Reveal is scroll-linked rather than a threshold class, so a section comes
   * up with the payload instead of firing a fixed-length transition of its
   * own. The ramp saturates well before a panel parks, so a section at rest
   * is always fully opaque and legible.
   */
  update(
    scrollY: number,
    viewportHeight: number,
    dt: number,
    balloonClear: boolean,
  ): number {
    let focus = 0;
    let exit = 0;
    for (const item of this.items) {
      const d = Math.abs(scrollY + viewportHeight * 0.5 - item.center) / viewportHeight;
      const t = Math.min(1, Math.max(0, (REVEAL_FAR - d) / REVEAL_RAMP));
      const eased = t * t * (3 - 2 * t);
      let sweep = eased;
      // On a phone there is no room beside a text panel either, so About
      // parks the balloon off-screen too. Contact keeps it: its copy is about
      // the parachute in view. Panels latch later (0.75) than stations, so
      // About — already faintly in at the pad — cannot fire before release.
      const panelExit = this.narrow && item.kind === 'panel' && item.band.id !== 'contact';
      if (panelExit) {
        if (!item.exit && eased >= 0.75) {
          item.exit = true;
          this.onStationEnter(item.band);
        } else if (item.exit && eased < 0.3) {
          item.exit = false;
        }
        if (item.exit) {
          exit = 1;
          focus = Math.max(focus, eased);
        }
      } else if (item.kind === 'panel') {
        // Rotated out of the phone layout mid-read: release the balloon.
        item.exit = false;
      }
      if (item.kind === 'station') {
        focus = Math.max(focus, eased);
        if (!item.exit && eased >= 0.15) {
          item.exit = true;
          item.gate = 0;
          this.onStationEnter(item.band);
        } else if (item.exit && eased < 0.05) {
          item.exit = false;
          item.gate = 0;
        }
        if (item.exit && (balloonClear || item.gate > 0)) {
          item.gate = Math.min(1, item.gate + dt / 0.4);
        }
        const g = item.gate;
        sweep = Math.min(eased, g * g * (3 - 2 * g));
        if (item.exit) exit = 1;
      }
      // Arrival has hysteresis: a section plays its reveal once it is mostly
      // in, and resets only after it has faded out completely.
      if (!item.arrived && eased >= 0.5) {
        item.arrived = true;
        this.onReveal(item.el, 'head', true);
      } else if (item.arrived && eased < 0.05) {
        item.arrived = false;
        this.onReveal(item.el, 'head', false);
      }
      if (item.kind === 'station') {
        if (!item.bodyArrived && sweep >= 0.35) {
          item.bodyArrived = true;
          this.onReveal(item.el, 'body', true);
        } else if (item.bodyArrived && sweep < 0.02) {
          item.bodyArrived = false;
          this.onReveal(item.el, 'body', false);
        }
      }
      if (Math.abs(eased - item.shown) >= 0.004) {
        item.shown = eased;
        item.el.style.setProperty('--in', eased.toFixed(3));
      }
      if (Math.abs(sweep - item.shownSweep) >= 0.004) {
        item.shownSweep = sweep;
        item.el.style.setProperty('--sweep', sweep.toFixed(3));
      }
    }
    this.exitState = exit;
    return focus;
  }

  /** Every section element, in document order. */
  get elements(): HTMLElement[] {
    return this.items.map((item) => item.el);
  }

  get exit(): number {
    return this.exitState;
  }

  get height(): number {
    return this.pageHeight;
  }
}

/** A contact row: label, value, and an arrow that moves on hover. The whole row is the link. */
function link(key: string, href: string, label: string): HTMLLIElement {
  const li = el('li');
  const a = href.startsWith('mailto:') ? el('a') : anchor(href, '');
  a.href = href;
  a.className = 'links__row';
  a.append(el('span', 'links__key', key), el('span', 'links__value', label), el('span', 'links__arrow', '↗'));
  a.lastElementChild?.setAttribute('aria-hidden', 'true');
  li.append(a);
  return li;
}

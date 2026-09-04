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
  armed: boolean;
}

const km = (m: number): string => (m / 1000).toFixed(1);

/** Distance, in viewports, at which a section has faded out entirely. */
const REVEAL_FAR = 0.85;
/** Length of the fade, in viewports. Full opacity by 0.35 viewports out. */
const REVEAL_RAMP = 0.5;

export class Sections {
  private readonly items: Positioned[] = [];
  private readonly content: HTMLElement;
  private readonly relayouts: (() => void)[] = [];
  private pageHeight = 0;
  homeX = 0.5;
  homeY = 0.44;

  constructor(
    private readonly reduced: () => boolean,
    private readonly onStationEnter: (band: Band) => void,
  ) {
    const content = document.querySelector<HTMLElement>('#content');
    if (!content) throw new Error('#content missing');
    this.content = content;
    this.render();
  }

  private render(): void {
    for (const node of document.querySelectorAll('[data-name]')) node.textContent = site.name;
    for (const node of document.querySelectorAll('[data-flight]')) node.textContent = site.flight;
    const tagline = document.querySelector('[data-tagline]');
    if (tagline) tagline.textContent = site.tagline;
    for (const station of ['projects', 'experience', 'education'] as const) {
      const lede = document.querySelector(`[data-lede="${station}"]`);
      if (lede) lede.textContent = site.ledes[station];
    }

    const aboutHost = document.querySelector('[data-about]');
    if (aboutHost) for (const p of about.paragraphs) aboutHost.append(el('p', undefined, p));

    for (const band of bands) {
      const host = document.querySelector(`[data-band="${band.id}"]`);
      if (!host) continue;
      host.append(el('span', undefined, `${km(band.from)}–${km(band.to)} km`));
      host.append(el('span', undefined, band.layer));
    }

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
          link('LinkedIn', `https://www.linkedin.com/in/${contact.linkedin}`, contact.linkedin),
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
          armed: true,
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
    defaultX: number,
    defaultY: number,
    useHomes: boolean,
  ): number {
    let focus = 0;
    let xTotal = 0;
    let xWeight = 0;
    let yTotal = 0;
    let yWeight = 0;
    for (const item of this.items) {
      const d = Math.abs(scrollY + viewportHeight * 0.5 - item.center) / viewportHeight;
      const t = Math.min(1, Math.max(0, (REVEAL_FAR - d) / REVEAL_RAMP));
      const eased = t * t * (3 - 2 * t);
      if (item.kind === 'station') {
        focus = Math.max(focus, eased);
        if (item.armed && eased >= 0.15) {
          this.onStationEnter(item.band);
          item.armed = false;
        } else if (!item.armed && eased < 0.05) {
          item.armed = true;
        }
      }
      if (useHomes && item.band.homeX !== undefined) {
        xTotal += eased * item.band.homeX;
        xWeight += eased;
      }
      if (useHomes && item.band.homeY !== undefined) {
        yTotal += eased * item.band.homeY;
        yWeight += eased;
      }
      if (Math.abs(eased - item.shown) < 0.004) continue;
      item.shown = eased;
      const value = eased.toFixed(3);
      item.el.style.setProperty('--in', value);
      item.el.style.setProperty('--sweep', value);
    }
    const xBlend = xWeight > 0 ? xTotal / xWeight : defaultX;
    const yBlend = yWeight > 0 ? yTotal / yWeight : defaultY;
    const xPresence = Math.min(1, xWeight);
    const yPresence = Math.min(1, yWeight);
    this.homeX = xPresence * xBlend + (1 - xPresence) * defaultX;
    this.homeY = yPresence * yBlend + (1 - yPresence) * defaultY;
    return focus;
  }

  get height(): number {
    return this.pageHeight;
  }
}

function link(key: string, href: string, label: string): HTMLLIElement {
  const li = el('li');
  li.append(el('span', 'links__key', key));
  const a = href.startsWith('mailto:') ? el('a', undefined, label) : anchor(href, label);
  if (href.startsWith('mailto:')) a.href = href;
  li.append(a);
  return li;
}

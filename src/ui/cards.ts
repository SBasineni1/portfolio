import type { EducationEntry, ExperienceEntry, Project } from '../content';
import { mountCarousel } from './carousel';
import { anchor, el } from './dom';
import { icon, type IconName } from './icons';
import { attachPreviewPop } from './preview-pop';

/** Each skill's mark: the tool's own logo where it has one, else a symbol for the idea. */
const SKILL_ICONS = new Map<string, IconName>([
  ['Python', 'python'],
  ['Linux', 'linux'],
  ['SciPy', 'scipy'],
  ['HPC', 'server'],
  ['SQL', 'database'],
  ['Java', 'java'],
  ['HTML/CSS', 'html'],
  ['Raspberry Pi', 'raspberryPi'],
  ['Machine Learning', 'brain'],
]);

function skills(items: string[]): HTMLUListElement {
  const list = el('ul', 'skills');
  for (const item of items) {
    const li = el('li');
    const name = SKILL_ICONS.get(item);
    if (name) li.append(icon(name));
    li.append(item);
    list.append(li);
  }
  return list;
}

function coverImage(src: string): HTMLImageElement {
  const image = el('img');
  image.src = src;
  image.alt = '';
  return image;
}

// Touch screens have no hover: a preview rises inside the cover once its card
// is swiped mostly into view instead.
let touchObserver: IntersectionObserver | undefined;

function revealOnTouch(card: HTMLElement): void {
  touchObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle('is-previewing', entry.isIntersecting);
    },
    { threshold: 0.6 },
  );
  touchObserver.observe(card);
}

export function projectCard(project: Project, index: number): HTMLLIElement {
  const card = el('li', 'card card--project');
  card.style.setProperty('--i', String(index));
  if (project.accent) card.style.setProperty('--accent', project.accent);

  // The display title on the cover is the card's heading; no caption row repeats it.
  const cover = el('div', 'card__cover');
  if (project.cover) cover.append(coverImage(project.cover));
  cover.append(el('h3', 'card__big', project.title));
  if (project.preview) {
    if (matchMedia('(hover: hover)').matches) {
      attachPreviewPop(card, cover, project.preview);
    } else {
      const preview = el('div', 'card__preview');
      const shot = coverImage(project.preview);
      shot.alt = `${project.title} screenshot`;
      shot.loading = 'lazy';
      preview.append(shot);
      cover.append(preview);
      revealOnTouch(card);
    }
  }
  card.append(cover);

  const body = el('div', 'card__body');
  body.append(el('p', 'card__text', project.description));
  if (project.tech.length) {
    const chips = el('ul', 'chips');
    for (const item of project.tech) chips.append(el('li', undefined, item));
    body.append(chips);
  }
  if (project.repo || project.slides || project.link) {
    const actions = el('div', 'card__actions');
    if (project.repo) {
      const repo = anchor(project.repo, 'Repository');
      repo.className = 'button button--ghost';
      repo.prepend(icon('github'));
      actions.append(repo);
    }
    if (project.slides) {
      const slides = anchor(project.slides, 'Slides');
      slides.className = 'button button--ghost';
      slides.prepend(icon('presentation'));
      actions.append(slides);
    }
    if (project.link) {
      const visit = anchor(project.link, 'View project');
      visit.className = 'button button--solid';
      visit.append(icon('chevron'));
      actions.append(visit);
    }
    body.append(actions);
  }
  card.append(body);
  return card;
}

export function groupDivider(label: string, index: number): HTMLLIElement {
  const divider = el('li', 'rail__divider');
  divider.style.setProperty('--i', String(index));
  divider.append(el('h3', 'rail__divider-label', label));
  return divider;
}

export function experienceCard(entry: ExperienceEntry, index: number): HTMLLIElement {
  const card = el('li', 'card card--exp');
  card.style.setProperty('--i', String(index));
  if (entry.accent) card.style.setProperty('--accent', entry.accent);

  if (entry.cover) {
    const cover = el('div', 'card__cover');
    cover.append(coverImage(entry.cover));
    card.append(cover);
  }
  card.append(el('div', 'card__tint'));

  // The org's mark on a white tile, so any logo reads on any photograph.
  const logo = el('div', 'card__logo');
  if (entry.logo) {
    const tile = el('span', 'card__mark');
    tile.append(coverImage(entry.logo));
    logo.append(tile);
  }
  logo.append(el('span', undefined, entry.org));
  card.append(logo);

  const content = el('div', 'card__content');
  const meta = el('p', 'card__meta');
  const when = el('span');
  when.append(icon('calendar'), entry.dates);
  meta.append(when);
  if (entry.location) {
    const where = el('span');
    where.append(icon('mapPin'), entry.location);
    meta.append(where);
  }
  content.append(meta);
  content.append(el('h3', 'card__title', entry.role));
  content.append(el('p', 'card__text', entry.summary));
  // Skills on the left, any link held to the far right of the same row.
  const foot = el('div', 'card__foot');
  if (entry.tech?.length) foot.append(skills(entry.tech));
  if (entry.link) {
    const link = anchor(entry.link.href, entry.link.label);
    link.className = 'card__link';
    link.append(icon('arrow'));
    foot.append(link);
  }
  if (foot.childElementCount) content.append(foot);
  card.append(content);
  return card;
}

export function educationSplit(entries: EducationEntry[], reduced: () => boolean = () => false): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const first = entries[0];
  if (!first) return fragment;

  const hero = el('div', 'edu__hero');
  if (first.accent) hero.style.setProperty('--accent', first.accent);
  const cover = el('div', 'edu__cover');
  if (first.photos?.length) mountCarousel(cover, first.photos, first.photosTitle, reduced);
  else if (first.cover) cover.append(coverImage(first.cover));
  else cover.append(el('span', 'edu__mark', first.school));
  hero.append(cover);

  const card = el('div', 'edu__card');
  const head = el('div', 'edu__head');
  head.append(el('h3', undefined, first.school));
  if (first.location) head.append(el('span', 'edu__location', first.location));
  card.append(head);
  if (first.degree) card.append(el('p', 'edu__degree', first.degree));
  if (first.minor) card.append(el('p', 'edu__degree edu__minor', first.minor));
  if (first.description) {
    card.append(el('p', 'edu__subhead', 'Colleges'));
    card.append(el('p', 'edu__text edu__colleges', first.description));
  }
  if (first.courses?.length) {
    card.append(el('p', 'edu__subhead', 'Relevant coursework'));
    card.append(el('p', 'edu__text edu__courses', first.courses.join(', ')));
  }
  hero.append(card);
  fragment.append(hero);

  // Earlier schools: a line each under the card, name and place.
  for (const entry of entries.slice(1)) {
    const row = el('div', 'edu__row');
    const identity = el('div');
    identity.append(el('h3', undefined, entry.school));
    if (entry.degree) identity.append(el('p', 'edu__degree', entry.degree));
    row.append(identity);
    const where = entry.location ?? entry.dates;
    if (where) row.append(el('span', 'edu__where', where));
    fragment.append(row);
  }
  return fragment;
}

import type { EducationEntry, ExperienceEntry, Project } from '../content';
import { anchor, el } from './dom';

function tags(items: string[]): HTMLUListElement {
  const list = el('ul', 'tags');
  for (const item of items) list.append(el('li', undefined, item));
  return list;
}

function coverImage(src: string): HTMLImageElement {
  const image = el('img');
  image.src = src;
  image.alt = '';
  return image;
}

export function projectCard(project: Project, index: number): HTMLLIElement {
  const card = el('li', 'card card--project');
  card.style.setProperty('--i', String(index));
  if (project.accent) card.style.setProperty('--accent', project.accent);

  const label = el('div', 'card__label');
  label.append(el('span', undefined, String(index + 1).padStart(2, '0')));
  if (project.year) label.append(el('span', undefined, project.year));
  card.append(label);

  const cover = el('div', 'card__cover');
  if (project.cover) {
    cover.append(coverImage(project.cover));
  } else {
    cover.classList.add('card__cover--type');
    cover.append(el('span', 'card__big', project.title));
  }
  card.append(cover);

  const body = el('div', 'card__body');
  body.append(el('h3', 'card__title', project.title));
  body.append(el('p', 'card__text', project.description));
  if (project.tech.length) body.append(tags(project.tech));
  if (project.link || project.repo) {
    const links = el('div', 'entry__links');
    if (project.link) links.append(anchor(project.link, 'Visit'));
    if (project.repo) links.append(anchor(project.repo, 'Source'));
    body.append(links);
  }
  card.append(body);
  return card;
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

  const logo = el('div', 'card__logo');
  if (entry.logo) logo.append(coverImage(entry.logo));
  else logo.append(el('span', undefined, entry.org));
  card.append(logo);

  const content = el('div', 'card__content');
  const meta = entry.location ? `${entry.dates} · ${entry.location}` : entry.dates;
  content.append(el('p', 'card__eyebrow', meta));
  content.append(el('h3', 'card__title', entry.role));
  content.append(el('p', 'card__text', entry.summary));
  if (entry.tech?.length) content.append(tags(entry.tech));
  card.append(content);
  return card;
}

export function educationSplit(entries: EducationEntry[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const first = entries[0];
  if (!first) return fragment;

  const hero = el('div', 'edu__hero');
  if (first.accent) hero.style.setProperty('--accent', first.accent);
  const cover = el('div', 'edu__cover');
  if (first.cover) cover.append(coverImage(first.cover));
  else cover.append(el('span', 'edu__mark', first.school));
  hero.append(cover);

  const card = el('div', 'edu__card');
  const head = el('div', 'edu__head');
  head.append(el('h3', undefined, first.school));
  if (first.location) head.append(el('span', 'edu__location', first.location));
  card.append(head);
  card.append(el('p', 'edu__degree', first.degree));
  if (first.description) card.append(el('p', 'edu__text', first.description));
  if (first.courses?.length) card.append(tags(first.courses));
  card.append(el('p', 'edu__dates', first.dates));
  hero.append(card);
  fragment.append(hero);

  for (const entry of entries.slice(1)) {
    const row = el('div', 'edu__row');
    const identity = el('div');
    identity.append(el('h3', undefined, entry.school));
    identity.append(el('p', 'edu__degree', entry.degree));
    row.append(identity);
    const meta = entry.location ? `${entry.dates} · ${entry.location}` : entry.dates;
    row.append(el('span', 'edu__dates', meta));
    fragment.append(row);
  }
  return fragment;
}

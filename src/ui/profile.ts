import { contact, profile, site } from '../content';
import type { SiteCloud } from '../world/sites/types';
import { anchor, el } from './dom';
import { EASE_OUT, gsap } from './motion';

/** The angle the Polaroid rests at, degrees. */
const REST = -3.5;
/** Undeveloped instant film: washed out and colourless. */
const UNDEVELOPED = 'brightness(1.55) contrast(0.55) saturate(0) sepia(0.3)';
const LINKEDIN = `https://www.linkedin.com/in/${contact.linkedin}/`;
const GITHUB = `https://github.com/${contact.github}`;
const SVG = 'http://www.w3.org/2000/svg';

export interface Polaroid {
  /** Recolour the cloud holder for the launch site now showing. */
  setCloud(cloud: SiteCloud): void;
}

/**
 * The hero portrait as a Polaroid: the headshot on instant film in a cream
 * frame with a plain bottom strip (the hero copy already says who this is),
 * held at the top by a small cloud coloured for the current site's light.
 *
 * The photo is a link to LinkedIn; on the film back, the GitHub avatar is a
 * link to GitHub. Clicking the frame, swiping sideways, or the hint below
 * (a real button, for keyboards) turns the print over.
 *
 * On load it drops in and settles at a slight angle, then the photo develops
 * from a washed-out grey into colour; on desktop it tilts toward the pointer.
 * Under reduced motion it simply sits there, developed, and a flip swaps faces.
 */
export function mountProfile(): Polaroid {
  const idle: Polaroid = { setCloud: () => undefined };
  const host = document.querySelector<HTMLElement>('[data-profile]');
  if (!host) return idle;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const card = el('div', 'polaroid');
  const frame = el('div', 'profile__frame');
  const rotator = el('span', 'profile__rotator');

  const front = el('span', 'profile__face profile__face--front polaroid__front');
  const photo = anchor(LINKEDIN, '');
  photo.className = 'polaroid__photo';
  photo.setAttribute('aria-label', `${site.name} on LinkedIn`);
  photo.draggable = false;
  const headshot = el('img');
  headshot.src = profile.headshot;
  headshot.alt = '';
  headshot.width = 480;
  headshot.height = 480;
  headshot.decoding = 'async';
  headshot.fetchPriority = 'high';
  headshot.draggable = false;
  photo.append(headshot);

  // A cloud stuck over the top edge holds the print, where tape would.
  const cloud = document.createElementNS(SVG, 'svg');
  cloud.setAttribute('class', 'polaroid__cloud');
  cloud.setAttribute('viewBox', '-6 -6 132 66');
  cloud.setAttribute('aria-hidden', 'true');
  cloud.innerHTML =
    '<defs>' +
    '<linearGradient id="polaroid-cloud" x1="0" y1="0" x2="0" y2="1">' +
    '<stop class="polaroid__cloud-top" offset="0.15"/><stop class="polaroid__cloud-base" offset="1"/>' +
    '</linearGradient>' +
    // Softens the outline so it reads as vapour, not a sticker.
    '<filter id="polaroid-cloud-soft" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="1.1"/></filter>' +
    '</defs>' +
    '<g filter="url(#polaroid-cloud-soft)">' +
    '<path fill="url(#polaroid-cloud)" d="M22 50c-10 0-17-6-17-14 0-7 6-13 14-13 1-11 10-19 22-19 8 0 15 4 19 10 3-2 7-3 11-3 11 0 20 8 21 18 9 1 16 7 16 15 0 4-2 6-6 6z"/>' +
    '<ellipse class="polaroid__cloud-top" cx="44" cy="20" rx="15" ry="8" opacity="0.55"/>' +
    '</g>';
  front.append(photo, cloud);

  const back = el('span', 'profile__face profile__face--back polaroid__back');
  const sticker = anchor(GITHUB, '');
  sticker.className = 'polaroid__sticker';
  sticker.setAttribute('aria-label', `${site.name} on GitHub`);
  sticker.draggable = false;
  const avatar = el('img');
  avatar.src = profile.reverseImage;
  avatar.alt = '';
  avatar.width = 240;
  avatar.height = 240;
  avatar.decoding = 'async';
  avatar.draggable = false;
  sticker.append(avatar);
  back.append(sticker, el('span', 'polaroid__handle', `github.com/${contact.github}`));

  rotator.append(front, back);
  frame.append(rotator);

  // The hint is the flip control for keyboards, and sits on the print's angle.
  const hint = el('button', 'profile__hint');
  hint.type = 'button';
  hint.setAttribute('aria-pressed', 'false');
  card.append(frame, hint);
  const status = el('span', 'profile__status', 'Photo showing');
  status.setAttribute('aria-live', 'polite');
  host.append(card, status);

  // Touch screens are tapped, not clicked.
  const verb = window.matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click';
  let angle = 0;
  let flips = 0;
  let flipped = false;
  let busy = false;
  let timer = 0;
  let pointer = -1;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;

  const sync = (): void => {
    // Starts as an invitation; after that it names the link on the face showing.
    hint.textContent = flips === 0 ? `${verb} here to flip` : flipped ? `GitHub! ${verb} again` : `LinkedIn! ${verb} again`;
    // No aria-label: the visible words are the name, and aria-pressed carries the state.
    hint.setAttribute('aria-pressed', String(flipped));
    // Only the face showing can be clicked or tabbed to.
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    photo.tabIndex = flipped ? -1 : 0;
    sticker.tabIndex = flipped ? 0 : -1;
    host.classList.toggle('is-flipped', flipped);
  };
  const settle = (): void => {
    window.clearTimeout(timer);
    busy = false;
    status.textContent = flipped ? 'Back of the photo showing: GitHub' : 'Photo showing';
  };
  const flip = (direction = 1, swipe = false): void => {
    if (busy) return;
    flipped = !flipped;
    flips++;
    angle += direction * (swipe ? 180 : 540);
    sync();
    rotator.style.setProperty('--flip-angle', `${angle}deg`);
    rotator.style.setProperty('--flip-duration', swipe ? '0.6s' : '1.5s');
    if (reduced.matches) settle();
    else {
      busy = true;
      timer = window.setTimeout(settle, swipe ? 650 : 1550);
    }
  };
  sync();

  hint.addEventListener('click', () => flip());
  // A swipe that ends on a link must not also follow it.
  frame.addEventListener(
    'click',
    (event) => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!(event.target instanceof Element) || !event.target.closest('a')) flip();
    },
    true,
  );
  frame.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    suppressClick = false;
  });
  frame.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointer) return;
    pointer = -1;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick = true;
      flip(dx < 0 ? -1 : 1, true);
    } else if (Math.abs(dy) > 15) suppressClick = true;
  });
  frame.addEventListener('pointercancel', () => {
    pointer = -1;
    suppressClick = true;
  });
  rotator.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'transform') settle();
  });
  reduced.addEventListener('change', settle);

  let shownCloud: SiteCloud | undefined;
  const api: Polaroid = {
    setCloud(next: SiteCloud): void {
      if (next === shownCloud) return;
      shownCloud = next;
      card.style.setProperty('--cloud-top', next.top);
      card.style.setProperty('--cloud-base', next.base);
    },
  };

  gsap.set(card, { rotation: REST, transformPerspective: 900 });
  if (reduced.matches) return api;

  // Drop in and settle, then develop.
  gsap.set(headshot, { filter: UNDEVELOPED });
  gsap
    .timeline({ delay: 0.3 })
    .fromTo(card, { y: -150, rotation: -15, opacity: 0 }, { y: 0, rotation: REST, opacity: 1, duration: 1.05, ease: 'back.out(1.5)' })
    .to(headshot, { filter: 'brightness(1) contrast(1) saturate(1) sepia(0)', duration: 2.4, ease: EASE_OUT }, 0.6);

  // Tilt toward the pointer while the hero is on screen (fine pointers only).
  if (!window.matchMedia('(pointer: fine)').matches) return api;
  const tiltX = gsap.quickTo(card, 'rotationX', { duration: 0.7, ease: 'power3' });
  const tiltY = gsap.quickTo(card, 'rotationY', { duration: 0.7, ease: 'power3' });
  const clamp = (n: number, limit: number): number => Math.max(-limit, Math.min(limit, n));
  window.addEventListener(
    'pointermove',
    (event) => {
      if (window.scrollY > window.innerHeight || reduced.matches) return;
      const box = card.getBoundingClientRect();
      const dx = (event.clientX - (box.left + box.width / 2)) / window.innerWidth;
      const dy = (event.clientY - (box.top + box.height / 2)) / window.innerHeight;
      tiltY(clamp(dx * 16, 8));
      tiltX(clamp(-dy * 12, 6));
    },
    { passive: true },
  );
  return api;
}

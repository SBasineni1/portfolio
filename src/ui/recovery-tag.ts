import { anchor, el } from './dom';
import { gsap } from './motion';

/**
 * Contact as the recovery tag a real radiosonde carries: "harmless weather
 * instrument, if found please contact…", on the same cream tag stock as the
 * launch-site picker, with its punched hole at the end nearest the payload.
 * main.ts draws a string from that hole to the payload hanging under the
 * parachute, and the tag swings a little as the payload drifts.
 *
 * Every row opens in a new tab: the emails as Gmail drafts addressed to
 * Suchit, the rest as profiles. Opening an email stamps the tag RECOVERED,
 * there to see on the way back. Under reduced motion the tag hangs still and
 * the stamp simply appears.
 */

export interface RecoveryTag {
  /**
   * Per frame, with the payload's bottom in viewport px: swing the tag and
   * draw the string from its hole to the payload (on the scene canvas).
   */
  tether(ctx: CanvasRenderingContext2D, payloadX: number, payloadY: number, dt: number): void;
}

/** Seconds the RECOVERED stamp stays before it fades. */
const STAMP_STAY = 4;
/** Below this width the payload hangs above the copy, so no string is drawn. */
const STRING_MIN_WIDTH = 900;
/** How far the tag leans, degrees per px/s of payload drift, and its cap. */
const SWING = 0.025;
const SWING_MAX = 4;

export function mountRecoveryTag(
  host: HTMLElement,
  contact: { email: string; schoolEmail?: string; github: string; linkedin?: string; x?: string },
  reduced: () => boolean,
): RecoveryTag {
  const section = host.closest<HTMLElement>('section');
  const tag = el('div', 'recovery');
  tag.setAttribute('role', 'group');
  tag.setAttribute('aria-label', 'Recovery tag: contact details');

  tag.append(el('p', 'recovery__warning', 'Harmless weather instrument'));
  tag.append(el('p', 'recovery__ask', 'If found, please contact:'));

  const rows = el('ul', 'recovery__rows');
  const row = (key: string, control: HTMLElement): void => {
    const li = el('li', 'recovery__row');
    li.append(el('span', 'recovery__key', key), control);
    rows.append(li);
  };

  /** An address that may wrap only after a slash, never mid-word (hyphens hold). */
  const address = (text: string): HTMLSpanElement => {
    const span = el('span');
    text.split('/').forEach((part, i, parts) => {
      span.append(part.replaceAll('-', '\u2011') + (i < parts.length - 1 ? '/' : ''));
      if (i < parts.length - 1) span.append(document.createElement('wbr'));
    });
    return span;
  };

  const link = (href: string, text: string): HTMLAnchorElement => {
    const a = anchor(href, '');
    a.className = 'recovery__value';
    a.append(address(text), el('span', 'recovery__hint', '↗'));
    return a;
  };
  // A new tab with a draft already addressed to Suchit.
  const emails: HTMLAnchorElement[] = [];
  const mail = (key: string, to: string): void => {
    const a = link(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`, to);
    a.setAttribute('aria-label', `Write an email to ${to} (opens Gmail in a new tab)`);
    emails.push(a);
    row(key, a);
  };
  mail('Email', contact.email);
  if (contact.schoolEmail) mail('School email', contact.schoolEmail);
  row('GitHub', link(`https://github.com/${contact.github}`, `github.com/${contact.github}`));
  if (contact.linkedin) {
    row('LinkedIn', link(`https://www.linkedin.com/in/${contact.linkedin}/`, `linkedin.com/in/${contact.linkedin}`));
  }
  if (contact.x) row('Twitter', link(`https://x.com/${contact.x}`, `x.com/${contact.x}`));
  tag.append(rows);

  const hole = el('span', 'recovery__hole');
  hole.setAttribute('aria-hidden', 'true');
  const stamp = el('span', 'recovery__stamp');
  stamp.setAttribute('aria-hidden', 'true');
  const stampNote = el('span', undefined, 'email opened');
  stamp.append(el('strong', undefined, 'Recovered'), stampNote);
  const status = el('span', 'recovery__status');
  status.setAttribute('aria-live', 'polite');
  tag.append(hole, stamp, status);
  host.append(tag);

  let stampTimer = 0;
  const stampIt = (): void => {
    window.clearTimeout(stampTimer);
    status.textContent = 'Opening an email draft in a new tab.';
    gsap.killTweensOf(stamp);
    if (reduced()) gsap.set(stamp, { opacity: 0.9, scale: 1 });
    else gsap.fromTo(stamp, { opacity: 0, scale: 1.5 }, { opacity: 0.9, scale: 1, duration: 0.32, ease: 'back.out(2)' });
    stampTimer = window.setTimeout(() => {
      gsap.to(stamp, { opacity: 0, duration: reduced() ? 0 : 0.5, ease: 'none' });
    }, STAMP_STAY * 1000);
  };
  for (const a of emails) a.addEventListener('click', stampIt);

  gsap.set(tag, { transformOrigin: '100% 50%' });
  let lastX = Number.NaN;
  let lean = 0;

  return {
    tether(ctx, payloadX, payloadY, dt): void {
      // Only while Contact is on screen: no layout reads the rest of the climb.
      const presence = Number(section?.style.getPropertyValue('--in') || 0);
      const shown = presence < 0.02 ? 0 : Number(getComputedStyle(tag).opacity) * presence;
      if (shown < 0.02) {
        lastX = Number.NaN;
        return;
      }

      if (!reduced() && dt > 0) {
        const vx = Number.isNaN(lastX) ? 0 : (payloadX - lastX) / dt;
        const target = Math.max(-SWING_MAX, Math.min(SWING_MAX, vx * SWING));
        lean += (target - lean) * (1 - Math.exp(-dt * 3));
        gsap.set(tag, { rotation: lean });
      }
      lastX = payloadX;
      if (window.innerWidth < STRING_MIN_WIDTH) return;

      const box = hole.getBoundingClientRect();
      const hx = box.left + box.width / 2;
      const hy = box.top + box.height / 2;
      // A string with a little weight: it sags below the straight line.
      const span = Math.hypot(payloadX - hx, payloadY - hy);
      const midX = (hx + payloadX) / 2;
      const midY = (hy + payloadY) / 2 + Math.min(90, span * 0.18);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(payloadX, payloadY);
      ctx.quadraticCurveTo(midX, midY, hx, hy);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(232, 226, 210, ${(0.7 * shown).toFixed(3)})`;
      ctx.stroke();
      ctx.restore();
    },
  };
}


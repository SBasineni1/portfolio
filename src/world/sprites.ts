import envelopeUrl from '../assets/envelope.png';
import bundleUrl from '../assets/bundle.png';
import sondeUrl from '../assets/sonde.png';

export class Sprite {
  readonly image: HTMLImageElement;
  ready = false;
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly neckX: number;
  readonly neckY: number;
  private readonly url: string;

  constructor(url: string, cx: number, cy: number, rx = 0, neckX = 0, neckY = 0) {
    this.url = url;
    this.cx = cx;
    this.cy = cy;
    this.rx = rx;
    this.neckX = neckX;
    this.neckY = neckY;
    this.image = new Image();
  }

  load(): void {
    this.image.src = this.url;
    this.image
      .decode()
      .then(() => {
        this.ready = true;
      })
      .catch(() => {
        // Stay procedural forever.
      });
  }
}

export const envelopeSprite = new Sprite(envelopeUrl, 320, 321, 314, 318, 655);
export const bundleSprite = new Sprite(bundleUrl, 33, 65);
export const sondeSprite = new Sprite(sondeUrl, 39, 50);

export function loadSprites(): void {
  envelopeSprite.load();
  bundleSprite.load();
  sondeSprite.load();
}

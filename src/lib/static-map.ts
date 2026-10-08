/**
 * Pins on a map, without a map library.
 *
 * The admin app carries no map SDK and no WebView, so the live map is the
 * Yandex static-map image: no API key, one request, and it fits its own
 * bounds around the pins when no centre is given. A tap hands the same pins to
 * Yandex Maps for panning and zooming.
 */

export interface Pin {
  lat: number;
  lng: number;
  /** Yandex pin colour code: gn green, bl blue, or orange, rd red. */
  color: 'gn' | 'bl' | 'or' | 'rd';
  /** 1–99, printed on the pin and matched by the list under the map. */
  label?: number;
}

/** The static API draws at most this many pins in one image. */
export const MAX_PINS = 99;
const TASHKENT = { lat: 41.311081, lng: 69.240562 };

function pinToken(p: Pin): string {
  const n = p.label && p.label <= MAX_PINS ? String(p.label) : '';
  return `${p.lng.toFixed(6)},${p.lat.toFixed(6)},pm2${p.color}m${n}`;
}

/** The image. `width`×`height` are capped at the API's 650×450. */
export function staticMapUrl(pins: Pin[], width = 650, height = 450): string {
  const w = Math.min(650, Math.round(width));
  const h = Math.min(450, Math.round(height));
  const shown = pins.slice(0, MAX_PINS);
  const params = [`size=${w},${h}`, 'l=map', 'lang=ru_RU'];
  if (shown.length === 0) {
    params.push(`ll=${TASHKENT.lng},${TASHKENT.lat}`, 'z=11');
  } else if (shown.length === 1) {
    params.push(`ll=${shown[0].lng},${shown[0].lat}`, 'z=14', `pt=${pinToken(shown[0])}`);
  } else {
    params.push(`pt=${shown.map(pinToken).join('~')}`);
  }
  return `https://static-maps.yandex.ru/1.x/?${params.join('&')}`;
}

/** The same pins in Yandex Maps (the app when installed, else the website). */
export function yandexMapsUrl(pins: Pin[]): string {
  const shown = pins.slice(0, MAX_PINS);
  if (shown.length === 0) return `https://yandex.uz/maps/?ll=${TASHKENT.lng},${TASHKENT.lat}&z=11`;
  return `https://yandex.uz/maps/?pt=${shown.map((p) => `${p.lng},${p.lat}`).join('~')}&l=map`;
}

/** True when the coordinates are a real fix rather than an unset 0,0. */
export function hasPin(lat?: number, lng?: number): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0);
}

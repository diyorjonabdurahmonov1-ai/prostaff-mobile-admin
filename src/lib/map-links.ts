/**
 * Pins handed to Yandex Maps.
 *
 * The live map does not draw a map itself. Yandex's map APIs, the keyless
 * Static API included, may be used free only by projects open to anyone and
 * not for monitoring or dispatching people or vehicles — and an admin app that
 * tracks workers is both closed and a monitoring tool. Opening the Yandex Maps
 * app or website with the pins is ordinary use of Yandex Maps, needs no API and
 * no licence, and gives the office a real, zoomable map.
 *
 * If the office ever wants the map drawn inside the app, that needs a paid
 * commercial licence (or another provider); see the PR notes.
 */

export interface Pin {
  lat: number;
  lng: number;
}

/** Yandex Maps takes this many points in one link without trouble. */
export const MAX_PINS = 99;
const TASHKENT = { lat: 41.311081, lng: 69.240562 };

/** All pins at once in Yandex Maps (the app when installed, else the website). */
export function yandexMapsUrl(pins: Pin[]): string {
  const shown = pins.slice(0, MAX_PINS);
  if (shown.length === 0) return `https://yandex.uz/maps/?ll=${TASHKENT.lng},${TASHKENT.lat}&z=11`;
  return `https://yandex.uz/maps/?pt=${shown.map((p) => `${p.lng},${p.lat}`).join('~')}&l=map`;
}

/** One pin, close up. */
export function yandexPinUrl(p: Pin): string {
  return `https://yandex.uz/maps/?pt=${p.lng},${p.lat}&z=16&l=map`;
}

/** True when the coordinates are a real fix rather than an unset 0,0. */
export function hasPin(lat?: number, lng?: number): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0);
}

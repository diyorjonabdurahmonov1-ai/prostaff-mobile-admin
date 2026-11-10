/**
 * The orders the list last loaded, by id.
 *
 * The order screen opens from the list, and the list already has the order in
 * full; reading it from here makes the screen instant and keeps it working on
 * a server that has no single-order admin route. The screen still asks the
 * server for a fresh copy when it can.
 */

import type { AdminOrder } from '@/lib/types';

const cache = new Map<string, AdminOrder>();

export function rememberOrders(orders: AdminOrder[]) {
  for (const o of orders) cache.set(o.id, o);
}

export function cachedOrder(id: string): AdminOrder | undefined {
  return cache.get(id);
}

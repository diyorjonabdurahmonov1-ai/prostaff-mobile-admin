/**
 * Reading the order log the way the office asks about it.
 *
 * Two questions the raw list could not answer: which orders were one request
 * ("I need four workers" goes out as four orders), and who called a cancelled
 * order off.
 */

import type { AdminOrder, CancelledBy } from '@/lib/types';

/** Orders of one request are posted together; this is the fallback window. */
const SAME_REQUEST_MS = 15_000;

function sameRequest(a: AdminOrder, b: AdminOrder): boolean {
  if (a.batch_id || b.batch_id) return !!a.batch_id && a.batch_id === b.batch_id;
  if (a.company_id || b.company_id) return false;
  return (
    a.customer_id === b.customer_id &&
    a.category_id === b.category_id &&
    a.description === b.description &&
    a.price === b.price &&
    a.lat === b.lat &&
    a.lng === b.lng &&
    Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) <= SAME_REQUEST_MS
  );
}

/** One entry per request, in the list's own order; a single order is a group of one. */
export function groupOrders(orders: AdminOrder[]): AdminOrder[][] {
  const groups: AdminOrder[][] = [];
  for (const o of orders) {
    const home = groups.find((g) => sameRequest(g[0], o));
    if (home) home.push(o);
    else groups.push([o]);
  }
  for (const g of groups) {
    g.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return groups;
}

/**
 * Who cancelled the order.
 *
 * The server's `cancelled_by` when it sends one. Without it, a worker order can
 * still be read: once a worker has accepted, the customer's app offers no
 * cancel (theirs is "Ish tugadi"), so a cancelled order that names a worker was
 * dropped by that worker, and one that names nobody was called off by the
 * customer while it was still searching. A firm's order cannot be read that way
 * — both sides can cancel it — so it stays `unknown` until the server says.
 */
export function whoCancelled(order: AdminOrder): CancelledBy | 'unknown' | null {
  if (order.status !== 'cancelled') return null;
  if (order.cancelled_by) return order.cancelled_by;
  if (order.company_id) return 'unknown';
  return order.worker_id ? 'worker' : 'customer';
}

export const CANCELLED_BY_LABEL: Record<CancelledBy | 'unknown', string> = {
  customer: 'Buyurtmachi bekor qildi',
  worker: 'Ishchi bekor qildi',
  company: 'Firma bekor qildi',
  admin: 'Admin bekor qildi',
  system: 'Tizim bekor qildi',
  unknown: 'Bekor qilingan',
};

const FOUND = ['accepted', 'in_progress', 'completed'];

/** How a request for several workers is going. */
export function groupProgress(group: AdminOrder[]) {
  const found = group.filter((o) => FOUND.includes(o.status)).length;
  const searching = group.filter((o) => ['pending', 'matching', 'invited'].includes(o.status)).length;
  return { found, searching, total: group.length };
}

/** Minutes between an order going out and its answer, when the server says when. */
export function responseMinutes(order: AdminOrder): number | null {
  if (!order.responded_at) return null;
  const ms = new Date(order.responded_at).getTime() - new Date(order.created_at).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms / 60000 : null;
}

/**
 * The two service numbers the office asked for: how often workers drop jobs
 * they took, and how fast firms answer the orders sent to them.
 */

import { responseMinutes, whoCancelled } from '@/lib/orders';
import type { AdminOrder } from '@/lib/types';

const TOOK = ['accepted', 'in_progress', 'completed'];
/** A firm order nobody answered within this long counts as unanswered. */
const UNANSWERED_AFTER_MS = 15 * 60_000;

export interface WorkerDrops {
  name: string;
  phone?: string;
  /** jobs taken and then cancelled by the worker */
  dropped: number;
  /** jobs taken in total, kept or dropped */
  taken: number;
}

/** Workers who dropped at least one job, most drops first. */
export function workerDrops(orders: AdminOrder[]): WorkerDrops[] {
  const by = new Map<string, WorkerDrops>();
  for (const o of orders) {
    if (o.company_id || !o.worker_id) continue;
    const dropped = whoCancelled(o) === 'worker';
    if (!dropped && !TOOK.includes(o.status)) continue;
    const row = by.get(o.worker_id) ?? {
      name: o.worker_name || o.worker_phone || 'Ishchi',
      phone: o.worker_phone,
      dropped: 0,
      taken: 0,
    };
    row.taken += 1;
    if (dropped) row.dropped += 1;
    by.set(o.worker_id, row);
  }
  return [...by.values()].filter((r) => r.dropped > 0).sort((a, b) => b.dropped - a.dropped || b.taken - a.taken);
}

export interface FirmAnswers {
  name: string;
  total: number;
  accepted: number;
  rejected: number;
  /** still pending past the window, or expired */
  unanswered: number;
  /** average minutes to answer, when the server sends `responded_at` */
  avgMinutes: number | null;
}

/** Every firm that received orders, busiest first. */
export function firmAnswers(orders: AdminOrder[], now = Date.now()): FirmAnswers[] {
  const by = new Map<string, FirmAnswers & { minutes: number[] }>();
  for (const o of orders) {
    if (!o.company_id) continue;
    const row = by.get(o.company_id) ?? {
      name: o.company_name || 'Firma',
      total: 0,
      accepted: 0,
      rejected: 0,
      unanswered: 0,
      avgMinutes: null,
      minutes: [],
    };
    row.total += 1;
    if (TOOK.includes(o.status)) row.accepted += 1;
    else if (o.status === 'rejected') row.rejected += 1;
    else if (
      o.status === 'expired' ||
      (o.status === 'pending' && now - new Date(o.created_at).getTime() > UNANSWERED_AFTER_MS)
    )
      row.unanswered += 1;
    const m = responseMinutes(o);
    if (m !== null) row.minutes.push(m);
    by.set(o.company_id, row);
  }
  return [...by.values()]
    .map(({ minutes, ...r }) => ({
      ...r,
      avgMinutes: minutes.length ? minutes.reduce((a, b) => a + b, 0) / minutes.length : null,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Orders placed in the last `days` days. */
export function lastDays(orders: AdminOrder[], days: number, now = Date.now()): AdminOrder[] {
  const from = now - days * 86_400_000;
  return orders.filter((o) => new Date(o.created_at).getTime() >= from);
}

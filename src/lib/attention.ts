/**
 * What needs the office's attention right now.
 *
 * The dashboard used to show how things went (counts, money, quality). It did
 * not say what to do *today*: which customers are waiting with nobody coming,
 * which firms leave orders unanswered, whose subscription is about to end, which
 * workers can never be sent a job. Those are the things a person in the office
 * acts on, so they are listed first, each one tappable.
 */

import type { AdminOrder, CompanyProfile, User } from '@/lib/types';

export interface AttentionItem {
  key: string;
  /** What is wrong, in a few words. */
  title: string;
  /** What to do about it. */
  hint: string;
  count: number;
  tint: 'danger' | 'warning' | 'primary';
  /** Where the tap leads. */
  route: '/(admin)/orders' | '/(admin)/users' | '/(admin)/companies';
  params?: Record<string, string>;
}

const MIN = 60_000;
/** A search this old with nobody found is a customer waiting for nothing. */
const STUCK_AFTER_MIN = 10;
/** Past this the order has long since expired on its own; not news any more. */
const STUCK_UNTIL_HOURS = 24;
/** A firm has no countdown, so this is how long a customer is left without an answer. */
const FIRM_SILENT_AFTER_MIN = 5;

export function buildAttention(input: {
  orders: AdminOrder[];
  users: User[];
  companies: CompanyProfile[];
  warnDays?: number;
  now?: number;
}): AttentionItem[] {
  const now = input.now ?? Date.now();
  const warnDays = input.warnDays ?? 7;
  const items: AttentionItem[] = [];

  const age = (o: AdminOrder) => (now - new Date(o.created_at).getTime()) / MIN;

  const stuck = input.orders.filter(
    (o) =>
      !o.company_id &&
      ['pending', 'matching', 'invited'].includes(o.status) &&
      age(o) >= STUCK_AFTER_MIN &&
      age(o) <= STUCK_UNTIL_HOURS * 60,
  );
  if (stuck.length > 0) {
    items.push({
      key: 'stuck',
      title: 'Ishchi topilmagan buyurtmalar',
      hint: `${STUCK_AFTER_MIN} daqiqadan beri qidirilmoqda — qo'lda ishchi tayinlang`,
      count: stuck.length,
      tint: 'danger',
      route: '/(admin)/orders',
    });
  }

  const silent = input.orders.filter(
    (o) => !!o.company_id && o.status === 'pending' && age(o) >= FIRM_SILENT_AFTER_MIN && age(o) <= STUCK_UNTIL_HOURS * 60,
  );
  if (silent.length > 0) {
    items.push({
      key: 'firm-silent',
      title: 'Firma javob bermagan buyurtmalar',
      hint: `${FIRM_SILENT_AFTER_MIN} daqiqadan beri javobsiz — firmaga qo'ng'iroq qiling`,
      count: silent.length,
      tint: 'warning',
      route: '/(admin)/orders',
    });
  }

  const ending = input.companies.filter(
    (c) => c.subscription_active && c.subscription_days_left >= 0 && c.subscription_days_left <= warnDays,
  );
  if (ending.length > 0) {
    items.push({
      key: 'subs',
      title: 'Obunasi tugayotgan firmalar',
      hint: `${warnDays} kun ichida tugaydi — uzaytirishni eslating`,
      count: ending.length,
      tint: 'warning',
      route: '/(admin)/companies',
    });
  }

  const noCategory = input.users.filter(
    (u) => u.worker_profile && !u.worker_profile.banned && (u.worker_profile.category_ids?.length ?? 0) === 0,
  );
  if (noCategory.length > 0) {
    items.push({
      key: 'no-category',
      title: 'Kategoriyasiz ishchilar',
      hint: 'Kategoriya tanlamaguncha onlayn bo‘lolmaydi va buyurtma olmaydi',
      count: noCategory.length,
      tint: 'primary',
      route: '/(admin)/users',
      params: { filter: 'nocat' },
    });
  }

  return items;
}

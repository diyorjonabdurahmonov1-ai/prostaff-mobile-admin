import type { Role, User } from '@/lib/types';

/** What each role is called in the office — the API's names are English. */
export const ROLE_LABELS: Record<Role, string> = {
  customer: 'Buyurtmachi',
  worker: 'Ishchi',
  company: 'Firma',
  admin: 'Admin',
};

/** Online as a provider: a worker or a firm taking orders right now. */
export function isOnline(u: User): boolean {
  return !!u.worker_profile?.online || !!u.company_profile?.online;
}

/** Banned as a provider. */
export function isBanned(u: User): boolean {
  return !!u.worker_profile?.banned || !!u.company_profile?.banned;
}

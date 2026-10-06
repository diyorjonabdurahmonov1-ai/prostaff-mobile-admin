// Types matching the PROSTAFF API contract (API_CONTRACT.md)

export type Role = 'customer' | 'worker' | 'company' | 'admin';
export type Gender = 'male' | 'female' | 'any';
export type OrderStatus = 'pending' | 'matching' | 'invited' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'expired';

export interface Wallet {
  balance: number;
  credit_limit: number;
  currency: 'UZS';
  min_balance: number;
}

export interface Category {
  id: string;
  key: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  icon: string;
  /** whether it still takes new work; retired rows stay readable on old records */
  active: boolean;
  /** display order on the customer's grid; ties fall back to the Uzbek name */
  sort: number;
  /** admin list only — what the category is holding, and so whether it may be deleted */
  orders_count?: number;
  providers_count?: number;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  gender: Gender;
  age: number;
  price_min: number;
  price_max: number;
  lat: number;
  lng: number;
  category_ids: string[];
  online: boolean;
  banned: boolean;
  credit_limit: number;
  rating: number;
  ratings_count: number;
  distance_km?: number;
  /** the worker's own photo — what customers are shown, not the account avatar */
  avatar_url?: string;
  about?: string;
  experience_years?: number;
  address?: string;
  /** portfolio of previous work */
  images?: string[];
  /**
   * The worker's passport series (AA1234567) — unique across the platform, and
   * the key their free trial jobs are counted under, so re-registering the same
   * person does not hand out another three. Admin-only.
   */
  passport_series?: string;
  /** trial jobs: the first `free_orders_limit` may be accepted with an empty wallet */
  free_orders_used: number;
  free_orders_limit: number;
  created_at: string;
}

export interface CompanyProfile {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  description: string;
  images: string[];
  /** legacy: services as category ids. The firm forms write `services` now. */
  category_ids?: string[];
  /** what the firm does, in its own words. Optional — may be empty. */
  services?: string;
  /** office location; 0,0 means no pin was ever set */
  lat?: number;
  lng?: number;
  online: boolean;
  banned: boolean;
  rating: number;
  ratings_count: number;
  /** the firm's logo; `images` stays the work gallery */
  avatar_url?: string;
  address?: string;
  working_hours?: string;
  employees_count?: number;
  experience_years?: number;
  email?: string;
  website?: string;
  /** the firm's service fee — customers book at this price */
  price?: number;
  /** the firm's tax number: unique, and what its free orders are counted under */
  inn?: string;
  free_orders_used: number;
  free_orders_limit: number;
  /**
   * A firm pays by the month rather than a commission per job, so this date —
   * not a wallet balance — is what lets it accept work. Absent for a firm that
   * has never bought a month.
   */
  subscription_until?: string;
  subscription_active: boolean;
  subscription_days_left: number;
  created_at: string;
}

/**
 * A tariff a firm chooses between.
 *
 * The plans differ in length and nothing else — every subscribed firm gets the
 * same platform — so a longer term simply costs less per month. `price` is the
 * whole amount for the whole term; `old_price` is the struck-through figure on
 * the card and is never charged.
 */
export interface SubscriptionPlan {
  id: string;
  months: number;
  price: number;
  old_price?: number;
  title?: string;
  active: boolean;
  sort: number;
  /** derived by the server so no screen has to do the arithmetic */
  per_month: number;
  discount_percent: number;
  created_at: string;
}

/**
 * A purchase as the admin history shows it: the sale plus the firm behind it.
 *
 * The figures are the ones copied onto the row the day it was sold, not today's
 * tariff — re-pricing a card must not rewrite what somebody already paid.
 */
export interface AdminSubscription extends CompanySubscription {
  company_name: string;
  company_phone: string;
  user_id: string;
  inn?: string;
}

/** What the subscription history is worth, and who is about to lapse. */
export interface SubscriptionTotals {
  sold: number;
  count: number;
  active_firms: number;
  expiring_firms: number;
}

/** One purchase of months, with the price and discount of the day it was sold. */
export interface CompanySubscription {
  id: string;
  company_id: string;
  months: number;
  price_per_month: number;
  discount_percent: number;
  /** what was actually charged, after the discount */
  amount: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export interface User {
  id: string;
  phone: string;
  gmail?: string;
  name?: string;
  avatar_url?: string;
  roles: Role[];
  active: boolean;
  push_token?: string;
  worker_profile?: WorkerProfile;
  company_profile?: CompanyProfile;
  wallet?: Wallet;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  worker_id?: string;
  company_id?: string;
  category_id: string;
  gender: Gender;
  description: string;
  image_url?: string;
  customer_name?: string;
  customer_phone: string;
  worker_phone?: string;
  /** what the job pays, in so'm */
  price: number;
  lat: number;
  lng: number;
  status: OrderStatus;
  invited_worker_ids: string[];
  invite_expires_at?: string;
  commission_amount?: number;
  created_at: string;
}

export interface Rating {
  id: string;
  order_id: string;
  from_user_id: string;
  to_user_id: string;
  /** the hat the rated account wore on this job — each reputation scores apart */
  target_role: Role;
  stars: number;
  comment?: string;
  created_at: string;
}

/** What a payment bought — a top-up sits in a wallet, a subscription is revenue. */
export type PaymentPurpose = 'wallet' | 'subscription';

export interface Payment {
  id: string;
  user_id: string;
  /** 'atmos' for gateway payments; 'admin' / 'dev' for money booked by hand */
  provider: string;
  amount: number;
  status: string;
  purpose: PaymentPurpose;
  /** months bought, on a subscription payment */
  months?: number;
  /** the gateway's transaction id */
  external_id?: string;
  /**
   * What went wrong, in words. Set on a failure and also on a payment that
   * settled with something odd about it — an amount that disagreed with what
   * was asked for, months paid for that could not be applied.
   */
  error?: string;
  paid_at?: string;
  created_at: string;
}

/** A payment with the person behind it — the admin log reads names, not ids. */
export interface AdminPayment extends Payment {
  user_name: string;
  user_phone: string;
  company_name?: string;
}

/** The health of the money coming in. */
export interface PaymentTotals {
  settled: number;
  pending: number;
  failed: number;
  /** Anything carrying a note, whatever its status. */
  problems: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// ── Admin-specific ─────────────────────────────────────

export interface AnalyticsBucket {
  label: string;
  count: number;
  revenue: number;
}

export interface Analytics {
  buckets: AnalyticsBucket[];
  totals: { count: number; revenue: number };
}

/**
 * An order as GET /admin/orders returns it: the raw record plus the names
 * behind its ids, so the panel can answer "who called whom, and to where"
 * without a lookup per row.
 */
export interface AdminOrder extends Order {
  customer_email?: string;
  worker_name?: string;
  company_name?: string;
  category_name?: string;
  /** commission earned on this order, in so'm */
  commission: number;
  /** the day / month / year label this order falls in, per the `period` query */
  bucket: string;
}

export interface Finance {
  payments: Payment[];
  /**
   * `subscriptions` is kept apart from `topups` because it is a different
   * business: a top-up is a worker's own money waiting to be spent on
   * commission, a subscription is revenue the moment it is taken.
   */
  totals: { topups: number; subscriptions: number; commission: number };
  commission_percent: number;
}

export interface Settings {
  commission_percent: number;
  min_balance: number;
  /** how many jobs a new worker or firm may accept before the money rules apply */
  free_order_limit: number;
  /** what one month of a firm's subscription costs, and the standing discount on it */
  company_monthly_price: number;
  company_discount_percent: number;
  /** how many days before expiry a firm is warned */
  subscription_warn_days: number;
}

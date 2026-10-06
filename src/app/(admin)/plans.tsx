import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/text';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import type {
  AdminPayment,
  AdminSubscription,
  PaymentTotals,
  SubscriptionPlan,
  SubscriptionTotals,
} from '@/lib/types';

interface HistoryResponse {
  subscriptions: AdminSubscription[];
  totals: SubscriptionTotals;
}

interface PaymentsResponse {
  payments: AdminPayment[];
  totals: PaymentTotals;
}

/** How a stored payment status reads. */
const PAYMENT_STATUS: Record<string, string> = {
  pending: 'Kutilmoqda',
  success: "To'landi",
  completed: "To'landi",
  canceled: 'Bekor qilindi',
  failed: 'Xato',
};

/**
 * Tariffs, and who has bought them.
 *
 * The two belong on one screen because they answer the same question from
 * either end: what a firm can buy, and what firms actually bought. A price
 * changed here does not touch the history below it — what a firm paid is copied
 * onto its purchase row the day it pays, precisely so re-pricing a card cannot
 * rewrite last month.
 *
 * The plans differ in length and nothing else. Every subscribed firm gets the
 * same platform, so there is no feature list to maintain — only a term and a
 * price, and a longer term costing less per month is the whole offer.
 */
export default function PlansScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [history, setHistory] = useState<AdminSubscription[]>([]);
  const [totals, setTotals] = useState<SubscriptionTotals | null>(null);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentTotals, setPaymentTotals] = useState<PaymentTotals | null>(null);
  /**
   * Problems first, by default.
   *
   * That is what the office opens this list for: a firm ringing up to say "I
   * paid and nothing happened". Everything that failed, plus anything that
   * settled with a note on it — hunting for those by eye through a list of
   * successes is how a complaint goes unanswered for a week.
   */
  const [problemsOnly, setProblemsOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  // New tariff.
  const [months, setMonths] = useState('');
  const [price, setPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [title, setTitle] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [p, h, pay] = await Promise.all([
        api.get<SubscriptionPlan[]>('/admin/subscription-plans'),
        api.get<HistoryResponse>('/admin/subscriptions'),
        api.get<PaymentsResponse>(
          `/admin/payments${problemsOnly ? '?status=problem' : ''}`,
        ),
      ]);
      setPlans(p ?? []);
      setHistory(h?.subscriptions ?? []);
      setTotals(h?.totals ?? null);
      setPayments(pay?.payments ?? []);
      setPaymentTotals(pay?.totals ?? null);
    } catch { /* keep whatever is on screen */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [problemsOnly]);

  useEffect(() => { load(); }, [load]);

  const addPlan = async () => {
    const m = parseInt(months, 10) || 0;
    const p = parseInt(price.replace(/\D/g, ''), 10) || 0;
    if (m <= 0 || p <= 0) {
      Alert.alert('Xatolik', 'Oy soni va narxni kiriting');
      return;
    }
    setBusy(true);
    try {
      await api.post('/admin/subscription-plans', {
        months: m,
        price: p,
        // Presentational only: struck through on the card, never charged.
        old_price: parseInt(oldPrice.replace(/\D/g, ''), 10) || 0,
        title: title.trim(),
        sort: m,
      });
      setMonths('');
      setPrice('');
      setOldPrice('');
      setTitle('');
      load(true);
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    } finally {
      setBusy(false);
    }
  };

  const togglePlan = async (plan: SubscriptionPlan) => {
    try {
      await api.patch(`/admin/subscription-plans/${plan.id}`, { active: !plan.active });
      load(true);
    } catch (e: any) { Alert.alert('Xatolik', e.message); }
  };

  const removePlan = (plan: SubscriptionPlan) => {
    Alert.alert(
      "Tarifni o'chirish",
      `${plan.title || `${plan.months} oy`} tarifi o'chiriladi. Sotilgan obunalarga ta'sir qilmaydi.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: async () => {
            try {
              await api.del(`/admin/subscription-plans/${plan.id}`);
              load(true);
            } catch (e: any) { Alert.alert('Xatolik', e.message); }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={t.primary}
          />
        }>
        <Text style={[styles.largeTitle, { color: t.text }]}>Tariflar va to'lovlar</Text>

        {/* The money, and the firms somebody should be ringing this week. */}
        <View style={styles.cards}>
          <StatCard
            label="Sotilgan"
            value={`${formatSom(totals?.sold ?? 0)}`}
            sub={`${totals?.count ?? 0} ta to'lov`}
            bg={t.successSoft}
            fg={t.success}
          />
          <StatCard
            label="Faol obuna"
            value={String(totals?.active_firms ?? 0)}
            sub={`${totals?.expiring_firms ?? 0} tasi tugayapti`}
            bg={t.primarySoft}
            fg={t.primary}
          />
        </View>

        {/* ── Tariffs ── */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>TARIF KARTALARI</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          {plans.length === 0 ? (
            <Text style={[styles.hint, { color: t.textMuted }]}>
              Tarif yo&apos;q — firma ilovada obunani rasmiylashtira olmaydi. Quyida qo&apos;shing.
            </Text>
          ) : (
            plans.map((plan, i) => (
              <View key={plan.id}>
                {i > 0 ? <View style={[styles.divider, { backgroundColor: t.borderLight }]} /> : null}
                <View style={styles.planRow}>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planTitle, { color: plan.active ? t.text : t.textMuted }]}>
                      {plan.title || `${plan.months} oy`}
                      {plan.discount_percent > 0 ? `  −${plan.discount_percent}%` : ''}
                    </Text>
                    <Text style={[styles.hint, { color: t.textMuted }]}>
                      {formatSom(plan.price)} so&apos;m · oyiga {formatSom(plan.per_month)} so&apos;m
                      {plan.old_price ? ` · eski ${formatSom(plan.old_price)}` : ''}
                    </Text>
                  </View>
                  <Switch
                    value={plan.active}
                    onValueChange={() => togglePlan(plan)}
                    trackColor={{ true: t.success }}
                  />
                  <Pressable onPress={() => removePlan(plan)} hitSlop={8} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={20} color={t.danger} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Add ── */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>YANGI TARIF</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <View style={styles.form}>
            <TextInput
              style={[styles.input, styles.narrow, { backgroundColor: t.surfaceMuted, color: t.text }]}
              value={months}
              onChangeText={(v) => setMonths(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="Oy"
              placeholderTextColor={t.textMuted}
            />
            <TextInput
              style={[styles.input, styles.wide, { backgroundColor: t.surfaceMuted, color: t.text }]}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="Narx"
              placeholderTextColor={t.textMuted}
            />
            <TextInput
              style={[styles.input, styles.wide, { backgroundColor: t.surfaceMuted, color: t.text }]}
              value={oldPrice}
              onChangeText={setOldPrice}
              keyboardType="decimal-pad"
              placeholder="Eski narx"
              placeholderTextColor={t.textMuted}
            />
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Nomi (ixtiyoriy) — masalan: Yillik"
            placeholderTextColor={t.textMuted}
          />
          <Text style={[styles.hint, { color: t.textMuted, marginTop: 8 }]}>
            Masalan: 1 oy — 100 000, 3 oy — 200 000. &quot;Eski narx&quot; kartada chizib
            tashlangan holda ko&apos;rinadi, chegirma foizi shundan hisoblanadi.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 }]}
            onPress={addPlan}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator color={t.onPrimary} />
            ) : (
              <Text style={[styles.btnText, { color: t.onPrimary }]}>Qo&apos;shish</Text>
            )}
          </Pressable>
        </View>

        {/* ── Who bought what ── */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>SOTIB OLINGAN OBUNALAR</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          {history.length === 0 ? (
            <Text style={[styles.hint, { color: t.textMuted }]}>Hozircha obuna sotilmagan.</Text>
          ) : (
            history.map((sub, i) => {
              const ends = new Date(sub.ends_at);
              const live = ends.getTime() > Date.now();
              return (
                <View key={sub.id}>
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: t.borderLight }]} /> : null}
                  <View style={styles.historyRow}>
                    <View style={styles.planInfo}>
                      <Text style={[styles.planTitle, { color: t.text }]} numberOfLines={1}>
                        {sub.company_name || '—'}
                      </Text>
                      <Text style={[styles.hint, { color: t.textMuted }]}>
                        {sub.months} oy · {formatSom(sub.amount)} so&apos;m
                        {sub.discount_percent > 0 ? ` · −${sub.discount_percent}%` : ''}
                      </Text>
                      <Text style={[styles.hint, { color: t.textMuted }]}>
                        {new Date(sub.created_at).toLocaleDateString()} →{' '}
                        {ends.toLocaleDateString()}
                        {sub.inn ? ` · INN ${sub.inn}` : ''}
                      </Text>
                    </View>
                    {/* Whether this particular purchase is still running — a
                        firm may have several, and only the latest is live. */}
                    <View
                      style={[
                        styles.tag,
                        { backgroundColor: live ? t.successSoft : t.surfaceMuted },
                      ]}>
                      <Text style={[styles.tagText, { color: live ? t.success : t.textMuted }]}>
                        {live ? 'Faol' : 'Tugagan'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Every payment attempt, including the ones that failed ── */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>TO&apos;LOVLAR</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <View style={styles.planRow}>
            <View style={styles.planInfo}>
              <Text style={[styles.planTitle, { color: t.text }]}>Faqat muammolilar</Text>
              <Text style={[styles.hint, { color: t.textMuted }]}>
                {paymentTotals
                  ? `${paymentTotals.problems} ta muammo · ${paymentTotals.failed} ta xato · ${paymentTotals.pending} ta kutilmoqda`
                  : '—'}
              </Text>
            </View>
            <Switch
              value={problemsOnly}
              onValueChange={setProblemsOnly}
              trackColor={{ true: t.success }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: t.borderLight }]} />

          {payments.length === 0 ? (
            <Text style={[styles.hint, { color: t.textMuted }]}>
              {problemsOnly ? "Muammoli to'lov yo'q." : "To'lov yo'q."}
            </Text>
          ) : (
            payments.map((pay, i) => {
              const failed = pay.status === 'failed';
              return (
                <View key={pay.id}>
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: t.borderLight }]} /> : null}
                  <View style={styles.payRow}>
                    <View style={styles.planInfo}>
                      <Text style={[styles.planTitle, { color: t.text }]} numberOfLines={1}>
                        {pay.company_name || pay.user_name || pay.user_phone || '—'}
                      </Text>
                      <Text style={[styles.hint, { color: t.textMuted }]}>
                        {pay.purpose === 'subscription'
                          ? `Obuna${pay.months ? ` · ${pay.months} oy` : ''}`
                          : 'Hamyon'}{' '}
                        · {formatSom(pay.amount)} so&apos;m ·{' '}
                        {new Date(pay.created_at).toLocaleString()}
                      </Text>
                      {/* The whole point of the log: what went wrong, in words,
                          where somebody answering the phone can read it. */}
                      {pay.error ? (
                        <Text style={[styles.hint, { color: t.danger }]}>{pay.error}</Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.tag,
                        {
                          backgroundColor: failed
                            ? t.dangerSoft
                            : pay.status === 'pending'
                              ? t.warningSoft
                              : t.successSoft,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.tagText,
                          {
                            color: failed
                              ? t.danger
                              : pay.status === 'pending'
                                ? t.warning
                                : t.success,
                          },
                        ]}>
                        {PAYMENT_STATUS[pay.status] ?? pay.status}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  sub,
  bg,
  fg,
}: {
  label: string;
  value: string;
  sub: string;
  bg: string;
  fg: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.statValue, { color: t.text }]}>{value}</Text>
      <Text style={[styles.statSub, { color: t.textMuted }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16 },
  largeTitle: { fontSize: 34, fontWeight: '700', marginBottom: 16 },

  cards: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 10, padding: 14, gap: 2 },
  statLabel: { fontSize: 13, fontWeight: '600' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statSub: { fontSize: 12 },

  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 16 },
  section: { borderRadius: 10, padding: 16, marginBottom: 24 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  payRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  planInfo: { flex: 1, gap: 2 },
  planTitle: { fontSize: 17 },
  iconBtn: { padding: 2 },
  hint: { fontSize: 13, lineHeight: 18 },

  form: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { height: 44, borderRadius: 8, paddingHorizontal: 14, fontSize: 17 },
  narrow: { flex: 1 },
  wide: { flex: 2 },

  btn: { height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  btnText: { fontSize: 17, fontWeight: '600' },

  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 12, fontWeight: '600' },
});

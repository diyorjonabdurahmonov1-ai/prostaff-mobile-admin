import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { firmAnswers, lastDays, workerDrops } from '@/lib/quality';
import type { AdminOrder, Analytics, Finance } from '@/lib/types';

/** The window the service numbers are measured over. */
const QUALITY_DAYS = 30;

type Period = 'day' | 'month' | 'year';
const PERIOD_LABELS: Record<Period, string> = { day: 'Kun', month: 'Oy', year: 'Yil' };

export default function DashboardScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const [period, setPeriod] = useState<Period>('month');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [recent, setRecent] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: Period, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [a, f, o] = await Promise.all([
        api.get<Analytics>(`/admin/analytics/orders?period=${p}`),
        api.get<Finance>('/admin/finance'),
        // The service numbers below; their failing must not blank the rest.
        api.get<AdminOrder[]>('/admin/orders?period=month').catch(() => [] as AdminOrder[]),
      ]);
      setAnalytics(a);
      setFinance(f);
      setRecent(o ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const onRefresh = () => { setRefreshing(true); load(period, true); };

  const windowed = useMemo(() => lastDays(recent, QUALITY_DAYS), [recent]);
  const drops = useMemo(() => workerDrops(windowed), [windowed]);
  const firms = useMemo(() => firmAnswers(windowed), [windowed]);
  const firmTotals = firms.reduce(
    (acc, f) => ({
      total: acc.total + f.total,
      accepted: acc.accepted + f.accepted,
      unanswered: acc.unanswered + f.unanswered,
    }),
    { total: 0, accepted: 0, unanswered: 0 },
  );
  const timed = firms.filter((f) => f.avgMinutes !== null);
  const avgAnswer = timed.length
    ? timed.reduce((sum, f) => sum + (f.avgMinutes as number) * f.total, 0) /
      timed.reduce((sum, f) => sum + f.total, 0)
    : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        <Text style={[styles.largeTitle, { color: t.text }]}>Boshqaruv paneli</Text>

        {/* Who is online and where — its own screen, opened from here. */}
        <Pressable
          onPress={() => router.push('/(admin)/map' as any)}
          style={({ pressed }) => [styles.mapEntry, { backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.mapIcon, { backgroundColor: t.successSoft }]}>
            <Ionicons name="map" size={22} color={t.success} />
          </View>
          <View style={styles.mapEntryText}>
            <Text style={[styles.mapEntryTitle, { color: t.text }]}>Jonli xarita</Text>
            <Text style={[styles.mapEntrySub, { color: t.textMuted }]}>
              Hozir kim onlayn va qayerda: ishchilar, firmalar, jonli joylashuv
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
        </Pressable>

        {/* Period selector */}
        <View style={[styles.segmented, { backgroundColor: t.surfaceMuted }]}>
          {(['day', 'month', 'year'] as Period[]).map((p) => (
            <Pressable
              key={p}
              style={[styles.segBtn, period === p && { backgroundColor: t.surface }]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.segText, { color: period === p ? t.text : t.textMuted }, period === p && styles.segTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && !analytics ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
        ) : (
          <>
            {/* Stat cards row */}
            <View style={styles.cardsRow}>
              <StatCard
                icon="cart-outline"
                label="Buyurtmalar"
                value={String(analytics?.totals.count ?? 0)}
                bg={t.primarySoft}
                fg={t.primary}
              />
              <StatCard
                icon="trending-up-outline"
                label="Tushum"
                value={`${formatSom(analytics?.totals.revenue ?? 0)}`}
                bg={t.successSoft}
                fg={t.success}
              />
            </View>
            {/* Finance is not split by the period above — the API returns it
                for all time — so it says so instead of looking like this
                month's number. */}
            <Text style={[styles.caption, { color: t.textMuted }]}>MOLIYA · BUTUN DAVR</Text>
            <View style={styles.cardsRow}>
              <StatCard
                icon="cash-outline"
                label="Komissiya"
                value={`${formatSom(finance?.totals.commission ?? 0)}`}
                bg={t.warningSoft}
                fg={t.warning}
              />
              <StatCard
                icon="wallet-outline"
                label="To'ldirishlar"
                value={`${formatSom(finance?.totals.topups ?? 0)}`}
                bg={t.successSoft}
                fg={t.success}
              />
            </View>
            {/* Firms pay by the month, workers by commission — two different
                kinds of money, so two different numbers. */}
            <View style={styles.cardsRow}>
              <StatCard
                icon="calendar-outline"
                label="Obunalar"
                value={`${formatSom(finance?.totals.subscriptions ?? 0)}`}
                bg={t.primarySoft}
                fg={t.primary}
              />
            </View>

            {/* Buckets breakdown */}
            {analytics?.buckets && analytics.buckets.length > 0 && (
              <View style={[styles.section, { backgroundColor: t.surface }]}>
                <Text style={[styles.sectionTitle, { color: t.text }]}>Davr bo'yicha</Text>
                {analytics.buckets.map((b, i) => (
                  <View
                    key={b.label}
                    style={[
                      styles.bucketRow,
                      i < analytics.buckets.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.borderLight },
                    ]}
                  >
                    <Text style={[styles.bucketLabel, { color: t.text }]}>{b.label}</Text>
                    <View style={styles.bucketRight}>
                      <Text style={[styles.bucketCount, { color: t.textMuted }]}>{b.count} ta</Text>
                      <Text style={[styles.bucketRevenue, { color: t.text }]}>{formatSom(b.revenue)} so'm</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Service quality: workers who drop jobs, firms that leave
                customers waiting. */}
            <Text style={[styles.caption, { color: t.textMuted }]}>
              SIFAT · SO'NGGI {QUALITY_DAYS} KUN
            </Text>

            <View style={[styles.section, { backgroundColor: t.surface }]}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Ishni bekor qilgan ishchilar</Text>
              {drops.length === 0 ? (
                <Text style={[styles.emptyLine, { color: t.textMuted }]}>
                  Qabul qilingan ishni bekor qilgan ishchi yo'q
                </Text>
              ) : (
                drops.slice(0, 5).map((w, i) => (
                  <View
                    key={`${w.name}-${i}`}
                    style={[styles.bucketRow, i < Math.min(drops.length, 5) - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.borderLight }]}
                  >
                    <View style={styles.flex}>
                      <Text style={[styles.bucketLabel, { color: t.text }]} numberOfLines={1}>{w.name}</Text>
                      {w.phone ? <Text style={[styles.bucketCount, { color: t.textMuted }]}>{w.phone}</Text> : null}
                    </View>
                    <View style={styles.bucketRight}>
                      <Text style={[styles.bucketRevenue, { color: t.danger }]}>{w.dropped} marta</Text>
                      <Text style={[styles.bucketCount, { color: t.textMuted }]}>
                        {w.taken} ta ishdan · {Math.round((w.dropped / w.taken) * 100)}%
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={[styles.section, { backgroundColor: t.surface }]}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Firmalarning javobi</Text>
              <View style={styles.firmSummary}>
                <SummaryCell
                  value={avgAnswer === null ? '—' : `${Math.max(1, Math.round(avgAnswer))} daq`}
                  label="o'rtacha javob"
                />
                <SummaryCell
                  value={firmTotals.total ? `${Math.round((firmTotals.accepted / firmTotals.total) * 100)}%` : '—'}
                  label="qabul qilingan"
                />
                <SummaryCell value={String(firmTotals.unanswered)} label="javobsiz qolgan" danger={firmTotals.unanswered > 0} />
              </View>
              {firms.slice(0, 5).map((f, i) => (
                <View
                  key={`${f.name}-${i}`}
                  style={[styles.bucketRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borderLight }]}
                >
                  <View style={styles.flex}>
                    <Text style={[styles.bucketLabel, { color: t.text }]} numberOfLines={1}>{f.name}</Text>
                    <Text style={[styles.bucketCount, { color: t.textMuted }]}>
                      {f.total} ta · {f.accepted} qabul · {f.rejected} rad
                      {f.unanswered ? ` · ${f.unanswered} javobsiz` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.bucketRevenue, { color: t.text }]}>
                    {f.avgMinutes === null ? '—' : `${Math.max(1, Math.round(f.avgMinutes))} daq`}
                  </Text>
                </View>
              ))}
              {avgAnswer === null && firms.length > 0 ? (
                <Text style={[styles.emptyLine, { color: t.textMuted }]}>
                  Javob vaqti server `responded_at` maydonini yuborganda ko'rinadi.
                </Text>
              ) : null}
              {firms.length === 0 ? (
                <Text style={[styles.emptyLine, { color: t.textMuted }]}>Bu davrda firmalarga buyurtma bo'lmagan</Text>
              ) : null}
            </View>

            {/* Commission info */}
            {finance && (
              <View style={[styles.infoRow, { backgroundColor: t.surface }]}>
                <Ionicons name="information-circle-outline" size={18} color={t.primary} />
                <Text style={[styles.infoText, { color: t.textSecondary }]}>
                  Joriy komissiya: {finance.commission_percent}%
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCell({ value, label, danger }: { value: string; label: string; danger?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.summaryCell, { backgroundColor: t.surfaceMuted }]}>
      <Text style={[styles.summaryValue, { color: danger ? t.danger : t.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

function StatCard({ icon, label, value, bg, fg }: { icon: string; label: string; value: string; bg: string; fg: string }) {
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={22} color={fg} />
      <Text style={[styles.cardLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.cardValue, { color: fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16 },
  largeTitle: { fontSize: 34, fontWeight: '700', marginBottom: 16 },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2, marginBottom: 16 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  segText: { fontSize: 13, fontWeight: '500' },
  segTextActive: { fontWeight: '600' },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { flex: 1, borderRadius: 12, padding: 14, gap: 6 },
  cardLabel: { fontSize: 13 },
  cardValue: { fontSize: 20, fontWeight: '700' },
  section: { borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', padding: 16, paddingBottom: 8 },
  bucketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  bucketLabel: { fontSize: 15 },
  bucketRight: { alignItems: 'flex-end' },
  bucketCount: { fontSize: 13, marginBottom: 2 },
  bucketRevenue: { fontSize: 15, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 14 },
  infoText: { fontSize: 15 },
  flex: { flex: 1 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 8, marginBottom: 8, marginLeft: 4 },
  emptyLine: { fontSize: 13, paddingHorizontal: 16, paddingBottom: 14 },
  firmSummary: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  summaryCell: { flex: 1, borderRadius: 8, padding: 10, gap: 2 },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { fontSize: 11 },
  mapEntry: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14, marginBottom: 16 },
  mapIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mapEntryText: { flex: 1, gap: 2 },
  mapEntryTitle: { fontSize: 16, fontWeight: '600' },
  mapEntrySub: { fontSize: 13 },
});

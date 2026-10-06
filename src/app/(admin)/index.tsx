import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
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
import type { Analytics, Finance } from '@/lib/types';

type Period = 'day' | 'month' | 'year';
const PERIOD_LABELS: Record<Period, string> = { day: 'Kun', month: 'Oy', year: 'Yil' };

export default function DashboardScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const [period, setPeriod] = useState<Period>('month');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: Period, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [a, f] = await Promise.all([
        api.get<Analytics>(`/admin/analytics/orders?period=${p}`),
        api.get<Finance>('/admin/finance'),
      ]);
      setAnalytics(a);
      setFinance(f);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const onRefresh = () => { setRefreshing(true); load(period, true); };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      >
        <Text style={[styles.largeTitle, { color: t.text }]}>Boshqaruv paneli</Text>

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
                bg={t.dangerSoft}
                fg={t.danger}
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
});

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
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
import type { AdminOrder, OrderStatus } from '@/lib/types';

/**
 * The order log.
 *
 * This tab used to show the analytics buckets and nothing else — counts and
 * commission per day, which is the finance question, not the operations one.
 * When somebody rings the office about a job there is only one thing worth
 * knowing: who ordered it, who went, where, and what happened. None of that was
 * reachable from the admin app at all, even though the API had been returning
 * it all along.
 *
 * So the buckets stay as a header line per group, and the orders themselves are
 * the list.
 */

type Period = 'day' | 'month' | 'year';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Kun' },
  { key: 'month', label: 'Oy' },
  { key: 'year', label: 'Yil' },
];

type StatusFilter = 'all' | OrderStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'invited', label: 'Qidirilmoqda' },
  { key: 'accepted', label: 'Qabul qilingan' },
  { key: 'in_progress', label: 'Bajarilmoqda' },
  { key: 'completed', label: 'Tugallangan' },
  { key: 'expired', label: 'Muddati tugagan' },
  { key: 'cancelled', label: 'Bekor qilingan' },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Kutilmoqda',
  matching: 'Qidirilmoqda',
  invited: 'Qidirilmoqda',
  accepted: 'Qabul qilingan',
  in_progress: 'Bajarilmoqda',
  completed: 'Tugallangan',
  cancelled: 'Bekor qilingan',
  expired: 'Muddati tugagan',
};

const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** "2026-07-30" → "30-iyul, 2026"; "2026-07" → "Iyul 2026"; "2026" → "2026". */
function bucketTitle(bucket: string): string {
  const parts = bucket.split('-');
  if (parts.length === 1) return bucket;
  const month = MONTHS[Number(parts[1]) - 1] ?? parts[1];
  if (parts.length === 2) return `${month[0].toUpperCase()}${month.slice(1)} ${parts[0]}`;
  return `${Number(parts[2])}-${month}, ${parts[0]}`;
}

/** A row is either a group heading or one order — one flat list, no nesting. */
type Item =
  | { kind: 'header'; bucket: string; count: number; revenue: number }
  | { kind: 'order'; order: AdminOrder; first: boolean; last: boolean };

export default function OrdersScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const [period, setPeriod] = useState<Period>('day');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: Period, s: StatusFilter, silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Status is filtered server-side: an office scrolling for one cancelled
      // job should not pull the whole year down the wire first.
      const query = `?period=${p}${s === 'all' ? '' : `&status=${s}`}`;
      const res = await api.get<AdminOrder[]>(`/admin/orders${query}`);
      setOrders(res ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period, status); }, [period, status, load]);

  /** Orders arrive newest-first, so buckets stay in order as we walk the list. */
  const items = useMemo(() => {
    const out: Item[] = [];
    let i = 0;
    while (i < orders.length) {
      const bucket = orders[i].bucket;
      const group: AdminOrder[] = [];
      while (i < orders.length && orders[i].bucket === bucket) group.push(orders[i++]);
      out.push({
        kind: 'header',
        bucket,
        count: group.length,
        revenue: group.reduce((sum, o) => sum + (o.commission ?? 0), 0),
      });
      group.forEach((order, idx) =>
        out.push({ kind: 'order', order, first: idx === 0, last: idx === group.length - 1 })
      );
    }
    return out;
  }, [orders]);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.commission ?? 0), 0);

  const header = () => (
    <View>
      <View style={[styles.segmented, { backgroundColor: t.surfaceMuted }]}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.segBtn, period === p.key && { backgroundColor: t.surface }]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.segText, { color: period === p.key ? t.text : t.textMuted }, period === p.key && styles.segTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        {STATUS_FILTERS.map((f) => {
          const active = status === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setStatus(f.key)}
              style={[
                styles.chip,
                { backgroundColor: active ? t.primary : t.surfaceMuted },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : t.textMuted }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.totalsRow}>
        <View style={[styles.totalCard, { backgroundColor: t.primarySoft }]}>
          <Ionicons name="cart" size={20} color={t.primary} />
          <Text style={[styles.totalLabel, { color: t.primary }]}>Buyurtmalar</Text>
          <Text style={[styles.totalValue, { color: t.primary }]}>{orders.length} ta</Text>
        </View>
        <View style={[styles.totalCard, { backgroundColor: t.successSoft }]}>
          <Ionicons name="trending-up" size={20} color={t.success} />
          <Text style={[styles.totalLabel, { color: t.success }]}>Komissiya</Text>
          <Text style={[styles.totalValue, { color: t.success }]}>{formatSom(totalRevenue)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <Text style={[styles.largeTitle, { color: t.text }]}>Buyurtmalar</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => (it.kind === 'header' ? `h:${it.bucket}` : it.order.id)}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text style={[styles.groupHeader, { color: t.textMuted }]}>
                {bucketTitle(item.bucket).toUpperCase()}  ·  {item.count} TA
                {item.revenue > 0 ? `  ·  +${formatSom(item.revenue)}` : ''}
              </Text>
            ) : (
              <OrderCard order={item.order} first={item.first} last={item.last} />
            )
          }
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={48} color={t.textMuted} />
              <Text style={[styles.emptyText, { color: t.textMuted }]}>Buyurtma topilmadi</Text>
            </View>
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(period, status, true); }}
              tintColor={t.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

/**
 * One order, in full.
 *
 * Deliberately a card rather than a one-line row: the question this screen
 * exists to answer needs both parties, both numbers and the address at once,
 * and a list that hides half of it behind a tap answers nothing at a glance.
 */
function OrderCard({ order, first, last }: { order: AdminOrder; first: boolean; last: boolean }) {
  const t = useTheme();

  const tone = (() => {
    switch (order.status) {
      case 'completed': return { bg: t.successSoft, fg: t.success };
      case 'accepted':
      case 'in_progress': return { bg: t.primarySoft, fg: t.primary };
      case 'cancelled':
      case 'expired': return { bg: t.dangerSoft, fg: t.danger };
      default: return { bg: t.warningSoft, fg: t.warning };
    }
  })();

  const customer = order.customer_name || order.customer_phone || '—';
  const taker = order.worker_name || order.company_name;
  const takerIcon = order.company_name ? 'business-outline' : 'hammer-outline';
  const hasPin = !!order.lat && !!order.lng;

  const openMap = () => {
    if (!hasPin) return;
    Linking.openURL(`https://yandex.uz/maps/?pt=${order.lng},${order.lat}&z=17&l=map`).catch(() => {});
  };

  const call = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.surface },
        first && styles.firstCard,
        last && styles.lastCard,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.borderLight },
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={1}>
          {order.category_name || order.description || 'Buyurtma'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusText, { color: tone.fg }]}>
            {STATUS_LABELS[order.status] ?? order.status}
          </Text>
        </View>
      </View>

      {order.description && order.category_name ? (
        <Text style={[styles.desc, { color: t.textMuted }]} numberOfLines={2}>
          {order.description}
        </Text>
      ) : null}

      {/* Who ordered it. */}
      <Pressable style={styles.line} onPress={() => call(order.customer_phone)}>
        <Ionicons name="person-outline" size={14} color={t.textMuted} />
        <Text style={[styles.lineText, { color: t.textSecondary }]} numberOfLines={1}>
          {customer}
          {order.customer_phone ? ` · ${order.customer_phone}` : ''}
        </Text>
        {order.customer_phone ? <Ionicons name="call" size={14} color={t.primary} /> : null}
      </Pressable>

      {/* Who took it — the other half of "kim kimga". Nobody yet is worth
          saying out loud: an order with no taker is the one being asked about. */}
      <Pressable style={styles.line} onPress={() => call(order.worker_phone)}>
        <Ionicons name={taker ? takerIcon : 'help-circle-outline'} size={14} color={t.textMuted} />
        <Text
          style={[styles.lineText, { color: taker ? t.textSecondary : t.textMuted }]}
          numberOfLines={1}
        >
          {taker ? `${taker}${order.worker_phone ? ` · ${order.worker_phone}` : ''}` : 'Hech kim qabul qilmagan'}
        </Text>
        {taker && order.worker_phone ? <Ionicons name="call" size={14} color={t.primary} /> : null}
      </Pressable>

      {/* Where they were sent. */}
      <Pressable style={styles.line} onPress={openMap} disabled={!hasPin}>
        <Ionicons name="location-outline" size={14} color={t.textMuted} />
        <Text style={[styles.lineText, { color: hasPin ? t.textSecondary : t.textMuted }]} numberOfLines={1}>
          {hasPin ? `${order.lat.toFixed(5)}, ${order.lng.toFixed(5)}` : 'Manzil ko‘rsatilmagan'}
        </Text>
        {hasPin ? <Ionicons name="map-outline" size={14} color={t.primary} /> : null}
      </Pressable>

      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: t.textMuted }]}>
          {new Date(order.created_at).toLocaleString()}
        </Text>
        <Text style={[styles.price, { color: t.text }]}>
          {formatSom(order.price)} so‘m
          {order.commission > 0 ? ` · +${formatSom(order.commission)}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  largeTitle: { fontSize: 34, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8 },
  listContent: { padding: 16 },

  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2, marginBottom: 12 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  segText: { fontSize: 13, fontWeight: '500' },
  segTextActive: { fontWeight: '600' },

  chipsScroll: { flexGrow: 0, marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  chipText: { fontSize: 13, fontWeight: '500' },

  totalsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  totalCard: { flex: 1, borderRadius: 12, padding: 14, gap: 4 },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 20, fontWeight: '700' },

  groupHeader: { fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 6, marginLeft: 4 },

  card: { paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  firstCard: { borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  lastCard: { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  desc: { fontSize: 13 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineText: { flex: 1, fontSize: 13 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  footerText: { fontSize: 12 },
  price: { fontSize: 13, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', marginTop: 48, gap: 12 },
  emptyText: { fontSize: 17 },
});

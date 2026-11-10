import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
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
import { rememberOrders } from '@/lib/order-cache';
import { CANCELLED_BY_LABEL, groupOrders, groupProgress, STATUS_LABELS, whoCancelled } from '@/lib/orders';
import type { AdminOrder, CancelledBy, OrderStatus } from '@/lib/types';

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
  { key: 'rejected', label: 'Rad etilgan' },
  { key: 'cancelled', label: 'Bekor qilingan' },
];

/** Narrowing a cancelled list down to who called it off. */
type CancelFilter = 'all' | CancelledBy | 'unknown';
const CANCEL_FILTERS: { key: CancelFilter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'worker', label: 'Ishchi' },
  { key: 'customer', label: 'Buyurtmachi' },
  { key: 'company', label: 'Firma' },
  { key: 'unknown', label: "Noma'lum" },
];


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

/**
 * A row is a group heading, or one request — which is one order, or several
 * orders when somebody asked for several workers at once. One flat list.
 */
type Item =
  | { kind: 'header'; bucket: string; count: number; revenue: number }
  | { kind: 'order'; orders: AdminOrder[]; first: boolean; last: boolean };

export default function OrdersScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const [period, setPeriod] = useState<Period>('day');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [cancelBy, setCancelBy] = useState<CancelFilter>('all');
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
      rememberOrders(res ?? []);
      setOrders(res ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period, status); }, [period, status, load]);

  // Coming back from an order after acting on it shows the new state.
  useFocusEffect(
    useCallback(() => {
      load(period, status, true);
    }, [load, period, status]),
  );

  /** Who-cancelled is read on this side, so it filters on this side too. */
  const shown = useMemo(
    () =>
      status === 'cancelled' && cancelBy !== 'all'
        ? orders.filter((o) => whoCancelled(o) === cancelBy)
        : orders,
    [orders, status, cancelBy],
  );

  /** Orders arrive newest-first, so buckets stay in order as we walk the list. */
  const items = useMemo(() => {
    const out: Item[] = [];
    let i = 0;
    while (i < shown.length) {
      const bucket = shown[i].bucket;
      const inBucket: AdminOrder[] = [];
      while (i < shown.length && shown[i].bucket === bucket) inBucket.push(shown[i++]);
      out.push({
        kind: 'header',
        bucket,
        count: inBucket.length,
        revenue: inBucket.reduce((sum, o) => sum + (o.commission ?? 0), 0),
      });
      const requests = groupOrders(inBucket);
      requests.forEach((group, idx) =>
        out.push({ kind: 'order', orders: group, first: idx === 0, last: idx === requests.length - 1 })
      );
    }
    return out;
  }, [shown]);

  const totalRevenue = shown.reduce((sum, o) => sum + (o.commission ?? 0), 0);

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
              onPress={() => {
                setStatus(f.key);
                setCancelBy('all');
              }}
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

      {/* Who called it off — the first question about any cancelled job. */}
      {status === 'cancelled' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsScroll}
        >
          {CANCEL_FILTERS.map((f) => {
            const active = cancelBy === f.key;
            const n = f.key === 'all' ? orders.length : orders.filter((o) => whoCancelled(o) === f.key).length;
            return (
              <Pressable
                key={f.key}
                onPress={() => setCancelBy(f.key)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? t.danger : t.dangerSoft },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? '#FFFFFF' : t.danger }]}>
                  {f.label} · {n}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.totalsRow}>
        <View style={[styles.totalCard, { backgroundColor: t.primarySoft }]}>
          <Ionicons name="cart" size={20} color={t.primary} />
          <Text style={[styles.totalLabel, { color: t.primary }]}>Buyurtmalar</Text>
          <Text style={[styles.totalValue, { color: t.primary }]}>{shown.length} ta</Text>
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
          keyExtractor={(it) => (it.kind === 'header' ? `h:${it.bucket}` : it.orders[0].id)}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text style={[styles.groupHeader, { color: t.textMuted }]}>
                {bucketTitle(item.bucket).toUpperCase()}  ·  {item.count} TA
                {item.revenue > 0 ? `  ·  +${formatSom(item.revenue)}` : ''}
              </Text>
            ) : (
              item.orders.length > 1 ? (
                <BatchCard orders={item.orders} first={item.first} last={item.last} />
              ) : (
                <OrderCard order={item.orders[0]} first={item.first} last={item.last} />
              )
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
      case 'rejected':
      case 'expired': return { bg: t.dangerSoft, fg: t.danger };
      default: return { bg: t.warningSoft, fg: t.warning };
    }
  })();
  const cancelledBy = whoCancelled(order);

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
    // The whole card opens the order — where it can be cancelled, handed to
    // another worker or closed. Calls and the map keep their own taps.
    <Pressable
      onPress={() => router.push(`/(admin)/order/${order.id}` as any)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? t.surfaceMuted : t.surface },
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
            {cancelledBy ? CANCELLED_BY_LABEL[cancelledBy] : STATUS_LABELS[order.status] ?? order.status}
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
    </Pressable>
  );
}

/**
 * One request for several workers: how many of them came, and each place.
 *
 * "I need four workers" goes out as four orders, and as four unrelated cards
 * the office could not tell that a customer had been sent two people out of
 * four — the thing they are ringing about.
 */
function BatchCard({ orders, first, last }: { orders: AdminOrder[]; first: boolean; last: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const head = orders[0];
  const { found, searching, total } = groupProgress(orders);
  const customer = head.customer_name || head.customer_phone || '—';

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
          {head.category_name || head.description || 'Buyurtma'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: t.primarySoft }]}>
          <Text style={[styles.statusText, { color: t.primary }]}>{total} ta ishchi</Text>
        </View>
      </View>

      <Text style={[styles.batchProgress, { color: found === total ? t.success : t.text }]}>
        {total} tadan {found} tasi topildi
        {searching > 0 ? ` · ${searching} tasi qidirilmoqda` : ''}
      </Text>

      {/* One segment per place, in the order of the rows below. */}
      <View style={styles.segments}>
        {orders.map((o) => {
          const c =
            ['accepted', 'in_progress', 'completed'].includes(o.status)
              ? t.success
              : ['pending', 'matching', 'invited'].includes(o.status)
                ? t.warning
                : t.danger;
          return <View key={o.id} style={[styles.segment, { backgroundColor: c }]} />;
        })}
      </View>

      <View style={styles.line}>
        <Ionicons name="person-outline" size={14} color={t.textMuted} />
        <Text style={[styles.lineText, { color: t.textSecondary }]} numberOfLines={1}>
          {customer}
          {head.customer_phone ? ` · ${head.customer_phone}` : ''}
        </Text>
      </View>

      <Pressable style={styles.line} onPress={() => setOpen(!open)} hitSlop={6}>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={t.primary} />
        <Text style={[styles.lineText, { color: t.primary }]}>
          {open ? 'Yopish' : "Har bir ishchini ko'rish"}
        </Text>
      </Pressable>

      {open ? (
        <View style={[styles.slots, { borderColor: t.borderLight }]}>
          {orders.map((o, i) => {
            const by = whoCancelled(o);
            return (
              <Pressable
                key={o.id}
                style={styles.slotRow}
                onPress={() => router.push(`/(admin)/order/${o.id}` as any)}
              >
                <Text style={[styles.slotIndex, { color: t.textMuted }]}>{i + 1}.</Text>
                <Text style={[styles.lineText, { color: t.textSecondary }]} numberOfLines={1}>
                  {o.worker_name || 'Hech kim'}
                  {o.worker_phone ? ` · ${o.worker_phone}` : ''}
                </Text>
                <Text style={[styles.slotStatus, { color: t.textMuted }]} numberOfLines={1}>
                  {by ? CANCELLED_BY_LABEL[by] : STATUS_LABELS[o.status] ?? o.status}
                </Text>
                <Ionicons name="chevron-forward" size={13} color={t.textMuted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: t.textMuted }]}>
          {new Date(head.created_at).toLocaleString()}
        </Text>
        <Text style={[styles.price, { color: t.text }]}>{formatSom(head.price)} so‘m · har biriga</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  batchProgress: { fontSize: 15, fontWeight: '600' },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  slots: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, gap: 6 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotIndex: { width: 18, fontSize: 13 },
  slotStatus: { fontSize: 12, maxWidth: 140 },
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

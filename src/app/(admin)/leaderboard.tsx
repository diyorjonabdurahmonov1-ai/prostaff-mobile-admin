import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { Text } from '@/components/text';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { whoCancelled } from '@/lib/orders';
import { lastDays } from '@/lib/quality';
import type { AdminOrder, User } from '@/lib/types';

/**
 * Who to thank and who to talk to.
 *
 * Three rankings over the same workers: the busiest (jobs finished), the best
 * rated (with enough ratings to mean something), and the ones who drop jobs
 * they took. Each row opens the worker's account.
 */

type Board = 'busy' | 'rated' | 'drops';
const BOARDS: { key: Board; label: string }[] = [
  { key: 'busy', label: 'Eng faol' },
  { key: 'rated', label: 'Reyting' },
  { key: 'drops', label: "Ko'p bekor qilgan" },
];

type Span = 30 | 90 | 0;
const SPANS: { key: Span; label: string }[] = [
  { key: 30, label: '30 kun' },
  { key: 90, label: '90 kun' },
  { key: 0, label: 'Hammasi' },
];

/** Fewer ratings than this and an average is luck, not a reputation. */
const MIN_RATINGS = 3;
const TOP = 20;

interface Row {
  userId: string;
  name: string;
  phone?: string;
  rating: number;
  ratings: number;
  finished: number;
  taken: number;
  dropped: number;
  online: boolean;
}

export default function LeaderboardScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const [board, setBoard] = useState<Board>('busy');
  const [span, setSpan] = useState<Span>(30);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, o] = await Promise.all([
        api.get<User[]>('/admin/users').catch(() => [] as User[]),
        api.get<AdminOrder[]>('/admin/orders?period=year').catch(() => [] as AdminOrder[]),
      ]);
      setUsers(u ?? []);
      setOrders(o ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const inSpan = span ? lastDays(orders, span) : orders;
    // Orders carry the worker's user id; the profile carries the rating.
    const byUser = new Map<string, Row>();
    for (const u of users) {
      const wp = u.worker_profile;
      if (!wp) continue;
      byUser.set(u.id, {
        userId: u.id,
        name: wp.full_name || u.name || u.phone,
        phone: wp.phone || u.phone,
        rating: wp.rating,
        ratings: wp.ratings_count,
        finished: 0,
        taken: 0,
        dropped: 0,
        online: wp.online,
      });
    }
    for (const o of inSpan) {
      if (o.company_id || !o.worker_id) continue;
      const row = byUser.get(o.worker_id);
      if (!row) continue;
      const dropped = whoCancelled(o) === 'worker';
      if (dropped || ['accepted', 'in_progress', 'completed'].includes(o.status)) row.taken += 1;
      if (dropped) row.dropped += 1;
      if (o.status === 'completed') row.finished += 1;
    }
    const all = [...byUser.values()];
    if (board === 'busy') return all.filter((r) => r.finished > 0).sort((a, b) => b.finished - a.finished || b.rating - a.rating);
    if (board === 'rated')
      return all.filter((r) => r.ratings >= MIN_RATINGS).sort((a, b) => b.rating - a.rating || b.ratings - a.ratings);
    return all.filter((r) => r.dropped > 0).sort((a, b) => b.dropped - a.dropped || b.dropped / b.taken - a.dropped / a.taken);
  }, [users, orders, board, span]);

  const medal = (i: number) => (i === 0 ? '#F5B301' : i === 1 ? '#A7AFBA' : i === 2 ? '#C9824A' : null);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.primary} />
        }
      >
        <BackLink />
        <Text style={[styles.largeTitle, { color: t.text }]}>Ishchilar reytingi</Text>

        <View style={[styles.segmented, { backgroundColor: t.surfaceMuted }]}>
          {BOARDS.map((b) => (
            <Pressable
              key={b.key}
              onPress={() => setBoard(b.key)}
              style={[styles.segBtn, board === b.key && { backgroundColor: t.surface }]}
            >
              <Text style={[styles.segText, { color: board === b.key ? t.text : t.textMuted }]} numberOfLines={1}>
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* The rating is a lifetime average, so the span only applies to counts. */}
        {board !== 'rated' ? (
          <View style={styles.spans}>
            {SPANS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setSpan(s.key)}
                style={[styles.chip, { backgroundColor: span === s.key ? t.primary : t.surfaceMuted }]}
              >
                <Text style={[styles.chipText, { color: span === s.key ? '#FFFFFF' : t.textMuted }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[styles.hint, { color: t.textMuted }]}>
            Kamida {MIN_RATINGS} ta baho olgan ishchilar, butun davr bo'yicha.
          </Text>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={t.primary} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={40} color={t.textMuted} />
            <Text style={[styles.emptyText, { color: t.textMuted }]}>
              {board === 'drops' ? "Bu davrda ishni bekor qilgan ishchi yo'q" : "Bu davrda ma'lumot yo'q"}
            </Text>
          </View>
        ) : (
          <View style={[styles.list, { backgroundColor: t.surface }]}>
            {rows.slice(0, TOP).map((r, i) => {
              const m = board === 'drops' ? null : medal(i);
              return (
                <Pressable
                  key={r.userId}
                  onPress={() => router.push(`/(admin)/user/${r.userId}` as any)}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borderLight },
                    pressed && { backgroundColor: t.surfaceMuted },
                  ]}
                >
                  <View style={[styles.place, { backgroundColor: m ?? (board === 'drops' ? t.dangerSoft : t.surfaceMuted) }]}>
                    <Text style={[styles.placeText, { color: m ? '#FFFFFF' : board === 'drops' ? t.danger : t.textMuted }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <View style={styles.rowText}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{r.name}</Text>
                      {r.online ? <View style={[styles.dot, { backgroundColor: t.success }]} /> : null}
                    </View>
                    <Text style={[styles.meta, { color: t.textMuted }]} numberOfLines={1}>
                      ★ {r.rating.toFixed(1)} ({r.ratings}) · {r.finished} ta bajarilgan · {r.taken} ta olingan
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.value,
                      { color: board === 'drops' ? t.danger : board === 'rated' ? t.warning : t.success },
                    ]}
                  >
                    {board === 'busy'
                      ? `${r.finished}`
                      : board === 'rated'
                        ? `★ ${r.rating.toFixed(1)}`
                        : `${r.dropped} · ${Math.round((r.dropped / Math.max(1, r.taken)) * 100)}%`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  largeTitle: { fontSize: 30, fontWeight: '700' },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center', paddingHorizontal: 4 },
  segText: { fontSize: 13, fontWeight: '600' },
  spans: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  chipText: { fontSize: 13, fontWeight: '500' },
  hint: { fontSize: 13 },
  list: { borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  place: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  placeText: { fontSize: 13, fontWeight: '700' },
  rowText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  meta: { fontSize: 12 },
  value: { fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, marginTop: 24 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});

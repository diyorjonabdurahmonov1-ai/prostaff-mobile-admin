import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { hasPin, MAX_PINS, staticMapUrl, yandexMapsUrl, type Pin } from '@/lib/static-map';
import type { CompanyProfile, User } from '@/lib/types';

/**
 * Who is online right now, and where.
 *
 * Workers are placed where their phone last reported (the mobile app reports
 * every minute while they are online). A firm has its office, and — when it
 * goes out to customers and has live location on — where its phone is now;
 * both are shown, in different colours, so neither is mistaken for the other.
 *
 * Only online providers are here: an offline one gets no orders, and its last
 * known position is history, not the map the office needs.
 */

type Filter = 'all' | 'workers' | 'firms';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'workers', label: 'Ishchilar' },
  { key: 'firms', label: 'Firmalar' },
];

/** How often the map refreshes itself while it is on screen. */
const REFRESH_MS = 30_000;

interface Entry {
  key: string;
  kind: 'worker' | 'office' | 'live';
  name: string;
  phone?: string;
  lat: number;
  lng: number;
  /** Whose page a tap opens. */
  userId: string;
  note?: string;
}

function minutesAgo(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null;
}

export default function LiveMapScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [firms, setFirms] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stamp, setStamp] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([
        api.get<User[]>('/admin/users').catch(() => [] as User[]),
        api.get<CompanyProfile[]>('/admin/companies').catch(() => [] as CompanyProfile[]),
      ]);
      setUsers(u ?? []);
      setFirms(c ?? []);
      setStamp(Date.now());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Live means live: re-read while the screen is open, stop when it is not.
  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, REFRESH_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  const entries = useMemo(() => {
    const out: Entry[] = [];
    if (filter !== 'firms') {
      for (const u of users) {
        const wp = u.worker_profile;
        if (!wp || !wp.online || wp.banned || !hasPin(wp.lat, wp.lng)) continue;
        out.push({
          key: `w:${wp.id}`,
          kind: 'worker',
          name: wp.full_name || u.name || u.phone,
          phone: wp.phone || u.phone,
          lat: wp.lat,
          lng: wp.lng,
          userId: u.id,
        });
      }
    }
    if (filter !== 'workers') {
      for (const c of firms) {
        if (!c.online || c.banned) continue;
        if (hasPin(c.lat, c.lng)) {
          out.push({
            key: `o:${c.id}`,
            kind: 'office',
            name: c.name,
            phone: c.phone,
            lat: c.lat!,
            lng: c.lng!,
            userId: c.user_id,
            note: c.address,
          });
        }
        if (c.live_location && hasPin(c.live_lat, c.live_lng)) {
          const ago = minutesAgo(c.live_updated_at);
          out.push({
            key: `l:${c.id}`,
            kind: 'live',
            name: c.name,
            phone: c.phone,
            lat: c.live_lat!,
            lng: c.live_lng!,
            userId: c.user_id,
            note: ago === null ? 'Jonli joylashuv' : ago === 0 ? 'Hozirgina yangilandi' : `${ago} daqiqa oldin yangilandi`,
          });
        }
      }
    }
    return out;
  }, [users, firms, filter]);

  const pins: Pin[] = entries.map((e, i) => ({
    lat: e.lat,
    lng: e.lng,
    color: e.kind === 'worker' ? 'gn' : e.kind === 'office' ? 'bl' : 'or',
    label: i + 1,
  }));

  const counts = {
    workers: entries.filter((e) => e.kind === 'worker').length,
    firms: new Set(entries.filter((e) => e.kind !== 'worker').map((e) => e.userId)).size,
    live: entries.filter((e) => e.kind === 'live').length,
  };

  const mapWidth = Math.min(width - 32, 650);
  const mapHeight = Math.round((mapWidth * 450) / 650);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <View style={styles.titleRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={t.primary} />
        </Pressable>
        <Text style={[styles.largeTitle, { color: t.text }]}>Jonli xarita</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={t.primary}
          />
        }
      >
        <View style={[styles.segmented, { backgroundColor: t.surfaceMuted }]}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.segBtn, filter === f.key && { backgroundColor: t.surface }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.segText, { color: filter === f.key ? t.text : t.textMuted }]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.counts}>
          <Count value={counts.workers} label="ishchi onlayn" color={t.success} />
          <Count value={counts.firms} label="firma onlayn" color={t.primary} />
          <Count value={counts.live} label="jonli joylashuv" color={t.warning} />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={t.primary} />
        ) : (
          <>
            {/* The map: tap for the same pins in Yandex Maps. */}
            <Pressable
              onPress={() => Linking.openURL(yandexMapsUrl(pins)).catch(() => {})}
              style={[styles.mapFrame, { backgroundColor: t.surfaceMuted, width: mapWidth, height: mapHeight }]}
            >
              <Image
                // The stamp changes the URL on every refresh, so a cached image
                // never shows yesterday's pins.
                source={{ uri: `${staticMapUrl(pins, mapWidth, mapHeight)}&_=${stamp}` }}
                style={{ width: mapWidth, height: mapHeight }}
                contentFit="cover"
                transition={150}
              />
              <View style={[styles.openPill, { backgroundColor: t.surface }]}>
                <Ionicons name="open-outline" size={14} color={t.primary} />
                <Text style={[styles.openText, { color: t.primary }]}>Yandex Xaritada ochish</Text>
              </View>
            </Pressable>

            <View style={styles.legend}>
              <Legend color="#2DB400" label="Ishchi" />
              <Legend color="#1E98FF" label="Firma ofisi" />
              <Legend color="#FF8C00" label="Firma hozir shu yerda" />
            </View>
            {entries.length > MAX_PINS ? (
              <Text style={[styles.hint, { color: t.textMuted }]}>
                Xaritada birinchi {MAX_PINS} tasi ko'rsatilgan; ro'yxatda hammasi.
              </Text>
            ) : null}

            {entries.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="location-outline" size={40} color={t.textMuted} />
                <Text style={[styles.emptyText, { color: t.textMuted }]}>Hozir hech kim onlayn emas</Text>
              </View>
            ) : (
              <View style={[styles.list, { backgroundColor: t.surface }]}>
                {entries.map((e, i) => (
                  <Pressable
                    key={e.key}
                    onPress={() => router.push(`/(admin)/user/${e.userId}` as any)}
                    style={({ pressed }) => [
                      styles.row,
                      i < entries.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.borderLight },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <View
                      style={[
                        styles.pinBadge,
                        { backgroundColor: e.kind === 'worker' ? t.success : e.kind === 'office' ? t.primary : t.warning },
                      ]}
                    >
                      <Text style={styles.pinText}>{i + 1}</Text>
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowName, { color: t.text }]} numberOfLines={1}>{e.name}</Text>
                      <Text style={[styles.rowMeta, { color: t.textMuted }]} numberOfLines={1}>
                        {e.kind === 'worker' ? 'Ishchi' : e.kind === 'office' ? 'Firma ofisi' : 'Firma · hozir'}
                        {e.note ? ` · ${e.note}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        Linking.openURL(`https://yandex.uz/maps/?pt=${e.lng},${e.lat}&z=16&l=map`).catch(() => {})
                      }
                    >
                      <Ionicons name="map-outline" size={20} color={t.primary} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Count({ value, label, color }: { value: number; label: string; color: string }) {
  const t = useTheme();
  return (
    <View style={[styles.count, { backgroundColor: t.surface }]}>
      <Text style={[styles.countValue, { color }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  largeTitle: { fontSize: 30, fontWeight: '700' },
  scroll: { padding: 16, gap: 12 },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  segText: { fontSize: 13, fontWeight: '600' },
  counts: { flexDirection: 'row', gap: 8 },
  count: { flex: 1, borderRadius: 10, padding: 10, gap: 2 },
  countValue: { fontSize: 22, fontWeight: '700' },
  countLabel: { fontSize: 12 },
  mapFrame: { borderRadius: 12, overflow: 'hidden', alignSelf: 'center' },
  openPill: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  openText: { fontSize: 13, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
  hint: { fontSize: 12 },
  list: { borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  pinBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pinText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12 },
  empty: { alignItems: 'center', gap: 10, marginTop: 24 },
  emptyText: { fontSize: 15 },
});

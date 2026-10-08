import { PhotoCircle } from '@/components/ui/photo';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { isBanned, isOnline, ROLE_LABELS } from '@/lib/roles';
import type { Role, User } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Who to show. A person can hold several roles, so each filter asks "has". */
type RoleFilter = 'all' | Role;
const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'worker', label: 'Ishchilar' },
  { key: 'company', label: 'Firmalar' },
  { key: 'customer', label: 'Buyurtmachilar' },
  { key: 'admin', label: 'Adminlar' },
];

export default function UsersScreen() {
  const t = useTheme();
  const router = useRouter();
  const bottomInset = useTabContentInset();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<RoleFilter>('all');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [onlyBanned, setOnlyBanned] = useState(false);

  /**
   * The search narrows by name or phone on the server; these narrow the
   * result here. "Which workers are online", "who is banned" were questions
   * the list could not answer without opening every account.
   */
  const shown = useMemo(
    () =>
      users.filter(
        (u) =>
          (role === 'all' || u.roles.includes(role)) &&
          (!onlyOnline || isOnline(u)) &&
          (!onlyBanned || isBanned(u)),
      ),
    [users, role, onlyOnline, onlyBanned],
  );
  const countFor = (r: RoleFilter) => (r === 'all' ? users.length : users.filter((u) => u.roles.includes(r)).length);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await api.get<User[]>(`/admin/users?query=${encodeURIComponent(q)}`);
      setUsers(res ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 400);
    return () => clearTimeout(timer);
  }, [query, search]);

  const roleBadge = (role: string) => {
    switch (role) {
      case 'admin': return { bg: t.dangerSoft, fg: t.danger };
      case 'worker': return { bg: t.primarySoft, fg: t.primary };
      case 'company': return { bg: t.warningSoft, fg: t.warning };
      default: return { bg: t.surfaceMuted, fg: t.textMuted };
    }
  };

  const renderItem = ({ item, index }: { item: User; index: number }) => (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? t.surfaceMuted : t.surface },
        index === 0 && styles.firstRow,
        index === shown.length - 1 && styles.lastRow,
      ]}
      onPress={() => router.push(`/(admin)/user/${item.id}` as any)}
    >
      {/* A provider's own photo wins over the account avatar — that is the
          picture customers are shown, so it is the one worth reviewing. */}
      <PhotoCircle
        uri={item.worker_profile?.avatar_url || item.company_profile?.avatar_url || item.avatar_url}
        size={40}
        fallback={
          <View style={[styles.avatar, { backgroundColor: t.primarySoft }]}>
            <Text style={[styles.avatarText, { color: t.primary }]}>
              {(item.name || item.phone)?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        }
      />

      <View style={styles.rowContent}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
          {item.name || 'Ismsiz'}
        </Text>
        <View style={styles.subRow}>
          {item.worker_profile || item.company_profile ? (
            <View style={[styles.dot, { backgroundColor: isOnline(item) ? t.success : t.textMuted }]} />
          ) : null}
          <Text style={[styles.phone, { color: t.textMuted }]}>{item.phone}</Text>
          {isBanned(item) ? <Text style={[styles.banned, { color: t.danger }]}>· Bloklangan</Text> : null}
        </View>
      </View>

      <View style={styles.badges}>
        {item.roles.map((role) => {
          const c = roleBadge(role);
          return (
            <View key={role} style={[styles.badge, { backgroundColor: c.bg }]}>
              <Text style={[styles.badgeText, { color: c.fg }]}>{ROLE_LABELS[role as Role] ?? role}</Text>
            </View>
          );
        })}
      </View>

      <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
    </Pressable>
  );

  const separator = () => (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.borderLight, marginLeft: 68 }} />
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await search(query);
    } finally {
      setRefreshing(false);
    }
  }, [query, search]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <Text style={[styles.largeTitle, { color: t.text }]}>Foydalanuvchilar</Text>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: t.surfaceMuted }]}>
          <Ionicons name="search" size={18} color={t.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: t.text }]}
            placeholder="Ism yoki telefon..."
            placeholderTextColor={t.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={t.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        {ROLE_FILTERS.map((f) => {
          const active = role === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setRole(f.key)}
              style={[styles.chip, { backgroundColor: active ? t.primary : t.surfaceMuted }]}
            >
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : t.textMuted }]}>
                {f.label} · {countFor(f.key)}
              </Text>
            </Pressable>
          );
        })}
        <View style={[styles.chipDivider, { backgroundColor: t.borderLight }]} />
        <Pressable
          onPress={() => setOnlyOnline(!onlyOnline)}
          style={[styles.chip, { backgroundColor: onlyOnline ? t.success : t.successSoft }]}
        >
          <Text style={[styles.chipText, { color: onlyOnline ? '#FFFFFF' : t.success }]}>Onlayn</Text>
        </Pressable>
        <Pressable
          onPress={() => setOnlyBanned(!onlyBanned)}
          style={[styles.chip, { backgroundColor: onlyBanned ? t.danger : t.dangerSoft }]}
        >
          <Text style={[styles.chipText, { color: onlyBanned ? '#FFFFFF' : t.danger }]}>Bloklangan</Text>
        </Pressable>
      </ScrollView>

      {loading && users.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
      ) : shown.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={48} color={t.textMuted} />
          <Text style={[styles.emptyText, { color: t.textMuted }]}>Foydalanuvchilar topilmadi</Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          ItemSeparatorComponent={separator}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.primary}
              colors={[t.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  largeTitle: { fontSize: 34, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, height: 36, gap: 6 },
  searchInput: { flex: 1, fontSize: 17, height: 36 },
  list: { marginHorizontal: 16, borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  firstRow: { borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  lastRow: { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '600' },
  rowContent: { flex: 1 },
  name: { fontSize: 17 },
  phone: { fontSize: 13 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  banned: { fontSize: 13, fontWeight: '600' },
  chipsScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12, alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipDivider: { width: 1, height: 20 },
  badges: { flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', marginTop: 64, gap: 12 },
  emptyText: { fontSize: 17 },
});

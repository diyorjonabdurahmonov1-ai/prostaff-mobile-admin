import { PhotoCircle } from '@/components/ui/photo';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UsersScreen() {
  const t = useTheme();
  const router = useRouter();
  const bottomInset = useTabContentInset();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

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
        index === users.length - 1 && styles.lastRow,
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
        <Text style={[styles.phone, { color: t.textMuted }]}>{item.phone}</Text>
      </View>

      <View style={styles.badges}>
        {item.roles.map((role) => {
          const c = roleBadge(role);
          return (
            <View key={role} style={[styles.badge, { backgroundColor: c.bg }]}>
              <Text style={[styles.badgeText, { color: c.fg }]}>{role}</Text>
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

      {loading && users.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
      ) : users.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={48} color={t.textMuted} />
          <Text style={[styles.emptyText, { color: t.textMuted }]}>Foydalanuvchilar topilmadi</Text>
        </View>
      ) : (
        <FlatList
          data={users}
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
  phone: { fontSize: 13, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', marginTop: 64, gap: 12 },
  emptyText: { fontSize: 17 },
});

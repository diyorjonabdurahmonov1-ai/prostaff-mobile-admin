import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhotoCircle } from '@/components/ui/photo';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { CompanyProfile } from '@/lib/types';

export default function CompaniesScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get<CompanyProfile[]>('/admin/companies');
      setCompanies(res ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleBan = async (c: CompanyProfile) => {
    const action = c.banned ? 'unban' : 'ban';
    try {
      await api.post(`/admin/companies/${c.id}/${action}`);
      load(true);
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    }
  };

  const renderItem = ({ item, index }: { item: CompanyProfile; index: number }) => (
    <View
      style={[
        styles.row,
        { backgroundColor: t.surface },
        index === 0 && styles.firstRow,
        index === companies.length - 1 && styles.lastRow,
      ]}
    >
      {/* The firm's logo, or the generic tile when it has not uploaded one. */}
      <PhotoCircle
        uri={item.avatar_url}
        size={40}
        radius={10}
        fallback={
          <View style={[styles.avatar, { backgroundColor: t.warningSoft }]}>
            <Ionicons name="business" size={18} color={t.warning} />
          </View>
        }
      />

      <View style={styles.rowContent}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{item.name}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.dot, { backgroundColor: item.online ? t.success : t.textMuted }]} />
          <Text style={[styles.meta, { color: t.textMuted }]}>
            {item.online ? 'Online' : 'Offline'}
          </Text>
          {/* A firm pays by the month, so the days it has left is the first
              thing worth knowing about it — a lapsed one takes no orders at
              all, whatever its online dot says. */}
          <Text
            style={[
              styles.meta,
              { color: item.subscription_active ? t.textMuted : t.danger },
            ]}>
            {item.subscription_active
              ? `· Obuna ${item.subscription_days_left} kun`
              : item.subscription_until
                ? '· Obuna tugagan'
                : `· Bepul ${Math.max(item.free_orders_limit - item.free_orders_used, 0)}`}
          </Text>
          {item.banned && (
            <View style={[styles.bannedTag, { backgroundColor: t.dangerSoft }]}>
              <Text style={[styles.bannedText, { color: t.danger }]}>Banlangan</Text>
            </View>
          )}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.actionBtn,
          {
            backgroundColor: item.banned ? t.successSoft : t.dangerSoft,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        onPress={() => toggleBan(item)}
      >
        <Text style={[styles.actionText, { color: item.banned ? t.success : t.danger }]}>
          {item.banned ? 'Ochish' : 'Ban'}
        </Text>
      </Pressable>
    </View>
  );

  const separator = () => (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.borderLight, marginLeft: 68 }} />
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <Text style={[styles.largeTitle, { color: t.text }]}>Kompaniyalar</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
      ) : companies.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="business-outline" size={48} color={t.textMuted} />
          <Text style={[styles.emptyText, { color: t.textMuted }]}>Kompaniyalar yo'q</Text>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          ItemSeparatorComponent={separator}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={t.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  largeTitle: { fontSize: 34, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  list: { marginHorizontal: 16, borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  firstRow: { borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  lastRow: { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  avatar: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  name: { fontSize: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meta: { fontSize: 13 },
  bannedTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  bannedText: { fontSize: 11, fontWeight: '600' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', marginTop: 64, gap: 12 },
  emptyText: { fontSize: 17 },
});

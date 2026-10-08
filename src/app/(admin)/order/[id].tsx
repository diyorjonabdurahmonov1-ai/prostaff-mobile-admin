import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/text';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatSom } from '@/lib/format';
import { hasPin, yandexPinUrl } from '@/lib/map-links';
import { cachedOrder, rememberOrders } from '@/lib/order-cache';
import { CANCELLED_BY_LABEL, STATUS_LABELS, whoCancelled } from '@/lib/orders';
import type { AdminOrder, User } from '@/lib/types';

/**
 * One order, and what the office can do about it.
 *
 * The order log could only be read. When a customer rang to say nobody came,
 * or a job sat "accepted" for a week because nobody tapped "Ish tugadi", there
 * was nothing in the admin app to do about it. Here the office can cancel the
 * order (with a reason), hand it to a worker it picked, send it back out to
 * everyone, or close it as done.
 *
 * Every action asks first and says plainly when the server does not support
 * it yet, rather than failing silently.
 */

const SEARCHING = ['pending', 'matching', 'invited'];
const HELD = ['accepted', 'in_progress'];
const CLOSED = ['cancelled', 'rejected', 'expired'];

const CANCEL_REASONS = [
  'Mijoz iltimosi bilan',
  'Ishchi kelmadi',
  "Soxta yoki noto'g'ri buyurtma",
  'Ikki marta berilgan',
];

/** Kilometres between two points — to list the nearest workers first. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** What the server said, or a plain sentence when the route does not exist yet. */
function failure(err: unknown): string {
  if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
    return "Server bu amalni hali qo'llab-quvvatlamaydi. Dasturchiga ayting.";
  }
  return err instanceof Error && err.message ? err.message : "Bajarib bo'lmadi";
}

export default function OrderScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<AdminOrder | undefined>(() => (id ? cachedOrder(id) : undefined));
  const [loading, setLoading] = useState(!order);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const fresh = await api.get<AdminOrder>(`/admin/orders/${id}`);
      if (fresh) setOrder(fresh);
    } catch {
      // No single-order route on this server. Opened from the list, the
      // list's copy stands; opened cold (a reload, a link), find it in the log.
      if (!cachedOrder(id)) {
        const all = await api.get<AdminOrder[]>('/admin/orders?period=year').catch(() => [] as AdminOrder[]);
        rememberOrders(all ?? []);
        const found = cachedOrder(id);
        if (found) setOrder(found);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string, body: unknown, done: string) => {
    if (!order) return;
    setBusy(true);
    try {
      const updated = await api.post<AdminOrder>(`/admin/orders/${order.id}/${path}`, body);
      if (updated && typeof updated === 'object' && 'status' in updated) setOrder({ ...order, ...updated });
      await load();
      Alert.alert('Bajarildi', done);
    } catch (err) {
      Alert.alert('Xatolik', failure(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !order) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
        <ActivityIndicator style={{ marginTop: 64 }} color={t.primary} />
      </SafeAreaView>
    );
  }
  if (!order) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
        <Header onBack={() => router.back()} title="Buyurtma" />
        <Text style={[styles.empty, { color: t.textMuted }]}>Buyurtma topilmadi</Text>
      </SafeAreaView>
    );
  }

  const by = whoCancelled(order);
  const searching = SEARCHING.includes(order.status);
  const held = HELD.includes(order.status);
  const closed = CLOSED.includes(order.status);
  const isFirm = !!order.company_id;
  const taker = order.worker_name || order.company_name;

  const tone = held
    ? [t.primarySoft, t.primary]
    : order.status === 'completed'
      ? [t.successSoft, t.success]
      : closed
        ? [t.dangerSoft, t.danger]
        : [t.warningSoft, t.warning];

  const confirmComplete = () =>
    Alert.alert('Tugallangan deb belgilansinmi?', "Buyurtma yopiladi va ishchi bo'shaydi. Mijoz bahosiz qoladi.", [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Belgilash', onPress: () => act('complete', {}, 'Buyurtma tugallangan deb belgilandi.') },
    ]);

  const confirmDispatch = () =>
    Alert.alert('Qayta qidirilsinmi?', 'Buyurtma yaqin atrofdagi barcha ishchilarga qayta yuboriladi.', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Qidirish', onPress: () => act('dispatch', {}, 'Buyurtma qayta qidiruvga yuborildi.') },
    ]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <Header onBack={() => router.back()} title="Buyurtma" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}>
        {/* What it is and where it stands. */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
              {order.category_name || order.description || 'Buyurtma'}
            </Text>
            <View style={[styles.badge, { backgroundColor: tone[0] }]}>
              <Text style={[styles.badgeText, { color: tone[1] }]}>
                {by ? CANCELLED_BY_LABEL[by] : STATUS_LABELS[order.status] ?? order.status}
              </Text>
            </View>
          </View>
          {order.description && order.category_name ? (
            <Text style={[styles.desc, { color: t.textSecondary }]}>{order.description}</Text>
          ) : null}
          <Text style={[styles.price, { color: t.text }]}>
            {formatSom(order.price)} so‘m
            {order.commission > 0 ? (
              <Text style={[styles.commission, { color: t.success }]}>  · komissiya {formatSom(order.commission)}</Text>
            ) : null}
          </Text>
        </View>

        {/* Who — both numbers one tap away. */}
        <Text style={[styles.caption, { color: t.textMuted }]}>ISHTIROKCHILAR</Text>
        <View style={[styles.card, styles.noPad, { backgroundColor: t.surface }]}>
          <Party
            icon="person"
            label="Buyurtmachi"
            name={order.customer_name || '—'}
            phone={order.customer_phone}
          />
          <View style={[styles.divider, { backgroundColor: t.borderLight }]} />
          <Party
            icon={isFirm ? 'business' : 'hammer'}
            label={isFirm ? 'Firma' : 'Ishchi'}
            name={taker || 'Hech kim qabul qilmagan'}
            phone={order.worker_phone}
            muted={!taker}
          />
          {hasPin(order.lat, order.lng) ? (
            <>
              <View style={[styles.divider, { backgroundColor: t.borderLight }]} />
              <Pressable
                style={styles.party}
                onPress={() => Linking.openURL(yandexPinUrl(order)).catch(() => {})}
              >
                <Ionicons name="location" size={18} color={t.textMuted} />
                <View style={styles.partyText}>
                  <Text style={[styles.partyLabel, { color: t.textMuted }]}>Manzil</Text>
                  <Text style={[styles.partyName, { color: t.text }]}>
                    {order.lat.toFixed(5)}, {order.lng.toFixed(5)}
                  </Text>
                </View>
                <Ionicons name="map-outline" size={20} color={t.primary} />
              </Pressable>
            </>
          ) : null}
        </View>

        {/* When things happened. */}
        <Text style={[styles.caption, { color: t.textMuted }]}>TARIX</Text>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Step done label="Buyurtma berildi" at={order.created_at} />
          {order.responded_at ? <Step done label={isFirm ? 'Firma javob berdi' : 'Ishchi javob berdi'} at={order.responded_at} /> : null}
          <Step
            done={order.status === 'completed' || closed}
            label={by ? CANCELLED_BY_LABEL[by] : STATUS_LABELS[order.status] ?? order.status}
            last
          />
        </View>

        {/* What the office can do, by state. */}
        <Text style={[styles.caption, { color: t.textMuted }]}>AMALLAR</Text>
        <View style={styles.actions}>
          {!isFirm && (searching || closed) ? (
            <Action icon="person-add" label="Ishchiga biriktirish" tint={t.primary} onPress={() => setAssignOpen(true)} disabled={busy} />
          ) : null}
          {!isFirm && held ? (
            <Action icon="swap-horizontal" label="Boshqa ishchiga o'tkazish" tint={t.primary} onPress={() => setAssignOpen(true)} disabled={busy} />
          ) : null}
          {!isFirm && closed ? (
            <Action icon="refresh" label="Qayta qidirish" tint={t.primary} onPress={confirmDispatch} disabled={busy} />
          ) : null}
          {held ? (
            <Action icon="checkmark-done" label="Tugallangan deb belgilash" tint={t.success} onPress={confirmComplete} disabled={busy} />
          ) : null}
          {searching || held ? (
            <Action icon="close-circle" label="Bekor qilish" tint={t.danger} onPress={() => setCancelOpen(true)} disabled={busy} />
          ) : null}
          {order.status === 'completed' ? (
            <Text style={[styles.note, { color: t.textMuted }]}>Buyurtma tugallangan, amal kerak emas.</Text>
          ) : null}
        </View>
        {busy ? <ActivityIndicator color={t.primary} /> : null}
      </ScrollView>

      {/* Cancel with a reason — the reason goes to the order's record. */}
      <Modal visible={cancelOpen} transparent animationType="slide" onRequestClose={() => setCancelOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setCancelOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: t.background }]}>
          <Text style={[styles.sheetTitle, { color: t.text }]}>Buyurtmani bekor qilish</Text>
          <Text style={[styles.note, { color: t.textMuted }]}>Sababini tanlang yoki yozing. Mijoz va ishchiga xabar boradi.</Text>
          <View style={styles.reasons}>
            {CANCEL_REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                style={[styles.reason, { backgroundColor: reason === r ? t.dangerSoft : t.surface }]}
              >
                <Text style={{ color: reason === r ? t.danger : t.text }}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Boshqa sabab"
            placeholderTextColor={t.textMuted}
            style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
          />
          <Pressable
            disabled={!reason.trim() || busy}
            onPress={async () => {
              setCancelOpen(false);
              await act('cancel', { reason: reason.trim() }, 'Buyurtma bekor qilindi.');
              setReason('');
            }}
            style={[styles.sheetBtn, { backgroundColor: t.danger, opacity: reason.trim() ? 1 : 0.45 }]}
          >
            <Text style={styles.sheetBtnText}>Bekor qilish</Text>
          </Pressable>
          <Pressable onPress={() => setCancelOpen(false)} style={[styles.sheetBtn, { backgroundColor: t.surfaceMuted }]}>
            <Text style={[styles.sheetBtnText, { color: t.text }]}>Yopish</Text>
          </Pressable>
        </View>
      </Modal>

      <AssignSheet
        open={assignOpen}
        order={order}
        onClose={() => setAssignOpen(false)}
        onPick={(u) => {
          setAssignOpen(false);
          Alert.alert(
            `${u.worker_profile?.full_name || u.name} ga biriktirilsinmi?`,
            'Buyurtma shu ishchiga beriladi va unga xabar boradi.',
            [
              { text: 'Bekor qilish', style: 'cancel' },
              {
                text: 'Biriktirish',
                onPress: () => act('assign', { worker_id: u.id }, 'Buyurtma ishchiga biriktirildi.'),
              },
            ],
          );
        }}
      />
    </SafeAreaView>
  );
}

/** Online workers, nearest to the job first, to hand the order to by name. */
function AssignSheet({
  open,
  order,
  onClose,
  onPick,
}: {
  open: boolean;
  order: AdminOrder;
  onClose: () => void;
  onPick: (u: User) => void;
}) {
  const t = useTheme();
  const [users, setUsers] = useState<User[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || users) return;
    api
      .get<User[]>('/admin/users')
      .then((u) => setUsers(u ?? []))
      .catch(() => setUsers([]));
  }, [open, users]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => {
        const wp = u.worker_profile;
        if (!wp || wp.banned || u.id === order.worker_id) return false;
        if (q) return (wp.full_name || '').toLowerCase().includes(q) || (wp.phone || u.phone).includes(q);
        return wp.online;
      })
      .map((u) => ({
        u,
        km: hasPin(order.lat, order.lng) && hasPin(u.worker_profile!.lat, u.worker_profile!.lng)
          ? km(order, u.worker_profile!)
          : null,
      }))
      .sort((a, b) => (a.km ?? 9999) - (b.km ?? 9999))
      .slice(0, 30);
  }, [users, query, order]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, styles.tallSheet, { backgroundColor: t.background }]}>
        <Text style={[styles.sheetTitle, { color: t.text }]}>Ishchini tanlang</Text>
        <Text style={[styles.note, { color: t.textMuted }]}>
          Onlayn ishchilar, buyurtmaga eng yaqini birinchi. Oflayn ishchini ism yoki telefon bilan qidiring.
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ism yoki telefon"
          placeholderTextColor={t.textMuted}
          style={[styles.input, { backgroundColor: t.surface, color: t.text }]}
        />
        {users === null ? (
          <ActivityIndicator color={t.primary} />
        ) : (
          <ScrollView style={[styles.pickList, { backgroundColor: t.surface }]}>
            {candidates.length === 0 ? (
              <Text style={[styles.empty, { color: t.textMuted }]}>Mos ishchi topilmadi</Text>
            ) : (
              candidates.map(({ u, km: d }, i) => (
                <Pressable
                  key={u.id}
                  onPress={() => onPick(u)}
                  style={({ pressed }) => [
                    styles.party,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borderLight },
                    pressed && { backgroundColor: t.surfaceMuted },
                  ]}
                >
                  <View style={[styles.onlineDot, { backgroundColor: u.worker_profile!.online ? t.success : t.textMuted }]} />
                  <View style={styles.partyText}>
                    <Text style={[styles.partyName, { color: t.text }]}>{u.worker_profile!.full_name || u.name}</Text>
                    <Text style={[styles.partyLabel, { color: t.textMuted }]}>
                      ★ {u.worker_profile!.rating.toFixed(1)} · {u.worker_profile!.phone || u.phone}
                    </Text>
                  </View>
                  {d !== null ? <Text style={[styles.partyLabel, { color: t.textMuted }]}>{d.toFixed(1)} km</Text> : null}
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
        <Pressable onPress={onClose} style={[styles.sheetBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[styles.sheetBtnText, { color: t.text }]}>Yopish</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.headerBack}>
        <Ionicons name="chevron-back" size={24} color={t.primary} />
        <Text style={{ color: t.primary, fontSize: 17 }}>Orqaga</Text>
      </Pressable>
      <Text style={[styles.headerTitle, { color: t.text }]}>{title}</Text>
      <View style={styles.headerBack} />
    </View>
  );
}

function Party({
  icon,
  label,
  name,
  phone,
  muted,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  name: string;
  phone?: string;
  muted?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.party}>
      <Ionicons name={icon} size={18} color={t.textMuted} />
      <View style={styles.partyText}>
        <Text style={[styles.partyLabel, { color: t.textMuted }]}>{label}</Text>
        <Text style={[styles.partyName, { color: muted ? t.textMuted : t.text }]}>{name}</Text>
        {phone ? <Text style={[styles.partyLabel, { color: t.textSecondary }]}>{phone}</Text> : null}
      </View>
      {phone ? (
        <Pressable
          hitSlop={8}
          onPress={() => Linking.openURL(`tel:${phone}`).catch(() => {})}
          style={[styles.call, { backgroundColor: t.successSoft }]}
        >
          <Ionicons name="call" size={18} color={t.success} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Step({ label, at, done, last }: { label: string; at?: string; done: boolean; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View style={[styles.stepDot, { backgroundColor: done ? t.primary : t.borderLight }]} />
        {last ? null : <View style={[styles.stepLine, { backgroundColor: t.borderLight }]} />}
      </View>
      <View style={styles.stepText}>
        <Text style={[styles.partyName, { color: t.text }]}>{label}</Text>
        {at ? <Text style={[styles.partyLabel, { color: t.textMuted }]}>{new Date(at).toLocaleString()}</Text> : null}
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  tint,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  tint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, { backgroundColor: t.surface, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.actionText, { color: tint }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  headerBack: { flexDirection: 'row', alignItems: 'center', minWidth: 90 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  scroll: { padding: 16, gap: 8 },
  card: { borderRadius: 12, padding: 14, gap: 8 },
  noPad: { padding: 0, gap: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 15 },
  price: { fontSize: 17, fontWeight: '700' },
  commission: { fontSize: 14, fontWeight: '500' },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginLeft: 4, marginTop: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 44 },
  party: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  partyText: { flex: 1, gap: 1 },
  partyLabel: { fontSize: 12 },
  partyName: { fontSize: 15, fontWeight: '600' },
  call: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 12 },
  stepDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  stepLine: { width: 2, flex: 1, minHeight: 18 },
  stepText: { flex: 1, paddingBottom: 10 },
  actions: { gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  actionText: { flex: 1, fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13 },
  empty: { textAlign: 'center', padding: 24, fontSize: 15 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { padding: 16, gap: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32 },
  tallSheet: { maxHeight: '80%' },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reason: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  sheetBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  pickList: { borderRadius: 10, maxHeight: 360 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
});

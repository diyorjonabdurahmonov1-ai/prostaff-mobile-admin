import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import type { Settings } from '@/lib/types';
import { BackLink } from '@/components/back-link';
import { SecurityCard } from '@/components/security-card';

export default function SettingsScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const { signOut, user } = useAuth();
  const [commission, setCommission] = useState('');
  const [minBalance, setMinBalance] = useState('');
  // How many jobs a brand-new provider gets for nothing, and how much notice a
  // firm gets before its subscription lapses.
  //
  // What a firm *pays* is not here: that is a tariff card, and tariffs live on
  // their own tab with the history of who bought them. A monthly rate sitting
  // in Sozlamalar next to a set of cards priced per term was two answers to one
  // question, and only the cards were ever charged.
  const [freeOrders, setFreeOrders] = useState('');
  const [warnDays, setWarnDays] = useState('');
  // Who an order rings: how far away a worker may be, and how many are rung
  // at a time, nearest first. Empty until the server sends them — an older
  // server has neither, and then the section is not shown at all.
  const [radius, setRadius] = useState('');
  const [waveSize, setWaveSize] = useState('');
  const [hasDispatch, setHasDispatch] = useState(false);
  // How long a customer waits before calling another worker, and the oldest
  // app version still let in, with where "update" leads. Newer servers only.
  const [noShow, setNoShow] = useState('');
  const [hasNoShow, setHasNoShow] = useState(false);
  const [minVersion, setMinVersion] = useState('');
  const [androidUrl, setAndroidUrl] = useState('');
  const [iosUrl, setIosUrl] = useState('');
  const [hasVersion, setHasVersion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Read from /admin/settings, not /admin/finance: the finance overview
      // carries the commission only, so every other field here used to render
      // blank and then be saved as blank.
      const res = await api.get<Settings>('/admin/settings');
      setCommission(res.commission_percent?.toString() ?? '');
      setMinBalance(res.min_balance?.toString() ?? '');
      setFreeOrders(res.free_order_limit?.toString() ?? '');
      setWarnDays(res.subscription_warn_days?.toString() ?? '');
      setRadius(res.match_radius_km?.toString() ?? '');
      setWaveSize(res.dispatch_wave_size?.toString() ?? '');
      setHasDispatch(res.match_radius_km != null);
      setNoShow(res.no_show_minutes?.toString() ?? '');
      setHasNoShow(res.no_show_minutes != null);
      setMinVersion(res.min_app_version ?? '');
      setAndroidUrl(res.android_store_url ?? '');
      setIosUrl(res.ios_store_url ?? '');
      setHasVersion(res.min_app_version != null);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, number | string> = {};
      if (commission) body.commission_percent = parseFloat(commission);
      if (minBalance) body.min_balance = parseFloat(minBalance);
      // Zero is a real value for both ("no free jobs", "no notice"), so they are
      // sent whenever the field has anything in it at all.
      if (freeOrders !== '') body.free_order_limit = parseInt(freeOrders, 10);
      if (warnDays !== '') body.subscription_warn_days = parseInt(warnDays, 10);
      if (hasDispatch) {
        const km = parseInt(radius, 10);
        const wave = parseInt(waveSize, 10);
        if (!(km >= 1 && km <= 200)) {
          Alert.alert('Xatolik', "Radius 1 dan 200 km gacha bo'lishi kerak.");
          return;
        }
        if (!(wave >= 0 && wave <= 50)) {
          Alert.alert('Xatolik', "Bir martada chaqiriladigan ishchilar soni 0 dan 50 gacha bo'lishi kerak.");
          return;
        }
        body.match_radius_km = km;
        body.dispatch_wave_size = wave;
      }
      if (hasNoShow) {
        const minutes = parseInt(noShow, 10);
        if (!(minutes >= 5 && minutes <= 240)) {
          Alert.alert('Xatolik', "Kutish vaqti 5 dan 240 daqiqagacha bo'lishi kerak.");
          return;
        }
        body.no_show_minutes = minutes;
      }
      if (hasVersion) {
        const version = minVersion.trim();
        if (version !== '' && !/^\d+(\.\d+){0,3}$/.test(version)) {
          Alert.alert('Xatolik', "Versiya 1.2.0 ko'rinishida bo'lishi kerak.");
          return;
        }
        for (const link of [androidUrl.trim(), iosUrl.trim()]) {
          if (link !== '' && !link.startsWith('https://')) {
            Alert.alert('Xatolik', "Havola https:// bilan boshlanishi kerak.");
            return;
          }
        }
        body.min_app_version = version;
        body.android_store_url = androidUrl.trim();
        body.ios_store_url = iosUrl.trim();
      }
      await api.patch('/admin/settings', body);
      Alert.alert('Muvaffaqiyat', 'Sozlamalar saqlandi');
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Chiqish', 'Haqiqatan chiqmoqchimisiz?', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Chiqish', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <KeyboardAwareScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}>
        <BackLink />
        <Text style={[styles.largeTitle, { color: t.text }]}>Sozlamalar</Text>

        <SecurityCard />

        {/* Finance settings */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>MOLIYA</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Ionicons name="calculator-outline" size={20} color={t.primary} />
              <Text style={[styles.fieldLabel, { color: t.text }]}>Komissiya (%)</Text>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
              value={commission}
              onChangeText={setCommission}
              keyboardType="decimal-pad"
              placeholder="10"
              placeholderTextColor={t.textMuted}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: t.borderLight }]} />

          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Ionicons name="wallet-outline" size={20} color={t.primary} />
              <Text style={[styles.fieldLabel, { color: t.text }]}>Min. balans (so'm)</Text>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
              value={minBalance}
              onChangeText={setMinBalance}
              keyboardType="decimal-pad"
              placeholder="10000"
              placeholderTextColor={t.textMuted}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: t.borderLight }]} />

          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Ionicons name="gift-outline" size={20} color={t.primary} />
              <Text style={[styles.fieldLabel, { color: t.text }]}>Bepul ishlar soni</Text>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
              value={freeOrders}
              onChangeText={setFreeOrders}
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor={t.textMuted}
            />
            <Text style={[styles.hint, { color: t.textMuted }]}>
              Yangi ishchi passport seriyasi, firma esa INN bo&apos;yicha shuncha ishni bepul qabul qila oladi.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={t.onPrimary} />
            ) : (
              <Text style={[styles.saveBtnText, { color: t.onPrimary }]}>Saqlash</Text>
            )}
          </Pressable>
        </View>

        {/* What a firm pays lives on the Tariflar tab. What is left here is the
            one timing rule: how much warning it gets before the months run out. */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>FIRMA OBUNASI</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Ionicons name="alarm-outline" size={20} color={t.primary} />
              <Text style={[styles.fieldLabel, { color: t.text }]}>Ogohlantirish (kun)</Text>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
              value={warnDays}
              onChangeText={setWarnDays}
              keyboardType="number-pad"
              placeholder="7"
              placeholderTextColor={t.textMuted}
            />
            <Text style={[styles.hint, { color: t.textMuted }]}>
              Obuna tugashiga shuncha kun qolganda firmaga xabar yuboriladi.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={t.onPrimary} />
            ) : (
              <Text style={[styles.saveBtnText, { color: t.onPrimary }]}>Saqlash</Text>
            )}
          </Pressable>
        </View>

        {hasDispatch ? (
          <>
            <Text style={[styles.sectionHeader, { color: t.textMuted }]}>BUYURTMA TARQATISH</Text>
            <View style={[styles.section, { backgroundColor: t.surface }]}>
              <View style={styles.field}>
                <View style={styles.fieldRow}>
                  <Ionicons name="locate-outline" size={20} color={t.primary} />
                  <Text style={[styles.fieldLabel, { color: t.text }]}>Qidiruv radiusi (km)</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
                  value={radius}
                  onChangeText={setRadius}
                  keyboardType="number-pad"
                  placeholder="15"
                  placeholderTextColor={t.textMuted}
                />
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  Buyurtma manzilidan shu masofagacha bo&apos;lgan ishchilarga yuboriladi.
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: t.borderLight }]} />

              <View style={styles.field}>
                <View style={styles.fieldRow}>
                  <Ionicons name="people-outline" size={20} color={t.primary} />
                  <Text style={[styles.fieldLabel, { color: t.text }]}>Bir martada nechta ishchi</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
                  value={waveSize}
                  onChangeText={setWaveSize}
                  keyboardType="number-pad"
                  placeholder="3"
                  placeholderTextColor={t.textMuted}
                />
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  Avval eng yaqin shuncha ishchiga boradi; 12 soniyada hech kim olmasa, keyingi eng yaqinlarga.
                  0 — radiusdagi hammaga birdan.
                </Text>
              </View>

              {hasNoShow ? (
                <>
              <View style={[styles.divider, { backgroundColor: t.borderLight }]} />

              <View style={styles.field}>
                <View style={styles.fieldRow}>
                  <Ionicons name="time-outline" size={20} color={t.primary} />
                  <Text style={[styles.fieldLabel, { color: t.text }]}>Ishchini kutish vaqti (daqiqa)</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
                  value={noShow}
                  onChangeText={setNoShow}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={t.textMuted}
                />
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  Ishchi qabul qilgandan shuncha daqiqa o&apos;tib ham yetib kelmasa, mijoz boshqa ishchi chaqira oladi.
                </Text>
              </View>

                </>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 }]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={t.onPrimary} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: t.onPrimary }]}>Saqlash</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : null}

        {hasVersion ? (
          <>
            <Text style={[styles.sectionHeader, { color: t.textMuted }]}>ILOVA VERSIYASI</Text>
            <View style={[styles.section, { backgroundColor: t.surface }]}>
              <View style={styles.field}>
                <View style={styles.fieldRow}>
                  <Ionicons name="phone-portrait-outline" size={20} color={t.primary} />
                  <Text style={[styles.fieldLabel, { color: t.text }]}>Eng past ruxsat etilgan versiya</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
                  value={minVersion}
                  onChangeText={setMinVersion}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="masalan 1.2.0"
                  placeholderTextColor={t.textMuted}
                />
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  Bundan eski ilova ochilmaydi va &quot;Ilovani yangilang&quot; oynasi chiqadi. Bo&apos;sh qoldirsangiz —
                  cheklov yo&apos;q. Ehtiyot bo&apos;ling: do&apos;konda hali yo&apos;q versiyani yozsangiz, hamma
                  foydalanuvchi ilovaga kira olmay qoladi.
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: t.borderLight }]} />

              <View style={styles.field}>
                <View style={styles.fieldRow}>
                  <Ionicons name="logo-google-playstore" size={20} color={t.primary} />
                  <Text style={[styles.fieldLabel, { color: t.text }]}>Google Play havolasi</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
                  value={androidUrl}
                  onChangeText={setAndroidUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://play.google.com/store/apps/details?id=..."
                  placeholderTextColor={t.textMuted}
                />
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  &quot;Yangilash&quot; tugmasi Android telefonda shu havolani ochadi.
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: t.borderLight }]} />

              <View style={styles.field}>
                <View style={styles.fieldRow}>
                  <Ionicons name="logo-apple" size={20} color={t.primary} />
                  <Text style={[styles.fieldLabel, { color: t.text }]}>App Store havolasi</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
                  value={iosUrl}
                  onChangeText={setIosUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://apps.apple.com/app/..."
                  placeholderTextColor={t.textMuted}
                />
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  &quot;Yangilash&quot; tugmasi iPhone&apos;da shu havolani ochadi.
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 }]}
                onPress={save}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={t.onPrimary} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: t.onPrimary }]}>Saqlash</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Account info */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>HISOB</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={20} color={t.textMuted} />
            <Text style={[styles.infoLabel, { color: t.textMuted }]}>Admin</Text>
            <Text style={[styles.infoValue, { color: t.text }]}>{user?.name || user?.phone || '—'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: t.borderLight }]} />
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={t.textMuted} />
            <Text style={[styles.infoLabel, { color: t.textMuted }]}>Telefon</Text>
            <Text style={[styles.infoValue, { color: t.text }]}>{user?.phone || '—'}</Text>
          </View>
        </View>

        {/* Sign out */}
        <Pressable
          style={({ pressed }) => [styles.signOutBtn, { backgroundColor: t.surface, opacity: pressed ? 0.7 : 1 }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={t.danger} />
          <Text style={[styles.signOutText, { color: t.danger }]}>Chiqish</Text>
        </Pressable>

        <Text style={[styles.version, { color: t.textMuted }]}>PROSTAFF Admin v1.0</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16 },
  largeTitle: { fontSize: 34, fontWeight: '700', marginBottom: 20 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 16 },
  section: { borderRadius: 10, padding: 16, marginBottom: 24 },
  field: { gap: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel: { fontSize: 17 },
  input: { height: 44, borderRadius: 8, paddingHorizontal: 14, fontSize: 17 },
  hint: { fontSize: 13, lineHeight: 18 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  planInfo: { flex: 1, gap: 2 },
  planTitle: { fontSize: 17 },
  planDelete: { padding: 2 },
  planForm: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  planInput: { flex: 1 },
  planInputWide: { flex: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  saveBtn: { height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 17, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  infoLabel: { fontSize: 15, width: 70 },
  infoValue: { fontSize: 15, flex: 1, textAlign: 'right' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, padding: 14, marginBottom: 24 },
  signOutText: { fontSize: 17, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 13 },
});

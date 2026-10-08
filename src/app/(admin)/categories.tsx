import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/text';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { BackLink } from '@/components/back-link';

/**
 * The service list.
 *
 * Every order names one of these and every worker claims a few, which makes it
 * the one table the platform is indexed by — and until now the one table only a
 * deploy could change. Seven rows were compiled into the server; the office
 * learning that nobody searches for "Ko'k tushuruvchi" could do nothing about it.
 *
 * Two things about the screen follow from what a category is attached to:
 *
 *   - Renaming is free. The id is what an order stores, so a corrected name
 *     shows up on every record that already used it, including last year's.
 *   - Deleting is not. A category with orders or providers behind it can only
 *     be switched off: retiring keeps the name on those records and takes the
 *     row off every picker, which is what "we stopped doing that" means. Only an
 *     unused row — the typo from two minutes ago — is deleted outright, and the
 *     server decides that, not this screen.
 */
export default function CategoriesScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  /** null = closed, 'new' = create, otherwise the category being edited. */
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  /**
   * The row whose "⋯" is open.
   *
   * Editing and deleting are one tap apart and one of them cannot be undone, so
   * they do not sit next to each other on a crowded row where a thumb decides
   * which. The menu names both, in words, before either happens.
   */
  const [menuFor, setMenuFor] = useState<Category | null>(null);

  const [nameUz, setNameUz] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await api.get<Category[]>('/admin/categories');
      setCategories(list ?? []);
    } catch { /* keep whatever is on screen */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (c: Category | 'new') => {
    const existing = c === 'new' ? null : c;
    setNameUz(existing?.name_uz ?? '');
    setNameRu(existing?.name_ru ?? '');
    setNameEn(existing?.name_en ?? '');
    setError(null);
    setEditing(c);
  };

  const submit = async () => {
    if (!nameUz.trim()) {
      setError('Majburiy maydon — kategoriya nomini kiriting');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Russian and English are left to the server to fill from the Uzbek name
      // when they are blank: a chip with no text is worse than one in the wrong
      // language, and the office rarely types all three.
      const body = {
        name_uz: nameUz.trim(),
        name_ru: nameRu.trim(),
        name_en: nameEn.trim(),
      };
      if (editing && editing !== 'new') await api.patch(`/admin/categories/${editing.id}`, body);
      else await api.post('/admin/categories', body);
      setEditing(null);
      load(true);
    } catch (e: any) {
      setError(e.message || "Saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: Category) => {
    try {
      await api.patch(`/admin/categories/${c.id}`, { active: !c.active });
      load(true);
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    }
  };

  const remove = (c: Category) => {
    const used = (c.orders_count ?? 0) + (c.providers_count ?? 0) > 0;
    if (used) {
      // Said here rather than after a round trip: the counts are already on
      // screen, so there is no reason to let the operator tap through to a
      // refusal they could have been told about.
      Alert.alert(
        "O'chirib bo'lmaydi",
        `"${c.name_uz}" ${c.orders_count ?? 0} ta buyurtma va ${c.providers_count ?? 0} ta ijrochida ishlatilmoqda. ` +
          "Uni o'chirsak, o'sha yozuvlarda xizmat nomi yo'qoladi. O'rniga faolsizlantiring — " +
          "eski yozuvlarda nomi qoladi, yangi buyurtmalarda esa ko'rinmaydi.",
        [{ text: 'Tushunarli' }],
      );
      return;
    }
    Alert.alert(
      "Kategoriyani o'chirish",
      `"${c.name_uz}" o'chiriladi. Unga hech qanday buyurtma yoki ijrochi bog'lanmagan.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: "O'chirish",
          style: 'destructive',
          onPress: async () => {
            try {
              await api.del(`/admin/categories/${c.id}`);
              load(true);
            } catch (e: any) {
              Alert.alert('Xatolik', e.message);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
      </SafeAreaView>
    );
  }

  const activeCount = categories.filter((c) => c.active).length;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={t.primary}
          />
        }>
        {/* Adding is the reason the office opens this screen, so the button is
            at the top rather than under however many rows the list has grown
            to — the old form sat at the bottom and had to be scrolled to. */}
        <BackLink />
        <View style={styles.titleRow}>
          <Text style={[styles.largeTitle, { color: t.text }]}>Kategoriyalar</Text>
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => openForm('new')}>
            <Ionicons name="add" size={20} color={t.onPrimary} />
            <Text style={[styles.addBtnText, { color: t.onPrimary }]}>Qo&apos;shish</Text>
          </Pressable>
        </View>

        <Text style={[styles.hint, { color: t.textMuted, marginBottom: 20 }]}>
          Mijoz buyurtmani shu ro&apos;yxatdan tanlaydi, ishchi esa shularni o&apos;ziga
          biriktiradi. {activeCount} ta faol, {categories.length - activeCount} ta
          faolsizlantirilgan.
        </Text>

        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>RO&apos;YXAT</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          {categories.length === 0 ? (
            <Text style={[styles.hint, { color: t.textMuted }]}>
              Kategoriya yo&apos;q — mijoz buyurtma bera olmaydi. Yuqoridagi
              &quot;Qo&apos;shish&quot; tugmasi bilan qo&apos;shing.
            </Text>
          ) : (
            categories.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <View style={[styles.divider, { backgroundColor: t.borderLight }]} /> : null}
                <View style={styles.row}>
                  <Pressable style={styles.info} onPress={() => setMenuFor(c)}>
                    <Text style={[styles.title, { color: c.active ? t.text : t.textMuted }]}>
                      {c.name_uz}
                    </Text>
                    <Text style={[styles.hint, { color: t.textMuted }]} numberOfLines={1}>
                      {c.name_ru} · {c.name_en}
                    </Text>
                    <Text style={[styles.hint, { color: t.textMuted }]}>
                      {c.orders_count ?? 0} ta buyurtma · {c.providers_count ?? 0} ta ijrochi
                    </Text>
                  </Pressable>

                  <Switch
                    value={c.active}
                    onValueChange={() => toggle(c)}
                    trackColor={{ true: t.success }}
                  />
                  <Pressable onPress={() => setMenuFor(c)} hitSlop={10} style={styles.iconBtn}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={t.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.hint, { color: t.textMuted, paddingHorizontal: 16 }]}>
          Faolsizlantirilgan kategoriya yangi buyurtmalarda ko&apos;rinmaydi, lekin eski
          buyurtmalarda nomi saqlanib qoladi. Shuning uchun ishlatilgan kategoriyani
          o&apos;chirib bo&apos;lmaydi — faqat o&apos;chirib qo&apos;yish mumkin.
        </Text>
      </ScrollView>

      {/* What the "⋯" opens. Each action is a labelled button, so neither is
          reachable by a thumb aimed at the other. */}
      <Modal
        visible={!!menuFor}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuFor(null)}>
          <Pressable
            style={[styles.menu, { backgroundColor: t.surface }]}
            onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.menuTitle, { color: t.text }]} numberOfLines={1}>
              {menuFor?.name_uz}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => {
                const target = menuFor;
                setMenuFor(null);
                if (target) openForm(target);
              }}>
              <Ionicons name="create-outline" size={20} color={t.text} />
              <Text style={[styles.menuItemText, { color: t.text }]}>Tahrirlash</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: t.borderLight }]} />
            <Pressable
              style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => {
                const target = menuFor;
                setMenuFor(null);
                if (target) remove(target);
              }}>
              <Ionicons name="trash-outline" size={20} color={t.danger} />
              <Text style={[styles.menuItemText, { color: t.danger }]}>O&apos;chirish</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: t.borderLight }]} />
            <Pressable
              style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => setMenuFor(null)}>
              <Ionicons name="close-outline" size={20} color={t.textMuted} />
              <Text style={[styles.menuItemText, { color: t.textMuted }]}>Bekor qilish</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add and edit are the same form, opened over the list rather than
          parked at the bottom of it. */}
      <Modal
        visible={!!editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: t.surface }]}>
            <KeyboardAwareScrollView contentContainerStyle={styles.sheetBody}>
              <Text style={[styles.sheetTitle, { color: t.text }]}>
                {editing && editing !== 'new' ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
              </Text>
              <Text style={[styles.hint, { color: t.textMuted, marginBottom: 16 }]}>
                Nomni o&apos;zgartirish eski buyurtmalarga zarar qilmaydi — ular
                kategoriyaning nomini emas, o&apos;zini saqlaydi.
              </Text>

              <TextInput
                style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
                value={nameUz}
                onChangeText={(v) => { setNameUz(v); setError(null); }}
                placeholder="Nomi (o'zbekcha)"
                placeholderTextColor={t.textMuted}
                autoFocus
              />
              <TextInput
                style={[styles.input, styles.stacked, { backgroundColor: t.surfaceMuted, color: t.text }]}
                value={nameRu}
                onChangeText={setNameRu}
                placeholder="Nomi (ruscha) — ixtiyoriy"
                placeholderTextColor={t.textMuted}
              />
              <TextInput
                style={[styles.input, styles.stacked, { backgroundColor: t.surfaceMuted, color: t.text }]}
                value={nameEn}
                onChangeText={setNameEn}
                placeholder="Nomi (inglizcha) — ixtiyoriy"
                placeholderTextColor={t.textMuted}
              />

              <Text style={[styles.hint, { color: error ? t.danger : t.textMuted, marginTop: 10 }]}>
                {error ??
                  "Ruscha va inglizcha nomlar bo'sh qolsa, o'zbekchasi ishlatiladi."}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={submit}
                disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={t.onPrimary} />
                ) : (
                  <Text style={[styles.btnText, { color: t.onPrimary }]}>Saqlash</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnGhost,
                  { backgroundColor: t.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setEditing(null)}>
                <Text style={[styles.btnText, { color: t.text }]}>Bekor qilish</Text>
              </Pressable>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  largeTitle: { flex: 1, fontSize: 34, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 15, fontWeight: '600' },

  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 16 },
  section: { borderRadius: 10, padding: 16, marginBottom: 24 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 17 },
  iconBtn: { padding: 2 },
  hint: { fontSize: 13, lineHeight: 18 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },

  menu: { margin: 16, borderRadius: 14, paddingVertical: 6 },
  menuTitle: { fontSize: 13, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText: { fontSize: 17 },

  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  sheetBody: { padding: 20, paddingBottom: 32 },
  sheetTitle: { fontSize: 22, fontWeight: '700', marginBottom: 6 },

  input: { height: 44, borderRadius: 8, paddingHorizontal: 14, fontSize: 17 },
  stacked: { marginTop: 8 },

  btn: { height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  btnGhost: { marginTop: 8 },
  btnText: { fontSize: 17, fontWeight: '600' },
});

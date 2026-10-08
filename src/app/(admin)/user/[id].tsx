import { Text, TextInput } from '@/components/text';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { PhotoCircle, PhotoRow } from '@/components/ui/photo';
import { useScrollToFocused } from '@/hooks/use-keyboard-aware-scroll';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatSom } from '@/lib/format';
import type { Role, User } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ALL_ROLES: Role[] = ['customer', 'worker', 'company', 'admin'];

const ROLE_LABELS: Record<Role, string> = {
  customer: 'Buyurtmachi',
  worker: 'Ishchi',
  company: 'Firma',
  admin: 'Admin',
};

export default function UserDetailScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Basic user info
  const [name, setName] = useState('');
  const [gmail, setGmail] = useState('');
  const [active, setActive] = useState(true);
  const [creditLimit, setCreditLimit] = useState('');
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [saving, setSaving] = useState(false);

  // ───── Company Profile ─────
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compPrice, setCompPrice] = useState('50000');
  // The firm on paper: unique across the platform, and what its free orders are
  // counted under. Required — an account cannot be opened without it.
  const [compInn, setCompInn] = useState('');
  const [compOnline, setCompOnline] = useState(true);
  // Selling months to an existing firm. A firm pays for time, not per job.
  const [subMonths, setSubMonths] = useState('1');
  const [subDiscount, setSubDiscount] = useState('');
  const [extendingSub, setExtendingSub] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  // Edit mode for existing company
  const [editingCompany, setEditingCompany] = useState(false);
  const [editCompInn, setEditCompInn] = useState('');
  const [editCompName, setEditCompName] = useState('');
  const [editCompDesc, setEditCompDesc] = useState('');
  const [editCompPrice, setEditCompPrice] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // ───── Worker Profile ─────
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [workerFullName, setWorkerFullName] = useState('');
  // The worker's passport series — required, unique, and the key their three
  // free jobs hang off.
  const [workerPassport, setWorkerPassport] = useState('');
  const [workerGender, setWorkerGender] = useState<'male' | 'female'>('male');
  const [workerAge, setWorkerAge] = useState('25');
  const [workerPriceMin, setWorkerPriceMin] = useState('50000');
  const [workerPriceMax, setWorkerPriceMax] = useState('150000');
  const [workerOnline, setWorkerOnline] = useState(true);
  const [creatingWorker, setCreatingWorker] = useState(false);
  // Edit mode for existing worker
  const [editingWorker, setEditingWorker] = useState(false);
  // Editable so a worker registered before passports were collected can be
  // filled in — until they are, that worker has no trial jobs at all.
  const [editWkPassport, setEditWkPassport] = useState('');
  const [editWkName, setEditWkName] = useState('');
  const [editWkGender, setEditWkGender] = useState<'male' | 'female'>('male');
  const [editWkAge, setEditWkAge] = useState('');
  const [editWkPriceMin, setEditWkPriceMin] = useState('');
  const [editWkPriceMax, setEditWkPriceMax] = useState('');
  const [savingWorker, setSavingWorker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await api.get<User>(`/admin/users/${id}`);
      if (found) {
        setUser(found);
        setName(found.name ?? '');
        setGmail(found.gmail ?? '');
        setActive(found.active);
        setCreditLimit(found.worker_profile?.credit_limit?.toString() ?? '0');
        // Pre-fill create forms
        setCompName(found.name ?? '');
        setWorkerFullName(found.name ?? '');
        // Pre-fill edit forms
        if (found.company_profile) {
          setEditCompInn(found.company_profile.inn ?? '');
          setEditCompName(found.company_profile.name);
          setEditCompDesc(found.company_profile.description);
          setEditCompPrice((found.company_profile as any).price?.toString() ?? '50000');
        }
        if (found.worker_profile) {
          setEditWkPassport(found.worker_profile.passport_series ?? '');
          setEditWkName(found.worker_profile.full_name);
          setEditWkGender(found.worker_profile.gender === 'female' ? 'female' : 'male');
          setEditWkAge(found.worker_profile.age.toString());
          setEditWkPriceMin(found.worker_profile.price_min.toString());
          setEditWkPriceMax(found.worker_profile.price_max.toString());
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /* ───── User actions ───── */
  const saveUser = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/users/${id}`, { name, gmail, active });
      Alert.alert('Muvaffaqiyat', "Ma'lumotlar saqlandi");
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: Role, has: boolean) => {
    const apply = async () => {
      try {
        await api.post(`/admin/users/${id}/roles`, { role, action: has ? 'remove' : 'add' });
        load();
      } catch (e: any) {
        Alert.alert('Xatolik', e.message);
      }
    };
    // Adding an ordinary role is safe to do in one tap. Taking a role away
    // switches off a panel the person may be working in, and granting admin
    // hands over this whole app — both ask first.
    if (!has && role !== 'admin') {
      apply();
      return;
    }
    Alert.alert(
      has ? `«${ROLE_LABELS[role]}» roli olib tashlansinmi?` : 'Admin huquqi berilsinmi?',
      has
        ? "Foydalanuvchi bu rol bilan bog'liq paneldan foydalana olmaydi."
        : "Bu foydalanuvchi admin ilovasiga kirib, hamma narsani boshqara oladi.",
      [
        { text: 'Bekor qilish', style: 'cancel' },
        { text: has ? 'Olib tashlash' : 'Admin qilish', style: 'destructive', onPress: apply },
      ],
    );
  };

  /* ───── Company: Create ───── */
  const createCompanyApi = async () => {
    if (!user) return;
    if (!compName.trim()) {
      Alert.alert('Xatolik', 'Firma nomini kiriting');
      return;
    }
    if (compInn.length !== 9) {
      Alert.alert('Xatolik', "INN 9 ta raqamdan iborat bo'lishi kerak");
      return;
    }
    setCreatingCompany(true);
    try {
      await api.post('/admin/companies', {
        phone: user.phone,
        gmail: user.gmail || gmail || '',
        inn: compInn,
        name: compName.trim(),
        description: compDesc.trim() || 'Servis xizmatlari',
        images: [],
        price: parseInt(compPrice) || 50000,
        credit_limit: 0,
        online: compOnline,
      });
      setShowCompanyForm(false);
      Alert.alert(
        '✅ Firma yaratildi!',
        `"${compName.trim()}" firmasi muvaffaqiyatli ro'yxatdan o'tkazildi va ${compOnline ? 'ONLINE' : 'OFFLINE'} holatda.`
      );
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message || "Firma yaratib bo'lmadi");
    } finally {
      setCreatingCompany(false);
    }
  };

  /* ───── Company: Edit ───── */
  const saveCompanyEdit = async () => {
    const cp = user?.company_profile;
    if (!cp) return;
    setSavingCompany(true);
    try {
      await api.patch(`/admin/companies/${cp.id}`, {
        // Only sent when it has actually changed: the server rejects a malformed
        // or duplicate INN, and re-posting the firm's own unchanged number on
        // every edit is a needless way to hit that.
        inn: editCompInn !== (cp.inn ?? '') ? editCompInn : undefined,
        name: editCompName.trim() || undefined,
        description: editCompDesc.trim() || undefined,
        price: parseInt(editCompPrice) || undefined,
      });
      Alert.alert('Muvaffaqiyat', 'Firma profili yangilandi');
      setEditingCompany(false);
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    } finally {
      setSavingCompany(false);
    }
  };

  /* ───── Company: Subscription ─────
   *
   * A firm's account is months, not a balance: this is the only place they are
   * sold. The discount is optional — left blank, the platform's standing one
   * applies, and whatever is charged today is stored on the payment so a later
   * price change cannot rewrite it. */
  const extendSubscription = async () => {
    const cp = user?.company_profile;
    if (!cp) return;
    const months = parseInt(subMonths, 10) || 0;
    if (months <= 0) {
      Alert.alert('Xatolik', 'Oy sonini kiriting');
      return;
    }
    setExtendingSub(true);
    try {
      await api.post(`/admin/companies/${cp.id}/subscription`, {
        months,
        ...(subDiscount ? { discount_percent: parseInt(subDiscount, 10) } : {}),
      });
      Alert.alert('Muvaffaqiyat', `Obuna ${months} oyga uzaytirildi`);
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    } finally {
      setExtendingSub(false);
    }
  };

  /* ───── Free trial: give the jobs back ─────
   *
   * The counter is keyed on the passport / INN and outlives the profile on
   * purpose, so a trial spent by mistake has no way back except this. */
  const resetFreeOrders = async (role: 'worker' | 'company') => {
    try {
      await api.post(`/admin/users/${id}/free-orders`, { role, used: 0 });
      Alert.alert('Muvaffaqiyat', 'Bepul ishlar tiklandi');
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    }
  };

  /* ───── Company: Online toggle ───── */
  const toggleCompanyOnline = async (online: boolean) => {
    const cp = user?.company_profile;
    if (!cp) return;
    try {
      await api.post(`/admin/companies/${cp.id}/status`, { online });
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    }
  };

  /* ───── Worker: Create ───── */
  const createWorkerApi = async () => {
    if (!user) return;
    if (!workerFullName.trim()) {
      Alert.alert('Xatolik', 'Ishchi ismini kiriting');
      return;
    }
    if (!/^[A-Z]{2}\d{7}$/.test(workerPassport)) {
      Alert.alert('Xatolik', "Passport seriyasini to'g'ri kiriting. Namuna: AA1234567");
      return;
    }
    setCreatingWorker(true);
    try {
      await api.post('/admin/workers', {
        phone: user.phone,
        gmail: user.gmail || gmail || '',
        name: user.name || workerFullName.trim(),
        passport_series: workerPassport,
        full_name: workerFullName.trim(),
        gender: workerGender,
        age: parseInt(workerAge) || 25,
        price_min: parseInt(workerPriceMin) || 50000,
        price_max: parseInt(workerPriceMax) || 150000,
        lat: 41.2995,
        lng: 69.2401,
        category_ids: [],
        credit_limit: 0,
        online: workerOnline,
      });
      setShowWorkerForm(false);
      Alert.alert(
        '✅ Ishchi yaratildi!',
        `"${workerFullName.trim()}" ishchi sifatida muvaffaqiyatli ro'yxatdan o'tkazildi va ${workerOnline ? 'ONLINE' : 'OFFLINE'} holatda.`
      );
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message || "Ishchi yaratib bo'lmadi");
    } finally {
      setCreatingWorker(false);
    }
  };

  /* ───── Worker: Edit ───── */
  const saveWorkerEdit = async () => {
    const wp = user?.worker_profile;
    if (!wp) return;
    setSavingWorker(true);
    try {
      await api.patch(`/admin/workers/${wp.id}`, {
        passport_series: editWkPassport !== (wp.passport_series ?? '') ? editWkPassport : undefined,
        full_name: editWkName.trim() || undefined,
        gender: editWkGender,
        age: parseInt(editWkAge) || undefined,
        price_min: parseInt(editWkPriceMin) || undefined,
        price_max: parseInt(editWkPriceMax) || undefined,
      });
      Alert.alert('Muvaffaqiyat', 'Ishchi profili yangilandi');
      setEditingWorker(false);
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    } finally {
      setSavingWorker(false);
    }
  };

  /* ───── Worker: Online toggle ───── */
  const toggleWorkerOnline = async (online: boolean) => {
    const wp = user?.worker_profile;
    if (!wp) return;
    try {
      await api.post(`/admin/workers/${wp.id}/status`, { online });
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    }
  };

  /** Asks first — a ban takes the worker off every job feed at once. */
  const toggleBan = () => {
    const isBanned = user?.worker_profile?.banned;
    Alert.alert(
      isBanned ? 'Blokdan chiqarilsinmi?' : 'Ishchi bloklansinmi?',
      isBanned
        ? 'Ishchi yana buyurtma qabul qila oladi.'
        : "Ishchiga buyurtmalar kelmaydi va u mijozlarga ko'rinmaydi.",
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: isBanned ? 'Blokdan chiqarish' : 'Bloklash',
          style: isBanned ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await api.post(`/admin/workers/${id}/${isBanned ? 'unban' : 'ban'}`);
              load();
            } catch (e: any) {
              Alert.alert('Xatolik', e.message);
            }
          },
        },
      ],
    );
  };

  const setCreditLimitApi = async () => {
    try {
      await api.post(`/admin/workers/${id}/credit-limit`, { amount: parseFloat(creditLimit) || 0 });
      Alert.alert('Muvaffaqiyat', 'Kredit limit yangilandi');
      load();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    }
  };

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      Alert.alert('Xatolik', 'Sarlavha va matn kiriting');
      return;
    }
    try {
      await api.post(`/admin/users/${id}/push`, { title: pushTitle.trim(), body: pushBody.trim() });
      Alert.alert('Muvaffaqiyat', 'Xabar yuborildi');
      setPushTitle('');
      setPushBody('');
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
        <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
        <Text style={[styles.emptyText, { color: t.textMuted }]}>Foydalanuvchi topilmadi</Text>
      </SafeAreaView>
    );
  }

  const wp = user.worker_profile;
  const cp = user.company_profile;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={[]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={t.primary} />
          <Text style={[styles.backText, { color: t.primary }]}>Orqaga</Text>
        </Pressable>

        {/* User header card */}
        <View style={[styles.headerCard, { backgroundColor: t.surface }]}>
          <PhotoCircle
            uri={wp?.avatar_url || cp?.avatar_url || user.avatar_url}
            size={64}
            fallback={
              <View style={[styles.avatarLg, { backgroundColor: t.primarySoft }]}>
                <Text style={[styles.avatarLgText, { color: t.primary }]}>
                  {(user.name || user.phone)?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            }
          />
          <Text style={[styles.userName, { color: t.text }]}>{user.name || 'Ismsiz'}</Text>
          <Text style={[styles.userPhone, { color: t.textMuted }]}>{user.phone}</Text>
          <View style={styles.rolesRow}>
            {user.roles.map((r) => (
              <View
                key={r}
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor:
                      r === 'admin'
                        ? t.dangerSoft
                        : r === 'company'
                          ? t.warningSoft
                          : t.primarySoft,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    { color: r === 'admin' ? t.danger : r === 'company' ? t.warning : t.primary },
                  ]}
                >
                  {r}
                </Text>
              </View>
            ))}
          </View>
          {user.wallet && (
            <View style={[styles.walletRow, { backgroundColor: t.surfaceMuted }]}>
              <Ionicons name="wallet" size={16} color={t.primary} />
              <Text style={[styles.walletText, { color: t.text }]}>
                {formatSom(user.wallet.balance)} so'm
              </Text>
            </View>
          )}
        </View>

        {/* ─── What the customer sees ───
            Read-only on purpose: the provider fills this in from their own
            panel. It is here so an admin can check the profile is presentable
            before wondering why nobody books them. */}
        {wp || cp ? (
          <>
            <Text style={[styles.sectionHeader, { color: t.textMuted }]}>
              MIJOZ KO&apos;RADIGAN MA&apos;LUMOT
            </Text>
            <View style={[styles.section, { backgroundColor: t.surface }]}>
              <InfoRow
                icon="image"
                label="Profil rasmi"
                value={wp?.avatar_url || cp?.avatar_url ? 'Bor' : "Yo'q"}
                theme={t}
                danger={!(wp?.avatar_url || cp?.avatar_url)}
              />
              {wp ? (
                <>
                  <Divider color={t.borderLight} />
                  <InfoRow
                    icon="document-text"
                    label="O'zi haqida"
                    value={wp.about || '—'}
                    theme={t}
                  />
                  <Divider color={t.borderLight} />
                  <InfoRow
                    icon="ribbon"
                    label="Tajriba"
                    value={wp.experience_years ? `${wp.experience_years} yil` : '—'}
                    theme={t}
                  />
                  <Divider color={t.borderLight} />
                  <InfoRow icon="location" label="Ish hududi" value={wp.address || '—'} theme={t} />
                </>
              ) : null}
              {cp ? (
                <>
                  {/* What the firm does, in its own words — optional, so an
                      empty line is not flagged. No pin still is: it drops the
                      firm to the bottom of the customer's nearby list. */}
                  <Divider color={t.borderLight} />
                  <InfoRow
                    icon="pricetags"
                    label="Qanday ishlar qiladi"
                    value={
                      cp.services?.trim() ||
                      (cp.category_ids?.length ? `${cp.category_ids.length} ta` : '—')
                    }
                    theme={t}
                  />
                  <Divider color={t.borderLight} />
                  <InfoRow
                    icon="map"
                    label="Ofis joylashuvi"
                    value={cp.lat || cp.lng ? `${cp.lat?.toFixed(4)}, ${cp.lng?.toFixed(4)}` : '—'}
                    theme={t}
                    danger={!(cp.lat || cp.lng)}
                  />
                  <Divider color={t.borderLight} />
                  <InfoRow icon="location" label="Manzil" value={cp.address || '—'} theme={t} />
                  <Divider color={t.borderLight} />
                  <InfoRow
                    icon="time"
                    label="Ish vaqti"
                    value={cp.working_hours || '—'}
                    theme={t}
                  />
                  <Divider color={t.borderLight} />
                  <InfoRow
                    icon="people"
                    label="Xodimlar"
                    value={cp.employees_count ? String(cp.employees_count) : '—'}
                    theme={t}
                  />
                  <Divider color={t.borderLight} />
                  <InfoRow
                    icon="ribbon"
                    label="Tajriba"
                    value={cp.experience_years ? `${cp.experience_years} yil` : '—'}
                    theme={t}
                  />
                  {cp.email ? (
                    <>
                      <Divider color={t.borderLight} />
                      <InfoRow icon="mail" label="Email" value={cp.email} theme={t} />
                    </>
                  ) : null}
                  {cp.website ? (
                    <>
                      <Divider color={t.borderLight} />
                      <InfoRow icon="globe" label="Veb-sayt" value={cp.website} theme={t} />
                    </>
                  ) : null}
                </>
              ) : null}

              {/* The gallery itself, not a count of it. */}
              <PhotoRow uris={wp?.images ?? cp?.images} backgroundColor={t.surfaceMuted} />
            </View>
          </>
        ) : null}

        {/* ─── Edit user ─── */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>TAHRIRLASH</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <LabelInput label="Ism" value={name} onChangeText={setName} theme={t} />
          <Divider color={t.borderLight} />
          <LabelInput
            label="Email"
            value={gmail}
            onChangeText={setGmail}
            theme={t}
            keyboard="email-address"
          />
          <Divider color={t.borderLight} />
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: t.text }]}>Faol</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: t.success }} />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={saveUser}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Saqlash</Text>
            )}
          </Pressable>
        </View>

        {/* ─── Roles ─── */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>ROLLAR</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          {ALL_ROLES.map((role, i) => {
            const has = user.roles.includes(role);
            return (
              <View key={role}>
                {i > 0 && <Divider color={t.borderLight} />}
                <View style={styles.roleRow}>
                  <Text style={[styles.roleText, { color: t.text }]}>{ROLE_LABELS[role]}</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.roleBtn,
                      {
                        backgroundColor: has ? t.dangerSoft : t.successSoft,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => toggleRole(role, has)}
                  >
                    <Text style={[styles.roleBtnText, { color: has ? t.danger : t.success }]}>
                      {has ? 'Olib tashlash' : "Qo'shish"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* ═══════════ FIRMA PROFILI ═══════════ */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>FIRMA PROFILI</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          {cp ? (
            editingCompany ? (
              /* ── Edit company form ── */
              <View style={{ gap: 8 }}>
                <LabelInput
                  label="Firma Nomi"
                  value={editCompName}
                  onChangeText={setEditCompName}
                  theme={t}
                />
                <LabelInput
                  label="INN (9 raqam)"
                  value={editCompInn}
                  onChangeText={(v: string) => setEditCompInn(v.replace(/\D/g, '').slice(0, 9))}
                  theme={t}
                  keyboard="decimal-pad"
                />
                <LabelInput
                  label="Xizmat Narxi (so'm)"
                  value={editCompPrice}
                  onChangeText={setEditCompPrice}
                  theme={t}
                  keyboard="decimal-pad"
                />
                <LabelInput
                  label="Tavsif"
                  value={editCompDesc}
                  onChangeText={setEditCompDesc}
                  theme={t}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.btn,
                      { flex: 1, backgroundColor: t.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() => setEditingCompany(false)}
                  >
                    <Text style={[styles.btnText, { color: t.text }]}>Bekor qilish</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.btn,
                      { flex: 1, backgroundColor: t.success, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={saveCompanyEdit}
                    disabled={savingCompany}
                  >
                    {savingCompany ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Saqlash</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── Company info view ── */
              <>
                <InfoRow icon="business" label="Firma" value={cp.name} theme={t} />
                <Divider color={t.borderLight} />
                <InfoRow
                  icon="document-text"
                  label="Tavsif"
                  value={cp.description || '—'}
                  theme={t}
                />
                <Divider color={t.borderLight} />
                <InfoRow icon="card" label="INN" value={cp.inn || '—'} theme={t} />
                <Divider color={t.borderLight} />
                <InfoRow
                  icon="star"
                  label="Reyting"
                  value={`${cp.rating.toFixed(1)} (${cp.ratings_count})`}
                  theme={t}
                />
                <Divider color={t.borderLight} />
                {/* What the firm's account actually is. A lapsed subscription is
                    shown in danger colour because it is the reason the firm has
                    stopped receiving orders. */}
                <InfoRow
                  icon="calendar"
                  label="Obuna"
                  value={
                    cp.subscription_active
                      ? `${cp.subscription_days_left} kun · ${new Date(cp.subscription_until!).toLocaleDateString()}`
                      : cp.subscription_until
                        ? `Tugagan · ${new Date(cp.subscription_until).toLocaleDateString()}`
                        : 'Rasmiylashtirilmagan'
                  }
                  theme={t}
                  danger={!cp.subscription_active}
                />
                <Divider color={t.borderLight} />
                <InfoRow
                  icon="gift"
                  label="Bepul buyurtma"
                  value={`${Math.max(cp.free_orders_limit - cp.free_orders_used, 0)} / ${cp.free_orders_limit}`}
                  theme={t}
                />
                <Divider color={t.borderLight} />
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: t.text }]}>Online</Text>
                  <Switch
                    value={cp.online}
                    onValueChange={toggleCompanyOnline}
                    trackColor={{ true: t.success }}
                  />
                </View>

                {cp.banned && (
                  <View style={[styles.bannedTag, { backgroundColor: t.dangerSoft }]}>
                    <Text style={[styles.bannedText, { color: t.danger }]}>Banlangan</Text>
                  </View>
                )}

                {/* Selling months. Added to whatever is left, so a firm
                    renewing early keeps the days it has already paid for. */}
                <Divider color={t.borderLight} />
                <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Obunani uzaytirish</Text>
                <View style={styles.inlineRow}>
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, backgroundColor: t.surfaceMuted, color: t.text },
                    ]}
                    value={subMonths}
                    onChangeText={(v) => setSubMonths(v.replace(/\D/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    placeholder="Oy"
                    placeholderTextColor={t.textMuted}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, backgroundColor: t.surfaceMuted, color: t.text },
                    ]}
                    value={subDiscount}
                    onChangeText={(v) => setSubDiscount(v.replace(/\D/g, '').slice(0, 3))}
                    keyboardType="number-pad"
                    placeholder="Chegirma %"
                    placeholderTextColor={t.textMuted}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.inlineBtn,
                      { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={extendSubscription}
                    disabled={extendingSub}
                  >
                    {extendingSub ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>OK</Text>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: t.surfaceMuted, opacity: pressed ? 0.7 : 1, marginTop: 8 },
                  ]}
                  onPress={() => resetFreeOrders('company')}
                >
                  <Text style={[styles.btnText, { color: t.text }]}>
                    Bepul buyurtmalarni tiklash
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1, marginTop: 12 },
                  ]}
                  onPress={() => setEditingCompany(true)}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.btnText}>Tahrirlash</Text>
                </Pressable>
              </>
            )
          ) : (
            /* ── Create company form ── */
            <>
              {!showCompanyForm ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => setShowCompanyForm(true)}
                >
                  <Ionicons name="business" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.btnText}>Firma Profilini Yaratish</Text>
                </Pressable>
              ) : (
                <View style={{ gap: 8 }}>
                  <LabelInput
                    label="Firma Nomi"
                    value={compName}
                    onChangeText={setCompName}
                    theme={t}
                  />
                  <LabelInput
                    label="INN (9 raqam)"
                    value={compInn}
                    onChangeText={(v: string) => setCompInn(v.replace(/\D/g, '').slice(0, 9))}
                    theme={t}
                    keyboard="decimal-pad"
                  />
                  <LabelInput
                    label="Xizmat Narxi (so'm)"
                    value={compPrice}
                    onChangeText={setCompPrice}
                    theme={t}
                    keyboard="decimal-pad"
                  />
                  <LabelInput
                    label="Tavsif"
                    value={compDesc}
                    onChangeText={setCompDesc}
                    theme={t}
                  />
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: t.text }]}>Darhol Online</Text>
                    <Switch
                      value={compOnline}
                      onValueChange={setCompOnline}
                      trackColor={{ true: t.success }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.btn,
                        { flex: 1, backgroundColor: t.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => setShowCompanyForm(false)}
                    >
                      <Text style={[styles.btnText, { color: t.text }]}>Bekor qilish</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.btn,
                        { flex: 1, backgroundColor: t.success, opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={createCompanyApi}
                      disabled={creatingCompany}
                    >
                      {creatingCompany ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name="add-circle"
                            size={18}
                            color="#fff"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.btnText}>Qo'shish</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* ═══════════ ISHCHI PROFILI ═══════════ */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>ISHCHI PROFILI</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          {wp ? (
            editingWorker ? (
              /* ── Edit worker form ── */
              <View style={{ gap: 8 }}>
                <LabelInput
                  label="To'liq Ismi"
                  value={editWkName}
                  onChangeText={setEditWkName}
                  theme={t}
                />
                <LabelInput
                  label="Passport seriyasi (AA1234567)"
                  value={editWkPassport}
                  onChangeText={(v: string) =>
                    setEditWkPassport(
                      v
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 9)
                    )
                  }
                  theme={t}
                />
                <LabelInput
                  label="Yoshi"
                  value={editWkAge}
                  onChangeText={setEditWkAge}
                  theme={t}
                  keyboard="decimal-pad"
                />
                <LabelInput
                  label="Min Narx (so'm)"
                  value={editWkPriceMin}
                  onChangeText={setEditWkPriceMin}
                  theme={t}
                  keyboard="decimal-pad"
                />
                <LabelInput
                  label="Max Narx (so'm)"
                  value={editWkPriceMax}
                  onChangeText={setEditWkPriceMax}
                  theme={t}
                  keyboard="decimal-pad"
                />
                <View
                  style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginVertical: 4 }}
                >
                  <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Jinsi:</Text>
                  <Pressable
                    onPress={() => setEditWkGender('male')}
                    style={[
                      styles.roleBtn,
                      { backgroundColor: editWkGender === 'male' ? t.primarySoft : t.surfaceMuted },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBtnText,
                        { color: editWkGender === 'male' ? t.primary : t.textMuted },
                      ]}
                    >
                      Erkak
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditWkGender('female')}
                    style={[
                      styles.roleBtn,
                      {
                        backgroundColor: editWkGender === 'female' ? t.primarySoft : t.surfaceMuted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBtnText,
                        { color: editWkGender === 'female' ? t.primary : t.textMuted },
                      ]}
                    >
                      Ayol
                    </Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.btn,
                      { flex: 1, backgroundColor: t.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() => setEditingWorker(false)}
                  >
                    <Text style={[styles.btnText, { color: t.text }]}>Bekor qilish</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.btn,
                      { flex: 1, backgroundColor: t.success, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={saveWorkerEdit}
                    disabled={savingWorker}
                  >
                    {savingWorker ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Saqlash</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── Worker info view ── */
              <>
                <InfoRow icon="person" label="Ism" value={wp.full_name} theme={t} />
                <Divider color={t.borderLight} />
                <InfoRow icon="card" label="Passport" value={wp.passport_series || '—'} theme={t} />
                <Divider color={t.borderLight} />
                <InfoRow
                  icon="gift"
                  label="Bepul ish"
                  value={`${Math.max(wp.free_orders_limit - wp.free_orders_used, 0)} / ${wp.free_orders_limit}`}
                  theme={t}
                />
                <Divider color={t.borderLight} />
                <InfoRow
                  icon="star"
                  label="Reyting"
                  value={`${wp.rating.toFixed(1)} (${wp.ratings_count})`}
                  theme={t}
                />
                <Divider color={t.borderLight} />
                <InfoRow
                  icon="cash"
                  label="Narx"
                  value={`${formatSom(wp.price_min)} – ${formatSom(wp.price_max)}`}
                  theme={t}
                />
                <Divider color={t.borderLight} />
                <InfoRow
                  icon="shield"
                  label="Ban"
                  value={wp.banned ? 'Banlangan' : 'Faol'}
                  theme={t}
                  danger={wp.banned}
                />
                <Divider color={t.borderLight} />
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: t.text }]}>Online</Text>
                  <Switch
                    value={wp.online}
                    onValueChange={toggleWorkerOnline}
                    trackColor={{ true: t.success }}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      backgroundColor: wp.banned ? t.success : t.danger,
                      opacity: pressed ? 0.7 : 1,
                      marginTop: 12,
                    },
                  ]}
                  onPress={toggleBan}
                >
                  <Text style={styles.btnText}>{wp.banned ? 'Banni ochish' : 'Banlash'}</Text>
                </Pressable>

                {/* The trial counter survives a profile being deleted, so this
                    is the only way back from a free job spent by mistake. */}
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: t.surfaceMuted, opacity: pressed ? 0.7 : 1, marginTop: 8 },
                  ]}
                  onPress={() => resetFreeOrders('worker')}
                >
                  <Text style={[styles.btnText, { color: t.text }]}>Bepul ishlarni tiklash</Text>
                </Pressable>

                <Divider color={t.borderLight} />
                <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Kredit limit</Text>
                <View style={styles.inlineRow}>
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, backgroundColor: t.surfaceMuted, color: t.text },
                    ]}
                    value={creditLimit}
                    onChangeText={setCreditLimit}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={t.textMuted}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.inlineBtn,
                      { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={setCreditLimitApi}
                  >
                    <Text style={styles.btnText}>OK</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1, marginTop: 12 },
                  ]}
                  onPress={() => setEditingWorker(true)}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.btnText}>Tahrirlash</Text>
                </Pressable>
              </>
            )
          ) : (
            /* ── Create worker form ── */
            <>
              {!showWorkerForm ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => setShowWorkerForm(true)}
                >
                  <Ionicons name="construct" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.btnText}>Ishchi Profilini Yaratish</Text>
                </Pressable>
              ) : (
                <View style={{ gap: 8 }}>
                  <LabelInput
                    label="To'liq Ismi"
                    value={workerFullName}
                    onChangeText={setWorkerFullName}
                    theme={t}
                  />
                  <LabelInput
                    label="Passport seriyasi (AA1234567)"
                    value={workerPassport}
                    onChangeText={(v: string) =>
                      setWorkerPassport(
                        v
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, '')
                          .slice(0, 9)
                      )
                    }
                    theme={t}
                  />
                  <LabelInput
                    label="Yoshi"
                    value={workerAge}
                    onChangeText={setWorkerAge}
                    theme={t}
                    keyboard="decimal-pad"
                  />
                  <LabelInput
                    label="Min Narx (so'm)"
                    value={workerPriceMin}
                    onChangeText={setWorkerPriceMin}
                    theme={t}
                    keyboard="decimal-pad"
                  />
                  <LabelInput
                    label="Max Narx (so'm)"
                    value={workerPriceMax}
                    onChangeText={setWorkerPriceMax}
                    theme={t}
                    keyboard="decimal-pad"
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      alignItems: 'center',
                      marginVertical: 4,
                    }}
                  >
                    <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Jinsi:</Text>
                    <Pressable
                      onPress={() => setWorkerGender('male')}
                      style={[
                        styles.roleBtn,
                        {
                          backgroundColor: workerGender === 'male' ? t.primarySoft : t.surfaceMuted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBtnText,
                          { color: workerGender === 'male' ? t.primary : t.textMuted },
                        ]}
                      >
                        Erkak
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setWorkerGender('female')}
                      style={[
                        styles.roleBtn,
                        {
                          backgroundColor:
                            workerGender === 'female' ? t.primarySoft : t.surfaceMuted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBtnText,
                          { color: workerGender === 'female' ? t.primary : t.textMuted },
                        ]}
                      >
                        Ayol
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: t.text }]}>Darhol Online</Text>
                    <Switch
                      value={workerOnline}
                      onValueChange={setWorkerOnline}
                      trackColor={{ true: t.success }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.btn,
                        { flex: 1, backgroundColor: t.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => setShowWorkerForm(false)}
                    >
                      <Text style={[styles.btnText, { color: t.text }]}>Bekor qilish</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.btn,
                        { flex: 1, backgroundColor: t.success, opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={createWorkerApi}
                      disabled={creatingWorker}
                    >
                      {creatingWorker ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name="add-circle"
                            size={18}
                            color="#fff"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.btnText}>Qo'shish</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* ─── Push ─── */}
        <Text style={[styles.sectionHeader, { color: t.textMuted }]}>PUSH XABAR</Text>
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <TextInput
            style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
            value={pushTitle}
            onChangeText={setPushTitle}
            placeholder="Sarlavha"
            placeholderTextColor={t.textMuted}
          />
          <TextInput
            style={[
              styles.input,
              styles.multiline,
              { backgroundColor: t.surfaceMuted, color: t.text },
            ]}
            value={pushBody}
            onChangeText={setPushBody}
            placeholder="Xabar matni"
            placeholderTextColor={t.textMuted}
            multiline
            numberOfLines={3}
          />
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={sendPush}
          >
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.btnText}> Yuborish</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

/* ──── Helpers ──── */

function LabelInput({
  label,
  value,
  onChangeText,
  theme: t,
  keyboard,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: any;
  keyboard?: 'email-address' | 'decimal-pad';
}) {
  // Moving between fields fires no keyboard event, so the field asks the scroll
  // view to reveal it — otherwise it stays behind the keyboard.
  const scrollToFocused = useScrollToFocused();
  return (
    <View style={styles.labelField}>
      <Text style={[styles.fieldLabel, { color: t.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
        value={value}
        onChangeText={onChangeText}
        onFocus={scrollToFocused}
        placeholder={label}
        placeholderTextColor={t.textMuted}
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  theme: t,
  danger,
}: {
  icon: string;
  label: string;
  value: string;
  theme: any;
  danger?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={danger ? t.danger : t.textMuted} />
      <Text style={[styles.infoLabel, { color: t.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: danger ? t.danger : t.text }]}>{value}</Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <View
      style={{ height: StyleSheet.hairlineWidth, backgroundColor: color, marginVertical: 10 }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16 },
  emptyText: { fontSize: 17, textAlign: 'center', marginTop: 48 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  backText: { fontSize: 17 },

  headerCard: { borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 24, gap: 6 },
  avatarLg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarLgText: { fontSize: 26, fontWeight: '600' },
  userName: { fontSize: 22, fontWeight: '600' },
  userPhone: { fontSize: 15 },
  rolesRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  roleBadgeText: { fontSize: 12, fontWeight: '600' },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  walletText: { fontSize: 15, fontWeight: '600' },

  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 16 },
  section: { borderRadius: 10, padding: 16, marginBottom: 24, gap: 4 },

  labelField: { gap: 4 },
  fieldLabel: { fontSize: 13, marginBottom: 2 },
  input: { height: 44, borderRadius: 8, paddingHorizontal: 14, fontSize: 17 },
  multiline: { height: 80, paddingTop: 12, textAlignVertical: 'top' },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 17 },

  btn: {
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },

  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  roleText: { fontSize: 17 },
  roleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  roleBtnText: { fontSize: 13, fontWeight: '600' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  infoLabel: { fontSize: 15, width: 70 },
  infoValue: { fontSize: 15, flex: 1, textAlign: 'right', fontWeight: '500' },

  inlineRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  inlineBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bannedTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  bannedText: { fontSize: 13, fontWeight: '600' },
});

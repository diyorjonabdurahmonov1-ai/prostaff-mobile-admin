import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { Text, TextInput } from '@/components/text';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { isBanned, isOnline } from '@/lib/roles';
import type { User } from '@/lib/types';

/**
 * One message to many people.
 *
 * Push used to go one account at a time, from that account's page. "Tomorrow
 * is a holiday, be online" had no way to reach the workers short of opening
 * every one of them.
 *
 * The server's broadcast endpoint is used when it exists. Without it the same
 * message is sent account by account through the existing per-user push, so
 * the screen works today — slower, with a progress count.
 */

type Audience = 'workers' | 'companies' | 'customers' | 'all';
const AUDIENCES: { key: Audience; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'workers', label: 'Ishchilar', icon: 'hammer' },
  { key: 'companies', label: 'Firmalar', icon: 'business' },
  { key: 'customers', label: 'Buyurtmachilar', icon: 'person' },
  { key: 'all', label: 'Hammasi', icon: 'people' },
];

const TITLE_MAX = 60;
const BODY_MAX = 300;
/** Per-user fallback: how many sends run at once. */
const PARALLEL = 5;

function inAudience(u: User, a: Audience): boolean {
  if (!u.active) return false;
  if (a === 'workers') return !!u.worker_profile;
  if (a === 'companies') return !!u.company_profile;
  if (a === 'customers') return u.roles.includes('customer') && !u.roles.includes('admin');
  return !u.roles.includes('admin');
}

export default function BroadcastScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const [audience, setAudience] = useState<Audience>('workers');
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; failed: number; total: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers((await api.get<User[]>('/admin/users')) ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** "Online" only means something for people who can be online. */
  const onlineApplies = audience === 'workers' || audience === 'companies';
  const recipients = useMemo(
    () =>
      users.filter(
        (u) => inAudience(u, audience) && !isBanned(u) && (!onlineApplies || !onlyOnline || isOnline(u)),
      ),
    [users, audience, onlyOnline, onlineApplies],
  );

  const ready = title.trim().length > 0 && body.trim().length > 0 && recipients.length > 0 && !sending;

  const send = async () => {
    setSending(true);
    setProgress(null);
    const payload = { title: title.trim(), body: body.trim() };
    try {
      try {
        await api.post('/admin/push/broadcast', {
          ...payload,
          audience,
          only_online: onlineApplies && onlyOnline,
        });
        Alert.alert('Yuborildi', `Xabar ${recipients.length} kishiga yuborildi.`);
        setTitle('');
        setBody('');
        return;
      } catch (err) {
        // Only a missing endpoint falls back; any other failure is reported.
        if (!(err instanceof ApiError && (err.status === 404 || err.status === 405))) throw err;
      }

      let done = 0;
      let failed = 0;
      const total = recipients.length;
      setProgress({ done, failed, total });
      const queue = [...recipients];
      const worker = async () => {
        for (let u = queue.shift(); u; u = queue.shift()) {
          try {
            await api.post(`/admin/users/${u.id}/push`, payload);
          } catch {
            failed += 1;
          }
          done += 1;
          setProgress({ done, failed, total });
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, total) }, worker));
      Alert.alert(
        failed ? 'Qisman yuborildi' : 'Yuborildi',
        failed ? `${total - failed} kishiga yuborildi, ${failed} tasida xato.` : `Xabar ${total} kishiga yuborildi.`,
      );
      if (!failed) {
        setTitle('');
        setBody('');
      }
    } catch (err) {
      Alert.alert('Xatolik', err instanceof Error ? err.message : "Yuborib bo'lmadi");
    } finally {
      setSending(false);
    }
  };

  /** Sent to a crowd and not unsendable — so it asks first, with the count. */
  const confirm = () =>
    Alert.alert('Xabar yuborilsinmi?', `${recipients.length} kishiga push yuboriladi. Uni qaytarib olib bo'lmaydi.`, [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Yuborish', onPress: send },
    ]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <KeyboardAwareScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}>
        <BackLink />
        <Text style={[styles.largeTitle, { color: t.text }]}>Ommaviy xabar</Text>

        <Text style={[styles.caption, { color: t.textMuted }]}>KIMGA</Text>
        <View style={styles.audiences}>
          {AUDIENCES.map((a) => {
            const active = audience === a.key;
            return (
              <Pressable
                key={a.key}
                onPress={() => setAudience(a.key)}
                style={[styles.audience, { backgroundColor: active ? t.primary : t.surface }]}
              >
                <Ionicons name={a.icon} size={18} color={active ? '#FFFFFF' : t.primary} />
                <Text style={[styles.audienceText, { color: active ? '#FFFFFF' : t.text }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {onlineApplies ? (
          <View style={[styles.toggleRow, { backgroundColor: t.surface }]}>
            <Text style={[styles.toggleText, { color: t.text }]}>Faqat hozir onlayn bo'lganlarga</Text>
            <Switch value={onlyOnline} onValueChange={setOnlyOnline} />
          </View>
        ) : null}

        <View style={[styles.count, { backgroundColor: t.primarySoft }]}>
          {loading ? (
            <ActivityIndicator color={t.primary} />
          ) : (
            <>
              <Ionicons name="people" size={18} color={t.primary} />
              <Text style={[styles.countText, { color: t.primary }]}>{recipients.length} kishi oladi</Text>
            </>
          )}
        </View>

        <Text style={[styles.caption, { color: t.textMuted }]}>XABAR</Text>
        <View style={[styles.form, { backgroundColor: t.surface }]}>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
            placeholder="Sarlavha, masalan: Ertaga ish ko'p bo'ladi"
            placeholderTextColor={t.textMuted}
            style={[styles.input, { color: t.text, borderBottomColor: t.borderLight }]}
          />
          <TextInput
            value={body}
            onChangeText={(v) => setBody(v.slice(0, BODY_MAX))}
            placeholder="Matn"
            placeholderTextColor={t.textMuted}
            multiline
            style={[styles.input, styles.bodyInput, { color: t.text }]}
          />
        </View>
        <Text style={[styles.limit, { color: t.textMuted }]}>
          {title.length}/{TITLE_MAX} · {body.length}/{BODY_MAX}
        </Text>

        {/* How it lands on a phone — the one thing worth checking before sending. */}
        {title || body ? (
          <View style={[styles.preview, { backgroundColor: t.surface }]}>
            <View style={[styles.previewIcon, { backgroundColor: t.primary }]}>
              <Text style={styles.previewIconText}>P</Text>
            </View>
            <View style={styles.previewText}>
              <Text style={[styles.previewTitle, { color: t.text }]} numberOfLines={1}>{title || 'Sarlavha'}</Text>
              <Text style={[styles.previewBody, { color: t.textSecondary }]} numberOfLines={3}>{body || 'Matn'}</Text>
            </View>
          </View>
        ) : null}

        {progress ? (
          <Text style={[styles.limit, { color: t.textMuted }]}>
            Yuborilmoqda: {progress.done}/{progress.total}
            {progress.failed ? ` · ${progress.failed} xato` : ''}
          </Text>
        ) : null}

        <Pressable
          onPress={confirm}
          disabled={!ready}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: t.primary, opacity: !ready ? 0.45 : pressed ? 0.8 : 1 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
              <Text style={styles.sendText}>Yuborish</Text>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, gap: 10 },
  largeTitle: { fontSize: 30, fontWeight: '700', marginBottom: 6 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginLeft: 4, marginTop: 6 },
  audiences: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  audience: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  audienceText: { fontSize: 15, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toggleText: { fontSize: 15, flex: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12 },
  countText: { fontSize: 15, fontWeight: '600' },
  form: { borderRadius: 10, overflow: 'hidden' },
  input: { fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  bodyInput: { minHeight: 110, textAlignVertical: 'top', borderBottomWidth: 0 },
  limit: { fontSize: 12, textAlign: 'right' },
  preview: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 12 },
  previewIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  previewIconText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  previewText: { flex: 1, gap: 2 },
  previewTitle: { fontSize: 15, fontWeight: '600' },
  previewBody: { fontSize: 14 },
  send: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 6,
  },
  sendText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});

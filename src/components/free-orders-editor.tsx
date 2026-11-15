/**
 * Free jobs for one worker or firm: how many they have, and a way to give more.
 *
 * The platform setting (Sozlamalar) is the default for everybody. This is for
 * one provider — "give this worker 50 free jobs" — without touching anybody
 * else. Jobs already spent are kept: 3 used and 50 given leaves 47.
 */

import { Text, TextInput } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

export function FreeOrdersEditor({
  userId,
  role,
  used,
  limit,
  onChanged,
}: {
  userId: string;
  role: 'worker' | 'company';
  used: number;
  limit: number;
  onChanged: () => void;
}) {
  const t = useTheme();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const left = Math.max(limit - used, 0);

  const send = async (body: Record<string, unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/admin/users/${userId}/free-orders`, { role, ...body });
      setValue('');
      Alert.alert('Muvaffaqiyat', done);
      onChanged();
    } catch (e: any) {
      Alert.alert('Xatolik', e.message);
    } finally {
      setBusy(false);
    }
  };

  const setTotal = () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) {
      Alert.alert('Xatolik', 'Tekin ishlar sonini kiriting (masalan, 50).');
      return;
    }
    send({ limit: n }, `Jami ${n} ta tekin ish belgilandi`);
  };

  const Chip = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: t.surfaceMuted, opacity: pressed || busy ? 0.6 : 1 },
      ]}>
      <Text style={[styles.chipText, { color: t.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.box}>
      <Text style={[styles.label, { color: t.textMuted }]}>
        Tekin ishlar: {left} qoldi (jami {limit}, ishlatilgan {used})
      </Text>
      <View style={styles.row}>
        <Chip label="+10" onPress={() => send({ add: 10 }, '10 ta tekin ish qo‘shildi')} />
        <Chip label="+50" onPress={() => send({ add: 50 }, '50 ta tekin ish qo‘shildi')} />
        <Chip label="+100" onPress={() => send({ add: 100 }, '100 ta tekin ish qo‘shildi')} />
      </View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { backgroundColor: t.surfaceMuted, color: t.text }]}
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder="Jami soni (masalan, 50)"
          placeholderTextColor={t.textMuted}
        />
        <Chip label="Belgilash" onPress={setTotal} />
      </View>
      <Pressable
        onPress={() => send({ reset_limit: true }, 'Standart songa qaytarildi')}
        disabled={busy}
        style={({ pressed }) => [styles.link, { opacity: pressed || busy ? 0.6 : 1 }]}>
        <Text style={[styles.linkText, { color: t.textMuted }]}>Umumiy songa qaytarish</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, gap: 8 },
  label: { fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 44, borderRadius: 8, paddingHorizontal: 14, fontSize: 16 },
  chip: { height: 44, minWidth: 64, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '600' },
  link: { alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { fontSize: 13, textDecorationLine: 'underline' },
});

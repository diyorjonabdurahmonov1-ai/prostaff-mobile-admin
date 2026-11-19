/**
 * Pick the services a worker does.
 *
 * A worker with no service can never be rung, so the server refuses to save one
 * (`categories_required`). The admin form used to send an empty list and the
 * refusal told the office to "add a category" with nowhere on the screen to do
 * it. This is that place: the active services as chips, tap to choose, at least
 * one.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';

export function CategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTheme();
  const [cats, setCats] = useState<Category[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .get<Category[]>('/admin/categories')
      .then((list) => {
        if (live) setCats((list ?? []).filter((c) => c.active));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: t.textMuted }]}>Xizmat turlari</Text>
        <Text style={[styles.count, { color: selected.length ? t.primary : t.danger }]}>
          {selected.length ? `${selected.length} ta tanlandi` : 'Kamida bittasini tanlang'}
        </Text>
      </View>
      {cats === null && !failed ? (
        <ActivityIndicator color={t.primary} style={{ alignSelf: 'flex-start' }} />
      ) : failed ? (
        <Text style={{ color: t.danger, fontSize: 14 }}>
          Xizmatlar ro'yxati yuklanmadi. Orqaga qaytib qayta kiring.
        </Text>
      ) : cats && cats.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 14 }}>
          Hali xizmat yo'q. Avval "Ko'proq → Kategoriyalar" bo'limidan xizmat qo'shing.
        </Text>
      ) : (
        <View style={styles.chips}>
          {cats?.map((c) => {
            const on = selected.includes(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggle(c.id)}
                style={[
                  styles.chip,
                  { backgroundColor: on ? t.primary : t.surfaceMuted },
                ]}>
                <Text style={[styles.chipText, { color: on ? t.onPrimary : t.text }]}>
                  {c.name_uz}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
  count: { fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: '600' },
});

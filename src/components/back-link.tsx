import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';

/**
 * "‹ Yana" above a screen that lives under the Yana tab.
 *
 * Those screens used to be tabs of their own and drew no way back. Now they
 * are reached from a list, so they lead back to it — by navigating there
 * rather than `back()`, which from a tab has no stack to pop.
 */
export function BackLink({ label = 'Yana', href = '/(admin)/more' as Href }: { label?: string; href?: Href }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => router.navigate(href)}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={22} color={t.primary} />
      <Text style={[styles.label, { color: t.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -4, paddingTop: 6 },
  label: { fontSize: 17 },
  pressed: { opacity: 0.5 },
});

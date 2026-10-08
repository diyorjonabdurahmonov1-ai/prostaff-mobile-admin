import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Item {
  title: string;
  subtitle: string;
  icon: IoniconsName;
  tint: 'primary' | 'success' | 'warning' | 'danger';
  href: Href;
}

/**
 * Everything that is not looked at every hour.
 *
 * The tab bar held seven tabs, and on a phone every label was cut to
 * "Foydal…", "Kateg…". Five stay as tabs — the screens the office lives in —
 * and the rest are here, grouped by what they are for.
 */
const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'KUZATUV',
    items: [
      { title: 'Jonli xarita', subtitle: 'Kim onlayn va qayerda', icon: 'map', tint: 'success', href: '/(admin)/map' as Href },
      { title: 'Ishchilar reytingi', subtitle: "Eng yaxshilar va ko'p bekor qilganlar", icon: 'trophy', tint: 'warning', href: '/(admin)/leaderboard' as Href },
    ],
  },
  {
    title: 'ALOQA',
    items: [
      { title: 'Ommaviy xabar', subtitle: 'Ishchilar, firmalar yoki hammaga push', icon: 'megaphone', tint: 'primary', href: '/(admin)/broadcast' as Href },
    ],
  },
  {
    title: 'SOZLASH',
    items: [
      { title: 'Kategoriyalar', subtitle: 'Xizmat turlari ro\'yxati', icon: 'apps', tint: 'primary', href: '/(admin)/categories' as Href },
      { title: "Tariflar va to'lovlar", subtitle: 'Firma obunalari va tushum', icon: 'pricetags', tint: 'success', href: '/(admin)/plans' as Href },
      { title: 'Sozlamalar', subtitle: 'Komissiya, limitlar, chiqish', icon: 'settings', tint: 'danger', href: '/(admin)/settings' as Href },
    ],
  },
];

export default function MoreScreen() {
  const t = useTheme();
  const bottomInset = useTabContentInset();
  const tints = {
    primary: [t.primarySoft, t.primary],
    success: [t.successSoft, t.success],
    warning: [t.warningSoft, t.warning],
    danger: [t.dangerSoft, t.danger],
  } as const;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}>
        <Text style={[styles.largeTitle, { color: t.text }]}>Yana</Text>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.caption, { color: t.textMuted }]}>{section.title}</Text>
            <View style={[styles.group, { backgroundColor: t.surface }]}>
              {section.items.map((item, i) => (
                <Pressable
                  key={item.title}
                  onPress={() => router.push(item.href)}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borderLight },
                    pressed && { backgroundColor: t.surfaceMuted },
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: tints[item.tint][0] }]}>
                    <Ionicons name={item.icon} size={18} color={tints[item.tint][1]} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.title, { color: t.text }]}>{item.title}</Text>
                    <Text style={[styles.subtitle, { color: t.textMuted }]} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, gap: 20 },
  largeTitle: { fontSize: 34, fontWeight: '700' },
  section: { gap: 6 },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginLeft: 4 },
  group: { borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  title: { fontSize: 16 },
  subtitle: { fontSize: 13 },
});

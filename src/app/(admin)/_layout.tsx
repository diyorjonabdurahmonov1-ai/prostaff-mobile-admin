import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IoniconsName; iconFocused: IoniconsName }[] = [
  { name: 'index', title: 'Boshqaruv', icon: 'grid-outline', iconFocused: 'grid' },
  // Short labels: five tabs at phone width leave about 75pt each, and the
  // full words were cut to "Foydal…".
  { name: 'users', title: 'Odamlar', icon: 'people-outline', iconFocused: 'people' },
  { name: 'companies', title: 'Firmalar', icon: 'business-outline', iconFocused: 'business' },
  { name: 'orders', title: 'Buyurtmalar', icon: 'receipt-outline', iconFocused: 'receipt' },
  // Categories, tariffs, settings, the map, broadcasts and the leaderboard:
  // looked at daily rather than hourly, so they live one tap further in.
  { name: 'more', title: 'Yana', icon: 'ellipsis-horizontal-circle-outline', iconFocused: 'ellipsis-horizontal-circle' },
];

/** Screens reached from inside the app, not from the bar. */
const HIDDEN = ['user/[id]', 'order/[id]', 'map', 'categories', 'plans', 'settings', 'broadcast', 'leaderboard'];

export default function AdminLayout() {
  const t = useTheme();

  return (
    <Tabs
      // Back from a screen opened inside a tab (an order, the map) returns to
      // where it was opened from, not to the first tab.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.borderLight,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? tab.iconFocused : tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
      {HIDDEN.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

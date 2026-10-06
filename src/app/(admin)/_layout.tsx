import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IoniconsName; iconFocused: IoniconsName }[] = [
  { name: 'index', title: 'Boshqaruv', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'users', title: 'Foydalanuvchilar', icon: 'people-outline', iconFocused: 'people' },
  { name: 'companies', title: 'Kompaniyalar', icon: 'business-outline', iconFocused: 'business' },
  { name: 'orders', title: 'Buyurtmalar', icon: 'receipt-outline', iconFocused: 'receipt' },
  // The service list every order and every provider is filed under. It sits next
  // to the operational tabs rather than in Sozlamalar because editing it changes
  // what customers can order today, not how the platform is configured.
  { name: 'categories', title: 'Kategoriyalar', icon: 'apps-outline', iconFocused: 'apps' },
  // Tariffs earn their own tab: they are what firms pay, and the history of who
  // paid is the office's revenue ledger — neither belongs buried in Sozlamalar.
  { name: 'plans', title: 'Tariflar', icon: 'pricetags-outline', iconFocused: 'pricetags' },
  { name: 'settings', title: 'Sozlamalar', icon: 'settings-outline', iconFocused: 'settings' },
];

export default function AdminLayout() {
  const t = useTheme();

  return (
    <Tabs
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
      <Tabs.Screen name="user/[id]" options={{ href: null }} />
    </Tabs>
  );
}

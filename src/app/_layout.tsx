import { useTheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth } from '@/store/auth';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/text';
// SafeAreaView comes from safe-area-context, not react-native: the core one is
// deprecated and only ever honoured the notch on iOS.
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AuthScreen from './auth';

function Gate() {
  const { user, token, loading, isAdmin, signOut } = useAuth();
  const t = useTheme();

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  if (!token || !user) {
    return <AuthScreen />;
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <Text style={[styles.denied, { color: t.danger }]}>Доступ запрещен</Text>
        <Text style={[styles.sub, { color: t.textMuted }]}>У вас нет прав администратора</Text>
        <Pressable
          onPress={signOut}
          style={({ pressed }) => [
            styles.logoutBtn,
            { backgroundColor: t.danger, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.logoutText}>Chiqish</Text>
        </Pressable>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* flex:1 is required — without it the view wraps its content and the
          screen collapses to nothing.

          The bottom edge is deliberately not claimed here. With all four edges
          on, this view stopped short of the navigation bar and the tab bar
          stopped with it, leaving a bare unpainted strip along the bottom of
          every screen. The tab bar applies the bottom inset itself — it is the
          thing that has to reach the edge of the glass. */}
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <AuthProvider>
          <StatusBar style="auto" />
          <Gate />
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  denied: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
  },
  logoutBtn: {
    marginTop: 32,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

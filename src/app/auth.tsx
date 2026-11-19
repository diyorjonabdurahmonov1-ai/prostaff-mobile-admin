import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/hooks/use-theme';

export default function AuthScreen() {
  const t = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    try {
      await login(email.trim(), password.trim());
    } catch (e: any) {
      Alert.alert('Xatolik', e.message || 'Login yoki parol noto\'g\'ri');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.background }]}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior="padding"
      >
        <View style={styles.iconWrap}>
          <View style={[styles.logoTile, { backgroundColor: t.primary }]}>
            <Ionicons name="shield-checkmark" size={40} color={t.onPrimary} />
          </View>
        </View>
        <Text style={[styles.title, { color: t.text }]}>PROSTAFF Admin</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>
          Admin panelga kirish
        </Text>

        <View style={styles.form}>
          <Text style={[styles.label, { color: t.textSecondary }]}>EMAIL</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: t.surface,
                color: t.text,
                borderColor: t.borderLight,
              },
            ]}
            placeholder="admin@prostaff.uz"
            placeholderTextColor={t.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />

          <Text style={[styles.label, { color: t.textSecondary }]}>PAROL</Text>
          <View
            style={[
              styles.input,
              styles.passwordRow,
              {
                backgroundColor: t.surface,
                borderColor: t.borderLight,
              },
            ]}
          >
            <TextInput
              style={[styles.passwordInput, { color: t.text }]}
              placeholder="Parol"
              placeholderTextColor={t.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              onSubmitEditing={handleLogin}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={t.textMuted}
              />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: t.primary,
                opacity: busy ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
            onPress={handleLogin}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={t.onPrimary} />
            ) : (
              <Text style={[styles.buttonText, { color: t.onPrimary }]}>
                Kirish
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoTile: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 4,
    marginLeft: 4,
    marginTop: 12,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 17,
    height: 50,
  },
  button: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

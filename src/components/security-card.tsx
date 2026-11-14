/**
 * What the running server says about its own safety.
 *
 * The platform can be taken over if it runs on the key or the admin password
 * that ship in the source code, and nobody can tell from outside which one the
 * server is using. The server checks itself (GET /admin/security-check) and
 * this shows the answer, worst first, in words that say what to do.
 *
 * Hidden entirely on a server that does not have the endpoint yet, and when
 * everything is fine it is one quiet green line.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

type Level = 'ok' | 'info' | 'warning' | 'critical';
interface Check {
  code: string;
  level: Level;
  title: string;
  detail?: string;
}
interface Result {
  ok: boolean;
  checks: Check[];
}

const ORDER: Record<Level, number> = { critical: 0, warning: 1, info: 2, ok: 3 };

export function SecurityCard() {
  const t = useTheme();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<Result>('/admin/security-check')
      .then((r) => live && r && Array.isArray(r.checks) && setResult(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!result) return null;

  const tone = {
    critical: { color: t.danger, soft: t.dangerSoft, icon: 'warning' as const },
    warning: { color: t.warning, soft: t.warningSoft, icon: 'alert-circle' as const },
    info: { color: t.primary, soft: t.surfaceMuted, icon: 'information-circle' as const },
    ok: { color: t.success, soft: t.successSoft, icon: 'checkmark-circle' as const },
  };
  const problems = result.checks.filter((c) => c.level !== 'ok').sort((a, b) => ORDER[a.level] - ORDER[b.level]);

  if (problems.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: t.successSoft }]}>
        <Ionicons name="shield-checkmark" size={22} color={t.success} />
        <Text style={[styles.title, { color: t.success }]}>Xavfsizlik tekshiruvi: hammasi joyida</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.header, { color: t.textMuted }]}>XAVFSIZLIK TEKSHIRUVI</Text>
      {problems.map((c) => (
        <View key={c.code} style={[styles.card, styles.col, { backgroundColor: tone[c.level].soft }]}>
          <View style={styles.row}>
            <Ionicons name={tone[c.level].icon} size={22} color={tone[c.level].color} />
            <Text style={[styles.title, { color: t.text }]}>{c.title}</Text>
          </View>
          {c.detail ? <Text style={[styles.detail, { color: t.textSecondary }]}>{c.detail}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 8 },
  header: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, marginTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, marginBottom: 8 },
  col: { flexDirection: 'column', alignItems: 'stretch', gap: 6, marginBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13, lineHeight: 18 },
});

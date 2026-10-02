// app/(gc)/more.tsx — More tab: account + upcoming modules.
// Activity (time log), Crew, and Estimates land in the next slices; listed
// here so the tab structure matches the spec without shipping empty tabs.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/stores/auth';
import { colors, spacing, typography } from '../../src/lib/theme';

const UPCOMING = [
  { title: 'Activity — time log by phase', note: 'Clock in/out per phase, daily totals. Next build slice.' },
  { title: 'Crew — team locations', note: 'Who is on site, distance, quick call.' },
  { title: 'Estimates — bid history', note: 'Past bids, amounts, won/lost.' },
];

export default function MoreTab() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={typography.heading}>{user?.full_name || 'Account'}</Text>
        <Text style={typography.dim}>{user?.email} · {user?.role}</Text>
      </View>

      <Text style={[typography.dim, styles.section]}>COMING NEXT</Text>
      {UPCOMING.map((u) => (
        <View key={u.title} style={styles.card}>
          <Text style={typography.body}>{u.title}</Text>
          <Text style={typography.dim}>{u.note}</Text>
        </View>
      ))}

      <Pressable
        style={styles.logout}
        onPress={async () => {
          await logout();
          router.replace('/login');
        }}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  section: { marginTop: spacing.md, fontSize: 12, letterSpacing: 1 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  logout: {
    marginTop: spacing.xl,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { ...typography.body, color: colors.danger, fontWeight: '600' },
});

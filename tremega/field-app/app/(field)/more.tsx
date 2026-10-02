// app/(field)/more.tsx — field More tab (profile, logout).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/stores/auth';
import { colors, spacing, touch, typography } from '../../src/lib/theme';

export default function FieldMore() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={typography.heading}>{user?.full_name || 'Field worker'}</Text>
        <Text style={[typography.dim, { marginTop: spacing.xs }]}>{user?.phone || user?.email || ''}</Text>
        <Text style={[typography.dim, { marginTop: spacing.xs }]}>Role: {user?.role}</Text>
      </View>
      <Pressable style={({ pressed }) => [styles.logout, pressed && { opacity: 0.7 }]} onPress={onLogout}>
        <Text style={styles.logoutText}>LOG OUT</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  card: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg,
  },
  logout: {
    backgroundColor: colors.danger, borderRadius: touch.buttonRadius,
    minHeight: touch.minTarget, alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
});

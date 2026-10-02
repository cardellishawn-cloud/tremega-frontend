// app/index.tsx — entry redirect by role.
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth, roleHome } from '../src/stores/auth';
import { colors } from '../src/lib/theme';

export default function Index() {
  const { user, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={roleHome(user.role) as never} />;
}

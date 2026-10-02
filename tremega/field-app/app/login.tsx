// app/login.tsx — SMS OTP login (field workers). Two steps: phone → code.
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, roleHome } from '../src/stores/auth';
import { colors, spacing, touch, typography } from '../src/lib/theme';

export default function Login() {
  const router = useRouter();
  const { sendCode, verifyCode } = useAuth();
  const [phone, setPhone] = useState('+1');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSend = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await sendCode(phone.trim());
      if (result.sent) {
        setStage('code');
        setNotice('Code sent — check your texts.');
      } else {
        setError(result.message || 'SMS is not configured on the server.');
      }
    } catch (err: any) {
      const errData = err?.response?.data;
      // Handle both {"error": "..."} and {"errors": [{msg: "..."}]}
      const message =
        errData?.error ||
        errData?.errors?.[0]?.msg ||
        errData?.message ||
        'Could not send the code.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyCode(phone.trim(), code.trim());
      const { user } = useAuth.getState();
      router.replace(roleHome(user?.role) as never);
    } catch (err: any) {
      const errData = err?.response?.data;
      const message =
        errData?.error ||
        errData?.errors?.[0]?.msg ||
        errData?.message ||
        'Invalid or expired code.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>TREMEGA</Text>
      <Text style={styles.subtitle}>
        {stage === 'phone' ? 'Sign in with your phone number' : `Enter the 6-digit code sent to ${phone}`}
      </Text>

      {stage === 'phone' ? (
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+15551234567"
          placeholderTextColor={colors.textDim}
          keyboardType="phone-pad"
          autoComplete="tel"
          autoFocus
        />
      ) : (
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={setCode}
          placeholder="••••••"
          placeholderTextColor={colors.textDim}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice && !error ? <Text style={styles.notice}>{notice}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.button, (busy || pressed) && styles.buttonDim]}
        onPress={stage === 'phone' ? onSend : onVerify}
        disabled={busy}
      >
        <Text style={styles.buttonText}>
          {busy ? '…' : stage === 'phone' ? 'TEXT ME A CODE' : 'SIGN IN'}
        </Text>
      </Pressable>

      {stage === 'code' ? (
        <Pressable onPress={() => { setStage('phone'); setCode(''); setError(null); }} style={styles.linkWrap}>
          <Text style={styles.link}>Use a different number</Text>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center',
  },
  logo: {
    ...typography.title, fontSize: 32, letterSpacing: 4, color: colors.accent, textAlign: 'center',
  },
  subtitle: { ...typography.dim, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: touch.buttonRadius, color: colors.text, fontSize: 20,
    paddingHorizontal: spacing.md, minHeight: touch.minTarget, marginBottom: spacing.md,
  },
  codeInput: { textAlign: 'center', fontSize: 28, letterSpacing: 8 },
  button: {
    backgroundColor: colors.accent, borderRadius: touch.buttonRadius,
    minHeight: touch.minTarget, alignItems: 'center', justifyContent: 'center',
  },
  buttonDim: { opacity: 0.6 },
  buttonText: { color: colors.accentText, fontSize: 17, fontWeight: '700', letterSpacing: 1 },
  error: { ...typography.body, color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
  notice: { ...typography.dim, color: colors.success, marginBottom: spacing.md, textAlign: 'center' },
  linkWrap: { marginTop: spacing.lg, alignItems: 'center', minHeight: touch.minTarget, justifyContent: 'center' },
  link: { ...typography.body, color: colors.info },
});

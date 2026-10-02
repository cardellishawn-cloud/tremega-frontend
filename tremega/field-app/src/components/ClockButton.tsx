// src/components/ClockButton.tsx — big clock in/out toggle + live timer.
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import { fmtElapsed } from '../lib/time';

interface Props {
  isClocked: boolean;
  elapsedMs: number;
  busy: boolean;
  disabled?: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
}

export function ClockButton({ isClocked, elapsedMs, busy, disabled, onClockIn, onClockOut }: Props) {
  return (
    <View style={styles.wrap}>
      {isClocked && (
        <Text style={styles.timer}>{fmtElapsed(elapsedMs)}</Text>
      )}
      <Pressable
        style={[
          styles.btn,
          { backgroundColor: isClocked ? colors.danger : colors.success },
          (disabled || busy) && { opacity: 0.5 },
        ]}
        disabled={disabled || busy}
        onPress={isClocked ? onClockOut : onClockIn}
        accessibilityRole="button"
        accessibilityLabel={isClocked ? 'Clock out' : 'Clock in'}
        accessibilityState={{ disabled: Boolean(disabled || busy) }}
        testID="clock-toggle"
      >
        {busy
          ? <ActivityIndicator color={colors.accentText} />
          : <Text style={styles.btnText}>{isClocked ? 'CLOCK OUT' : 'CLOCK IN'}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md },
  timer: {
    ...typography.title,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 40,
    letterSpacing: 2,
  },
  btn: {
    alignSelf: 'stretch',
    minHeight: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { ...typography.heading, color: colors.accentText, fontWeight: '700', letterSpacing: 1 },
});

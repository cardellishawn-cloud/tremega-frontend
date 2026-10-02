// src/components/ThinkingDots.tsx — animated "Claude is thinking…" (3-dot pulse).
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';

function Dot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 350, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, delay]);
  return <Animated.Text style={[styles.dot, { opacity }]}>●</Animated.Text>;
}

export function ThinkingDots({ label = 'Claude is thinking' }: { label?: string }) {
  return (
    <View style={styles.row} accessibilityLiveRegion="polite" accessibilityLabel={`${label}…`}>
      <Text style={styles.text}>{label}</Text>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  text: { ...typography.dim, marginRight: spacing.xs },
  dot: { color: colors.accent, fontSize: 10 },
});

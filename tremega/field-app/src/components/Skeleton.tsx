// src/components/Skeleton.tsx — pulsing placeholder cards for loading states.
// Spec: 3-4 placeholder cards matching real card height; no blank screens.
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, spacing, layout } from '../lib/theme';

export function SkeletonCard({ height = 84 }: { height?: number }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.card, { height, opacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export function SkeletonList({ count = 3, height = 84 }: { count?: number; height?: number }) {
  return (
    <View style={styles.list} testID="skeleton-list">
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} height={height} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: layout.radius,
  },
});

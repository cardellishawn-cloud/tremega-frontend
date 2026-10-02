// src/components/WorkLogCard.tsx — one phase's collapsible daily log.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import { fmtClock, fmtDuration } from '../lib/time';
import type { ActivityEntry } from '../hooks/useActivity';

interface Props {
  phase: string;
  entries: ActivityEntry[]; // completed entries for this phase, today
}

const label = (p: string) => p.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function WorkLogCard({ phase, entries }: Props) {
  const [expanded, setExpanded] = useState(false);
  const totalMs = entries.reduce((sum, e) => sum + e.duration, 0);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.phase}>{label(phase)}</Text>
        <Text style={styles.total}>{fmtDuration(totalMs)}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.detail}>
          {entries.map((e) => (
            <Text key={e.id ?? `${e.phase}-${e.startTime}`} style={styles.row}>
              {fmtClock(e.startTime)} – {e.endTime ? fmtClock(e.endTime) : 'now'} ({fmtDuration(e.duration)})
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chevron: { color: colors.textDim, fontSize: 16, width: 18 },
  phase: { ...typography.body, fontWeight: '600', flex: 1 },
  total: { ...typography.body, color: colors.accent, fontWeight: '700' },
  detail: {
    borderTopColor: colors.cardBorder,
    borderTopWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  row: { ...typography.dim },
});

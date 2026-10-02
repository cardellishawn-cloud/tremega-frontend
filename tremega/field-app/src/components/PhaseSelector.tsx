// src/components/PhaseSelector.tsx — "What are you working on?" dropdown.
// Pressable field + Modal list (avoids a picker dependency).
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';

interface Props {
  phases: string[];
  value: string;
  onChange: (phase: string) => void;
  disabled?: boolean;
}

const label = (p: string) => p.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function PhaseSelector({ phases, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Text style={[typography.dim, styles.label]}>What are you working on?</Text>
      <Pressable
        style={[styles.field, disabled && { opacity: 0.5 }]}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.fieldText}>{label(value)}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {phases.map((p) => (
              <Pressable
                key={p}
                style={[styles.option, p === value && styles.optionActive]}
                onPress={() => { onChange(p); setOpen(false); }}
              >
                <Text style={[styles.optionText, p === value && { color: colors.accent }]}>
                  {label(p)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  fieldText: { ...typography.body, fontWeight: '600' },
  chevron: { color: colors.textDim, fontSize: 18 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  option: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  optionActive: { backgroundColor: colors.bg },
  optionText: { ...typography.body },
});

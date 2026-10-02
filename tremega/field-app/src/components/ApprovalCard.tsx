// src/components/ApprovalCard.tsx — inline pending-approval card in chat.
// Approve one-tap; Reject expands an optional-reason prompt.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import type { Approval } from '../hooks/useChat';

const toolLabel = (a: Approval) =>
  (a.tool_name || a.action_type || 'request').replace(/_/g, ' ');

const inputSummary = (a: Approval): string | null => {
  if (a.summary) return a.summary;
  const input = a.input || {};
  const bits: string[] = [];
  if (input.order_id) bits.push(`order ${String(input.order_id).slice(0, 8)}…`);
  if (input.bid_id) bits.push(`bid ${String(input.bid_id).slice(0, 8)}…`);
  if (input.total != null) bits.push(`$${Number(input.total).toFixed(2)}`);
  if (input.materials && Array.isArray(input.materials)) bits.push(`${input.materials.length} items`);
  return bits.length ? bits.join(' · ') : null;
};

interface Props {
  approval: Approval;
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
}

export function ApprovalCard({ approval, busy, onApprove, onReject }: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Approval needed</Text>
      <Text style={styles.tool}>{toolLabel(approval)}</Text>
      {inputSummary(approval) && (
        <Text style={typography.dim}>{inputSummary(approval)}</Text>
      )}

      {!rejecting ? (
        <View style={styles.buttons}>
          <Pressable
            style={[styles.btn, styles.approve, busy && { opacity: 0.5 }]}
            disabled={busy}
            onPress={() => onApprove(approval.id)}
            accessibilityRole="button"
            accessibilityLabel={`Approve ${toolLabel(approval)}`}
            testID="approve-btn"
          >
            {busy ? <ActivityIndicator color={colors.accentText} size="small" />
              : <Text style={styles.btnTextDark}>Approve</Text>}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.reject, busy && { opacity: 0.5 }]}
            disabled={busy}
            onPress={() => setRejecting(true)}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${toolLabel(approval)}`}
            testID="reject-btn"
          >
            <Text style={styles.btnTextLight}>Reject</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.rejectBox}>
          <TextInput
            style={styles.reasonInput}
            placeholder="Reason (optional)"
            placeholderTextColor={colors.textDim}
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <View style={styles.buttons}>
            <Pressable
              style={[styles.btn, styles.reject, busy && { opacity: 0.5 }]}
              disabled={busy}
              onPress={() => { onReject(approval.id, reason.trim() || undefined); setRejecting(false); }}
              accessibilityRole="button"
              accessibilityLabel="Confirm rejection"
              testID="confirm-reject-btn"
            >
              {busy ? <ActivityIndicator color={colors.danger} size="small" />
                : <Text style={styles.btnTextLight}>Confirm reject</Text>}
            </Pressable>
            <Pressable
              style={[styles.btn, styles.ghost]}
              disabled={busy}
              onPress={() => { setRejecting(false); setReason(''); }}
            >
              <Text style={styles.btnTextLight}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  title: { ...typography.dim, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  tool: { ...typography.body, fontWeight: '700', textTransform: 'capitalize' },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: {
    flex: 1, minHeight: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  approve: { backgroundColor: colors.success },
  reject: { borderColor: colors.danger, borderWidth: 1 },
  ghost: { borderColor: colors.cardBorder, borderWidth: 1 },
  btnTextDark: { ...typography.body, color: colors.accentText, fontWeight: '700' },
  btnTextLight: { ...typography.body, color: colors.text, fontWeight: '600' },
  rejectBox: { gap: spacing.sm },
  reasonInput: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    padding: spacing.md,
    minHeight: 44,
    textAlignVertical: 'top',
  },
});

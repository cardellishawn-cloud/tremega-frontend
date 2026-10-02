// src/components/CrewDetailSheet.tsx — bottom-sheet modal with crew details.
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import { formatDistance } from '../lib/geo';
import { StatusBadge } from './StatusBadge';
import type { CrewMember } from '../hooks/useCrew';

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

const roleLabel = (r: string) => r.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface Props {
  member: CrewMember | null;
  onClose: () => void;
}

export function CrewDetailSheet({ member, onClose }: Props) {
  if (!member) return null;
  const call = () => { if (member.phone) Linking.openURL(`tel:${member.phone}`).catch(() => {}); };
  const text = () => { if (member.phone) Linking.openURL(`sms:${member.phone}`).catch(() => {}); };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => { /* keep open */ }}>
          <View style={styles.grabber} />

          <View style={styles.headerRow}>
            <View style={[styles.avatar, member.status === 'on-site' && { borderColor: colors.success }]}>
              <Text style={styles.avatarText}>{initials(member.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.heading}>{member.name}</Text>
              <Text style={typography.dim}>{roleLabel(member.role)}</Text>
            </View>
            <StatusBadge status={member.status} />
          </View>

          <View style={styles.rows}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Phone</Text>
              <Text style={styles.rowValue}>{member.phone || 'Not on file'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Distance</Text>
              <Text style={styles.rowValue}>
                {member.status === 'on-site'
                  ? 'On-site'
                  : member.distanceM != null
                    ? formatDistance(member.distanceM)
                    : 'Location not reported'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Last update</Text>
              <Text style={styles.rowValue}>
                {member.last_location_update
                  ? new Date(member.last_location_update).toLocaleString()
                  : 'Never'}
              </Text>
            </View>
            {member.eta && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>ETA</Text>
                <Text style={styles.rowValue}>{member.eta}</Text>
              </View>
            )}
          </View>

          <View style={styles.buttons}>
            <Pressable
              style={[styles.btn, styles.btnPrimary, !member.phone && { opacity: 0.4 }]}
              disabled={!member.phone}
              onPress={call}
            >
              <Text style={styles.btnPrimaryText}>Call</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, !member.phone && { opacity: 0.4 }]}
              disabled={!member.phone}
              onPress={text}
            >
              <Text style={styles.btnPrimaryText}>Text</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.cardBorder,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...typography.title, color: colors.accent },
  rows: { gap: spacing.sm },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomColor: colors.cardBorder, borderBottomWidth: 1, paddingVertical: spacing.sm,
  },
  rowLabel: { ...typography.dim },
  rowValue: { ...typography.body },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1, minHeight: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { ...typography.body, color: colors.accentText, fontWeight: '700' },
  btnGhost: { borderColor: colors.cardBorder, borderWidth: 1 },
  btnGhostText: { ...typography.body, color: colors.textDim },
});

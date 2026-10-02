// src/components/CrewCard.tsx — crew member row: avatar, name/role, status,
// distance, call/text quick actions. Tap row -> detail sheet.
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import { formatDistance } from '../lib/geo';
import { StatusBadge } from './StatusBadge';
import type { CrewMember } from '../hooks/useCrew';

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

const roleLabel = (r: string) => r.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface Props {
  member: CrewMember;
  onPress: (member: CrewMember) => void;
}

export function CrewCard({ member, onPress }: Props) {
  const call = () => { if (member.phone) Linking.openURL(`tel:${member.phone}`).catch(() => {}); };
  const text = () => { if (member.phone) Linking.openURL(`sms:${member.phone}`).catch(() => {}); };

  return (
    <Pressable style={styles.card} onPress={() => onPress(member)}>
      <View style={[styles.avatar, member.status === 'on-site' && styles.avatarOnSite]}>
        <Text style={styles.avatarText}>{initials(member.name)}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{member.name}</Text>
        <Text style={typography.dim}>{roleLabel(member.role)}</Text>
        <View style={styles.metaRow}>
          <StatusBadge status={member.status} />
          <Text style={[styles.distance, member.status === 'on-site' && { color: colors.success }]}>
            {member.status === 'on-site'
              ? 'On-site'
              : member.distanceM != null
                ? `${formatDistance(member.distanceM)} away`
                : 'location not reported'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, !member.phone && { opacity: 0.3 }]}
          disabled={!member.phone}
          onPress={call}
          hitSlop={8}
        >
          <Text style={styles.actionGlyph}>📞</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, !member.phone && { opacity: 0.3 }]}
          disabled={!member.phone}
          onPress={text}
          hitSlop={8}
        >
          <Text style={styles.actionGlyph}>✉️</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarOnSite: { borderColor: colors.success },
  avatarText: { ...typography.heading, color: colors.accent },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  distance: { fontSize: 12, color: colors.textDim },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  actionGlyph: { fontSize: 16 },
});

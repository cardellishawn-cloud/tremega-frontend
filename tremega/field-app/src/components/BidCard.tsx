// src/components/BidCard.tsx — collapsible bid row for the Estimates tab.
// Collapsed: date, job name, amount, status, 2-line scope preview.
// Expanded: full scope, materials list, labor hours, PDF button, notes.
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import { fmtDate, fmtMoney } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import type { Bid } from '../hooks/useBids';

export function BidCard({ bid }: { bid: Bid }) {
  const [expanded, setExpanded] = useState(false);

  const openPdf = () => {
    if (bid.pdf_url) Linking.openURL(bid.pdf_url).catch(() => {});
  };

  return (
    <Pressable style={styles.card} onPress={() => setExpanded((v) => !v)}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{fmtDate(bid.date)}</Text>
          <Text style={styles.name} numberOfLines={expanded ? undefined : 1}>{bid.job_name}</Text>
          {bid.customer && <Text style={typography.dim} numberOfLines={1}>{bid.customer}</Text>}
        </View>
        <View style={styles.rightCol}>
          <Text style={styles.amount}>{fmtMoney(bid.amount)}</Text>
          <StatusBadge status={bid.status} />
        </View>
      </View>

      {bid.scope ? (
        <Text style={styles.scope} numberOfLines={expanded ? undefined : 2}>
          {bid.scope}
        </Text>
      ) : null}

      <Text style={styles.chevron}>{expanded ? '▾ tap to collapse' : '▸ details'}</Text>

      {expanded && (
        <View style={styles.detail}>
          {bid.materials.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Line items</Text>
              {bid.materials.map((m) => (
                <Text key={m.id} style={styles.bullet} numberOfLines={2}>
                  • {m.description}
                  {m.quantity != null ? ` ×${m.quantity}${m.unit ? ' ' + m.unit : ''}` : ''}
                  {m.amount != null ? ` — ${fmtMoney(m.amount)}` : ''}
                </Text>
              ))}
            </View>
          )}
          {bid.labor_hours != null && (
            <Text style={styles.meta}>Est. {bid.labor_hours} hours</Text>
          )}
          {bid.notes ? <Text style={styles.meta}>Notes: {bid.notes}</Text> : null}
          {bid.pdf_url ? (
            <Pressable style={styles.pdfBtn} onPress={openPdf}>
              <Text style={styles.pdfBtnText}>Download PDF</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', gap: spacing.md },
  date: { ...typography.dim, fontSize: 13 },
  name: { ...typography.body, fontWeight: '700', marginTop: 2 },
  rightCol: { alignItems: 'flex-end', gap: spacing.xs },
  amount: { ...typography.heading, color: colors.text },
  scope: { ...typography.dim },
  chevron: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  detail: {
    borderTopColor: colors.cardBorder,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.body, fontWeight: '600' },
  bullet: { ...typography.dim, fontSize: 13 },
  meta: { ...typography.dim },
  pdfBtn: {
    backgroundColor: colors.info,
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBtnText: { ...typography.body, color: colors.accentText, fontWeight: '700' },
});

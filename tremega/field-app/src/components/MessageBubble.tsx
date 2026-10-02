// src/components/MessageBubble.tsx — one chat message (user right, assistant left).
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import type { ChatMessage } from '../hooks/useChat';

const STATUS_GLYPH: Record<string, string> = {
  sending: '⏳',
  sent: '✓',
  failed: '⚠',
  queued: '⌛',
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {message.content}
        </Text>
        {isUser && message.status && (
          <Text style={styles.status}>
            {message.status === 'queued' ? 'queued · will auto-send' : STATUS_GLYPH[message.status]}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: spacing.xs },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  text: { ...typography.body, fontSize: 15 },
  textUser: { color: colors.accentText },
  textAssistant: { color: colors.text },
  status: { fontSize: 11, color: colors.accentText, alignSelf: 'flex-end', marginTop: 2 },
});

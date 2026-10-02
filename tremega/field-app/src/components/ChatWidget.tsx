// src/components/ChatWidget.tsx — floating 💬 bubble + full-screen chat modal.
// Mounted once in app/(gc)/_layout.tsx so it floats above every tab.
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useChat } from '../hooks/useChat';
import { useWorkOrders } from '../stores/workOrders';
import { MessageBubble } from './MessageBubble';
import { QuickActionBar } from './QuickActionBar';
import { ApprovalCard } from './ApprovalCard';
import { ThinkingDots } from './ThinkingDots';
import { colors, spacing, typography } from '../lib/theme';

export function ChatWidget() {
  const { items } = useWorkOrders();
  const projectId = useMemo(
    () => (items.find((w) => w.status !== 'completed') ?? items[0])?.id ?? null,
    [items],
  );
  const chat = useChat(projectId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  const sendDraft = () => {
    const text = draft;
    setDraft('');
    chat.send(text);
  };

  const scrollToEnd = () => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <>
      {/* Floating bubble */}
      <Pressable
        style={styles.fab}
        onPress={() => chat.setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Open Claude chat${chat.unread > 0 ? `, ${chat.unread} unread` : ''}`}
        testID="chat-fab"
      >
        <Text style={styles.fabGlyph}>💬</Text>
        {chat.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{chat.unread > 9 ? '9+' : chat.unread}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={chat.isOpen} animationType="slide" onRequestClose={() => chat.setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={typography.heading}>Claude</Text>
              <Text style={typography.dim}>
                {projectId ? 'Job-linked assistant' : 'No active project'}
              </Text>
            </View>
            {chat.approvals.length > 0 && (
              <View style={styles.pendingPill}>
                <Text style={styles.pendingText}>{chat.approvals.length} pending</Text>
              </View>
            )}
            <Pressable style={styles.closeBtn} onPress={() => chat.setOpen(false)} hitSlop={12}>
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <FlatList
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={chat.messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            onContentSizeChange={scrollToEnd}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyGlyph}>🤖</Text>
                <Text style={typography.title}>Ask Claude</Text>
                <Text style={[typography.dim, { textAlign: 'center', marginTop: spacing.sm }]}>
                  Order materials, get today's status, or draft an estimate — approvals show up right here.
                </Text>
                <View style={{ marginTop: spacing.lg }}>
                  <QuickActionBar
                    disabled={chat.sending || !projectId}
                    onPick={(text) => { chat.send(text); }}
                  />
                </View>
              </View>
            }
            ListFooterComponent={
              chat.approvals.length > 0 ? (
                <View style={styles.approvals}>
                  {chat.approvals.map((a) => (
                    <ApprovalCard
                      key={a.id}
                      approval={a}
                      busy={chat.decidingId === a.id}
                      onApprove={chat.approve}
                      onReject={chat.reject}
                    />
                  ))}
                </View>
              ) : null
            }
          />

          {chat.sending && <ThinkingDots />}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder={projectId ? 'Message Claude…' : 'No active project — chat disabled'}
              placeholderTextColor={colors.textDim}
              value={draft}
              onChangeText={setDraft}
              editable={Boolean(projectId)}
              multiline
              onSubmitEditing={sendDraft}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendBtn, (!draft.trim() || chat.sending || !projectId) && { opacity: 0.4 }]}
              disabled={!draft.trim() || chat.sending || !projectId}
              onPress={sendDraft}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              testID="chat-send"
            >
              <Text style={styles.sendGlyph}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 84, // above the tab bar
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabGlyph: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.accentText, fontSize: 11, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  pendingPill: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  pendingText: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  closeBtn: { padding: spacing.sm },
  closeGlyph: { color: colors.textDim, fontSize: 18 },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyGlyph: { fontSize: 40, marginBottom: spacing.md },
  approvals: { marginTop: spacing.md },
  typing: { ...typography.dim, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopColor: colors.cardBorder,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendGlyph: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
});

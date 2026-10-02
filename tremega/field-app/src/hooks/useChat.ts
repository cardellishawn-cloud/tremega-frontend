// src/hooks/useChat.ts — Claude chat state for the floating bubble.
// POST /api/agent/chat { projectId, message, conversationHistory }
// GET  /api/agent/approvals?status=pending  (polled 30s while modal open)
// POST /api/agent/approvals/:id/approve|reject
//
// Conversation is in-memory for now (session-scoped). Persistence lands
// with the offline slice (AsyncStorage).
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useOfflineQueue } from './useOfflineQueue';
import { isOnline } from '../lib/offline';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'sending' | 'sent' | 'failed' | 'queued';
  queueId?: string;
  createdAt: string;
}

export interface Approval {
  id: string;
  tool_name?: string;
  action_type?: string;
  summary?: string | null;
  input?: Record<string, any>;
  status: string;
  created_at?: string;
}

let nextId = 1;
const mid = () => `m-${Date.now()}-${nextId++}`;

interface ChatState {
  messages: ChatMessage[];
  approvals: Approval[];
  sending: boolean;
  decidingId: string | null;
  unread: number;
  isOpen: boolean;
  queuedCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  setOpen: (open: boolean) => void;
  send: (text: string) => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
}

export function useChat(projectId: string | null): ChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [sending, setSending] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const offlineQueue = useOfflineQueue();

  const setOpen = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open) setUnread(0);
  }, []);

  const fetchApprovals = useCallback(async () => {
    if (!isOnline()) return;
    try {
      const { data } = await api.get('/api/agent/approvals', {
        params: { status: 'pending', ...(projectId ? { projectId } : {}) },
      });
      setApprovals(data.approvals || []);
    } catch { /* keep last known */ }
  }, [projectId]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  // 30s polling while the modal is open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const t = setInterval(fetchApprovals, 30000);
    return () => clearInterval(t);
  }, [isOpen, fetchApprovals]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !projectId) return;
    const userMsg: ChatMessage = {
      id: mid(), role: 'user', content: trimmed, status: 'sending', createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setSending(true);

    const history = [...messages, userMsg].slice(-20).map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data } = await api.post('/api/agent/chat', {
        projectId,
        message: trimmed,
        conversationHistory: history,
      });
      setMessages((m) => m.map((x) => (x.id === userMsg.id ? { ...x, status: 'sent' } : x)));
      const replyText = typeof data.reply === 'string' ? data.reply : JSON.stringify(data.reply ?? data);
      const assistantMsg: ChatMessage = {
        id: mid(), role: 'assistant', content: replyText, createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);
      if (!isOpenRef.current) setUnread((u) => u + 1);
      fetchApprovals();
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err.message || 'Send failed';
      const networkDown = !err?.response || !isOnline();
      if (networkDown) {
        // Offline: queue for auto-send on reconnect.
        const item = await offlineQueue.add({
          type: 'message',
          payload: { projectId, message: trimmed },
          endpoint: '/api/agent/chat',
        });
        setMessages((m) => m.map((x) =>
          (x.id === userMsg.id ? { ...x, status: 'queued' as const, queueId: item.id } : x)));
        setMessages((m) => [...m, {
          id: mid(), role: 'assistant',
          content: '📥 No connection — your message is queued and will send automatically when you\'re back online.',
          createdAt: new Date().toISOString(),
        }]);
      } else {
        setMessages((m) => [
          ...m.map((x) => (x.id === userMsg.id ? { ...x, status: 'failed' as const } : x)),
          { id: mid(), role: 'assistant', content: `⚠️ ${detail}`, createdAt: new Date().toISOString() },
        ]);
      }
    } finally {
      setSending(false);
    }
  }, [messages, sending, projectId, fetchApprovals, offlineQueue]);

  // Replay completed queue items: mark queued messages sent + append replies.
  const lastSyncRef = useRef(0);
  useEffect(() => {
    if (offlineQueue.isSyncing) {
      lastSyncRef.current = Date.now();
      return;
    }
    if (lastSyncRef.current === 0) return;
    const syncedIds = new Set(offlineQueue.queue.map((q) => q.id));
    setMessages((m) => m.map((x) =>
      (x.status === 'queued' && x.queueId && !syncedIds.has(x.queueId)
        ? { ...x, status: 'sent' as const }
        : x)));
  }, [offlineQueue.isSyncing, offlineQueue.queue]);

  const decide = useCallback(async (id: string, action: 'approve' | 'reject', reason?: string) => {
    if (decidingId) return;
    setDecidingId(id);
    try {
      const { data } = await api.post(`/api/agent/approvals/${id}/${action}`,
        action === 'reject' ? { reason: reason || undefined } : undefined);
      setApprovals((a) => a.filter((x) => x.id !== id));
      const note = action === 'approve'
        ? '✅ Approved.'
        : `❌ Rejected${reason ? `: ${reason}` : '.'}`;
      const toolLabel = data?.approval?.tool_name || data?.approval?.action_type || 'request';
      setMessages((m) => [...m, {
        id: mid(), role: 'assistant', content: `${note} (${toolLabel})`, createdAt: new Date().toISOString(),
      }]);
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err.message || 'Decision failed';
      setMessages((m) => [...m, {
        id: mid(), role: 'assistant', content: `⚠️ ${detail}`, createdAt: new Date().toISOString(),
      }]);
    } finally {
      setDecidingId(null);
    }
  }, [decidingId]);

  const approve = useCallback((id: string) => decide(id, 'approve'), [decide]);
  const reject = useCallback((id: string, reason?: string) => decide(id, 'reject', reason), [decide]);

  return {
    messages, approvals, sending, decidingId, unread, isOpen, setOpen, send, approve, reject,
    queuedCount: offlineQueue.queue.length,
    isSyncing: offlineQueue.isSyncing,
    isOnline: offlineQueue.isOnline,
  };
}

// app/(gc)/job/[id].tsx — job detail: GPS check-in + status transitions
// (assigned -> in_progress -> completed) backed by /api/work-orders and
// /api/checkins (project_id = work order id).
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Checkin, useWorkOrders } from '../../../src/stores/workOrders';
import { colors, spacing, touch, typography } from '../../../src/lib/theme';

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_COLOR: Record<string, string> = {
  assigned: colors.info,
  in_progress: colors.accent,
  completed: colors.success,
};

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    items, fetchAll, advance, checkin, checkinsFor,
  } = useWorkOrders();
  const job = items.find((w) => w.id === id);

  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!job) { fetchAll().catch(() => {}); }
  }, [job, fetchAll]);

  const loadCheckins = useCallback(async () => {
    try {
      const rows = await checkinsFor(id);
      setCheckins(rows);
    } catch { /* non-fatal — list stays empty */ }
  }, [id, checkinsFor]);

  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  const errMsg = (err: any, fallback: string) => {
    const d = err?.response?.data;
    return d?.error?.message || d?.error || d?.errors?.[0]?.msg || fallback;
  };

  const onAdvance = async (status: 'in_progress' | 'completed') => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await advance(id, status);
      setNotice(status === 'in_progress' ? 'Work started.' : 'Job marked complete.');
    } catch (err: any) {
      setError(errMsg(err, 'Could not update status.'));
    } finally {
      setBusy(false);
    }
  };

  const onCheckin = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Location permission denied — cannot check in.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const result = await checkin(id, pos.coords.latitude, pos.coords.longitude);
      const v = result?.verification;
      const msg = v?.verified === true
        ? 'Checked in — verified inside the geofence.'
        : v?.verified === false
          ? 'Checked in — OUTSIDE the geofence (flagged for review).'
          : 'Checked in (no geofence configured for this job).';
      setNotice(msg);
      await loadCheckins();
    } catch (err: any) {
      setError(errMsg(err, 'Check-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (!job) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const statusColor = STATUS_COLOR[job.status] || colors.info;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{job.title}</Text>
      {job.job_address ? <Text style={styles.addr}>{job.job_address}</Text> : null}

      <View style={[styles.chip, { borderColor: statusColor }]}>
        <Text style={[styles.chipText, { color: statusColor }]}>
          {(STATUS_LABEL[job.status] || job.status).toUpperCase()}
        </Text>
      </View>

      {job.start_time ? (
        <Text style={styles.meta}>Started: {new Date(job.start_time).toLocaleString()}</Text>
      ) : null}
      {job.completed_at ? (
        <Text style={styles.meta}>Completed: {new Date(job.completed_at).toLocaleString()}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice && !error ? <Text style={styles.notice}>{notice}</Text> : null}

      {job.status !== 'completed' ? (
        <Pressable
          style={({ pressed }) => [styles.button, (busy || pressed) && styles.buttonDim]}
          onPress={onCheckin}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? '…' : 'CHECK IN ON SITE'}</Text>
        </Pressable>
      ) : null}

      {job.status === 'assigned' ? (
        <Pressable
          style={({ pressed }) => [styles.button, styles.buttonSecondary, (busy || pressed) && styles.buttonDim]}
          onPress={() => onAdvance('in_progress')}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? '…' : 'START WORK'}</Text>
        </Pressable>
      ) : null}

      {job.status === 'in_progress' ? (
        <Pressable
          style={({ pressed }) => [styles.button, styles.buttonSuccess, (busy || pressed) && styles.buttonDim]}
          onPress={() => onAdvance('completed')}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? '…' : 'MARK COMPLETE'}</Text>
        </Pressable>
      ) : null}

      {job.status === 'completed' ? (
        <Text style={styles.done}>This job is complete. Nice work.</Text>
      ) : null}

      <Text style={styles.section}>Check-ins ({checkins.length})</Text>
      {checkins.length === 0 ? (
        <Text style={styles.meta}>No check-ins yet.</Text>
      ) : (
        checkins.map((c) => (
          <View key={c.id} style={styles.checkinRow}>
            <Text style={styles.checkinWhen}>{new Date(c.created_at).toLocaleString()}</Text>
            <Text style={styles.checkinStatus}>
              {c.verification_status || 'recorded'}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { ...typography.title },
  addr: { ...typography.dim, marginTop: spacing.xs },
  chip: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.md,
  },
  chipText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  meta: { ...typography.dim, marginTop: spacing.sm },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.md },
  notice: { ...typography.body, color: colors.success, marginTop: spacing.md },
  button: {
    backgroundColor: colors.accent, borderRadius: touch.buttonRadius,
    minHeight: touch.minTarget, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.lg,
  },
  buttonSecondary: { backgroundColor: colors.info },
  buttonSuccess: { backgroundColor: colors.success },
  buttonDim: { opacity: 0.6 },
  buttonText: { color: colors.accentText, fontSize: 17, fontWeight: '700', letterSpacing: 1 },
  done: { ...typography.heading, color: colors.success, marginTop: spacing.lg },
  section: { ...typography.heading, marginTop: spacing.xl, marginBottom: spacing.sm },
  checkinRow: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm,
  },
  checkinWhen: { ...typography.body },
  checkinStatus: { ...typography.dim, marginTop: spacing.xs },
});

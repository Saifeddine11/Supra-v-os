/**
 * Nouvelle tâche — admin / project_manager only (same roles as the web's
 * task-creation UI for full-scope creation; RLS enforces server-side).
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import {
  createTask,
  useClientOptions,
  useEmployeeOptions,
} from '@/hooks/useCreateTask';
import { isAdminOrPM } from '@/lib/roles';
import { PRIORITY_MAP, formatDateTime } from '@/lib/task-meta';
import { Card, ErrorBanner, PrimaryButton } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import type { TaskPriority } from '@/types/db';

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

export default function NewTaskScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, employee } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [pickerStep, setPickerStep] = useState<'date' | 'time' | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { clients } = useClientOptions(clientSearch);
  const { employees } = useEmployeeOptions();

  if (!session || !employee) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isAdminOrPM(employee.role)) {
    return <Redirect href="/(tabs)/tasks" />;
  }

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onPickerChange = (_event: unknown, picked?: Date) => {
    if (!picked) {
      setPickerStep(null);
      return;
    }
    if (pickerStep === 'date') {
      const next = new Date(picked);
      // Keep previously chosen time, default 18:00 otherwise.
      next.setHours(deadline?.getHours() ?? 18, deadline?.getMinutes() ?? 0, 0, 0);
      setDeadline(next);
      setPickerStep(Platform.OS === 'android' ? 'time' : null);
    } else if (pickerStep === 'time') {
      const next = new Date(deadline ?? picked);
      next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      setDeadline(next);
      setPickerStep(null);
    }
  };

  const onSubmit = async () => {
    if (submitting) return;
    setFormError(null);
    setSubmitting(true);
    const { error } = await createTask(
      { title, description, deadline, priority, clientId, assigneeIds },
      employee.full_name ?? null,
    );
    setSubmitting(false);
    if (error) {
      setFormError(error);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/tasks');
    }, 700);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/tasks'))}
          style={styles.backButton}
          hitSlop={8}
        >
          <Text style={styles.backText}>‹ Annuler</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Nouvelle tâche</Text>

        {formError ? <ErrorBanner message={formError} /> : null}
        {success ? (
          <Card style={styles.successCard}>
            <Text style={styles.successText}>Tâche créée ✓</Text>
          </Card>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Titre *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Titre de la tâche"
            placeholderTextColor={colors.muted}
            editable={!submitting}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Détails (optionnel)"
            placeholderTextColor={colors.muted}
            multiline
            editable={!submitting}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Échéance</Text>
          <View style={styles.deadlineRow}>
            <Pressable
              onPress={() => setPickerStep('date')}
              style={[styles.input, styles.deadlineButton]}
              disabled={submitting}
            >
              <Text style={deadline ? styles.deadlineText : styles.deadlinePlaceholder}>
                {deadline ? formatDateTime(deadline.toISOString()) : 'Choisir une date…'}
              </Text>
            </Pressable>
            {deadline ? (
              <Pressable onPress={() => setDeadline(null)} hitSlop={8} style={styles.clearDate}>
                <Text style={styles.clearDateText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          {deadline && Platform.OS === 'ios' ? (
            <Pressable onPress={() => setPickerStep('time')} hitSlop={6}>
              <Text style={styles.changeTime}>Modifier l’heure</Text>
            </Pressable>
          ) : null}
          {pickerStep ? (
            <DateTimePicker
              value={deadline ?? new Date()}
              mode={pickerStep}
              minimumDate={pickerStep === 'date' ? new Date() : undefined}
              onChange={onPickerChange}
            />
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Priorité</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((p) => {
              const cfg = PRIORITY_MAP[p];
              const active = priority === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  disabled={submitting}
                  style={[
                    styles.chip,
                    active && { backgroundColor: cfg.color, borderColor: cfg.color },
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cfg.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Client</Text>
          <TextInput
            style={styles.input}
            value={clientSearch}
            onChangeText={setClientSearch}
            placeholder="Rechercher un client…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            editable={!submitting}
          />
          <View style={styles.chipRow}>
            {clients.map((c) => {
              const active = clientId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setClientId(active ? null : c.id)}
                  disabled={submitting}
                  style={[styles.chip, active && styles.chipActiveDark]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
            {clients.length === 0 ? (
              <Text style={styles.emptyHint}>Aucun client trouvé.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Assignés</Text>
          <View style={styles.chipRow}>
            {employees.map((e) => {
              const active = assigneeIds.includes(e.id);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => toggleAssignee(e.id)}
                  disabled={submitting}
                  style={[styles.chip, active && styles.chipActiveDark]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {e.full_name}
                  </Text>
                </Pressable>
              );
            })}
            {employees.length === 0 ? (
              <Text style={styles.emptyHint}>Aucun collaborateur disponible.</Text>
            ) : null}
          </View>
        </View>

        <PrimaryButton
          title="Créer la tâche"
          onPress={onSubmit}
          loading={submitting}
          disabled={title.trim().length === 0 || submitting || success}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.offWhite },
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  backButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 16, fontWeight: '600', color: colors.orange },
  container: { paddingHorizontal: spacing.md, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '700', color: colors.black },
  field: { gap: spacing.xs + 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.black },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.black,
  },
  inputMultiline: { minHeight: 90, paddingTop: spacing.sm + 4, textAlignVertical: 'top' },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deadlineButton: { flex: 1, justifyContent: 'center' },
  deadlineText: { fontSize: 15, color: colors.black, fontWeight: '600' },
  deadlinePlaceholder: { fontSize: 15, color: colors.muted },
  clearDate: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearDateText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  changeTime: { fontSize: 13, color: colors.orange, fontWeight: '600', marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipActiveDark: { backgroundColor: colors.black, borderColor: colors.black },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.black },
  chipTextActive: { color: colors.white },
  emptyHint: { fontSize: 13, color: colors.muted, paddingVertical: spacing.sm },
  successCard: { borderColor: colors.success, backgroundColor: '#EAF7F0' },
  successText: { color: colors.success, fontWeight: '600', fontSize: 14 },
});

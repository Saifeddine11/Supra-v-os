/**
 * Listes blanches pour filtres issus de searchParams / FormData.
 * Ne jamais passer un nom de colonne ou un tri arbitraire depuis l’URL sans whitelist.
 */

import type {
  InternalPriority,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from '@/types/database';

export const ALLOWED_PROJECT_STATUSES: readonly ProjectStatus[] = [
  'todo',
  'in_progress',
  'waiting_client',
  'waiting_content',
  'review',
  'validated',
  'delivered',
  'archived',
] as const;

export const ALLOWED_TASK_PRIORITIES: readonly TaskPriority[] = ['low', 'normal', 'high', 'urgent'] as const;

export const ALLOWED_TASK_STATUSES: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'waiting_client',
  'review',
  'blocked',
  'done',
  'archived',
] as const;

export const ALLOWED_INTERNAL_PRIORITIES: readonly InternalPriority[] = ['low', 'normal', 'high', 'critical'] as const;

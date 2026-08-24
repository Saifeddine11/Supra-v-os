/**
 * Minimal DB types for the mobile app.
 * Copied (not imported) from the web app's src/types/database.ts so the two
 * apps stay decoupled. Keep in sync manually if the schema evolves.
 */

export type UserRole =
  | 'admin'
  | 'project_manager'
  | 'editor'
  | 'cameraman'
  | 'developer'
  | 'designer'
  | 'seo'
  | 'commercial'
  | 'community_manager'
  | 'finance'
  | 'client';

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'waiting_client'
  | 'waiting_team'
  | 'review'
  | 'blocked'
  | 'done'
  | 'archived';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type VideoStatus =
  | 'idea'
  | 'brief_pending'
  | 'brief_validated'
  | 'shooting_planned'
  | 'shooting_in_progress'
  | 'shooting_done'
  | 'rushes_received'
  | 'editing'
  | 'internal_review'
  | 'sent_to_client'
  | 'client_revision'
  | 'validated'
  | 'published'
  | 'archived'
  | 'cancelled';

export type VideoPublicStatus =
  | 'topic_proposed'
  | 'brief_validated'
  | 'shooting_planned'
  | 'in_production'
  | 'in_editing'
  | 'in_validation'
  | 'revision_requested'
  | 'validated'
  | 'published';

export type VideoFormat =
  | 'reel'
  | 'story'
  | 'tiktok'
  | 'short'
  | 'long_form'
  | 'ad'
  | 'showcase';

export interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  role: UserRole;
  email: string;
  avatar_url: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  is_active: boolean;
  archived_at: string | null;
  must_change_password: boolean;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
}

export interface VideoSummary {
  id: string;
  title: string;
  status: VideoStatus;
  shooting_date: string | null;
  client_delivery_at: string | null;
}

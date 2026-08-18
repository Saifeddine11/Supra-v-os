/**
 * ============================================================================
 * DATABASE TYPES — Auto-generatable from Supabase
 * ============================================================================
 * In production, run:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * This file is the hand-written reference — it MUST stay in sync with
 * supabase/schema.sql. Use it for type safety in server actions, API routes,
 * and React components.
 * ============================================================================
 */

// ─── ENUMS ──────────────────────────────────────────────────────────────────

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

export type ClientStatus = 'prospect' | 'active' | 'pause' | 'terminated';

export type ContractType = 'monthly' | 'one_shot' | 'retainer';

export type ProjectStatus =
  | 'todo'
  | 'in_progress'
  | 'waiting_client'
  | 'waiting_content'
  | 'review'
  | 'validated'
  | 'delivered'
  | 'archived';

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

export type TaskDepartment =
  | 'production_video'
  | 'video_distribution'
  | 'community_management'
  | 'media_buying'
  | 'web_seo';

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

export type VideoPlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'youtube_shorts'
  | 'linkedin'
  | 'facebook'
  | 'ads_meta'
  | 'ads_google'
  | 'website';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'refused'
  | 'expired'
  | 'converted';

export type PaymentMethod =
  | 'bank_transfer'
  | 'cash'
  | 'card'
  | 'check'
  | 'other';

export type NotificationType =
  | 'task_assigned'
  | 'task_overdue'
  | 'task_deadline_approaching'
  | 'deadline_soon'
  | 'client_validated'
  | 'client_revision_requested'
  | 'invoice_overdue'
  | 'invoice_due_soon'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'quote_accepted'
  | 'quote_expiring'
  | 'quote_converted'
  | 'quota_incomplete'
  | 'employee_overloaded'
  | 'employee_task_not_updated'
  | 'report_due'
  | 'comment_added'
  | 'document_uploaded'
  | 'morning_summary'
  | 'evening_summary'
  | 'system'
  | 'critical_alert_reminder';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type DocumentType =
  | 'video_final'
  | 'video_preview'
  | 'mockup'
  | 'logo'
  | 'brand_guide'
  | 'seo_report'
  | 'invoice_pdf'
  | 'quote_pdf'
  | 'contract'
  | 'brief'
  | 'rushes'
  | 'other'
  | 'roadmap';

export type InternalPriority = 'low' | 'normal' | 'high' | 'critical';

export type ReportType =
  | 'weekly'
  | 'monthly'
  | 'project'
  | 'video_production'
  | 'seo'
  | 'social_media';

// ─── TABLE ROW TYPES ────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  role: UserRole;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  is_active: boolean;
  weekly_capacity: number;
  hire_date: string | null;
  notes_internal: string | null;
  /** Discord user snowflake for mentions. Null = no Discord mention. */
  discord_user_id: string | null;
  manager_id: string | null;
  /** Compétences terrain (assignation) — ne remplace pas role pour les permissions. */
  operational_skills: UserRole[];
  archived_at: string | null;
  /** Compte créé avec mot de passe temporaire : redirection obligatoire vers /change-password. */
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  legal_name: string | null;
  sector: string;
  status: ClientStatus;
  contract_type: ContractType;
  primary_contact: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  country: string;
  logo_url: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  /** Couleur marque #RRGGBB (optionnel — fallback stable depuis le nom). */
  color_hex: string | null;
  /** Libellé interne optionnel (ex. « Bleu immobilier »). */
  color_label: string | null;
  services: string[];
  monthly_video_quota: number;
  monthly_fee: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  notes_internal: string | null;
  account_manager_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ClientPortal {
  id: string;
  client_id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Project {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  type: string;
  status: ProjectStatus;
  priority: TaskPriority;
  progress: number;
  lead_id: string | null;
  team_ids: string[];
  start_date: string | null;
  deadline: string | null;
  delivered_at: string | null;
  budget: number | null;
  invoice_id: string | null;
  notes_internal: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface InternalProject {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: ProjectStatus;
  priority: InternalPriority;
  progress: number;
  owner_id: string | null;
  team_ids: string[];
  start_date: string | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  internal_project_id: string | null;
  client_id: string | null;
  video_id: string | null;
  parent_task_id: string | null;
  assignee_id: string | null;
  watcher_ids: string[];
  status: TaskStatus;
  priority: TaskPriority;
  department: TaskDepartment | null;
  progress: number;
  start_date: string | null;
  deadline: string | null;
  completed_at: string | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  checklist: ChecklistItem[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** Rôle dans `video_assignments` (monteur vs cadreur). */
export type VideoAssignmentRole = 'editor' | 'cameraman';

export interface VideoAssignment {
  id: string;
  video_id: string;
  employee_id: string;
  assignment_role: VideoAssignmentRole;
  created_at: string;
  updated_at: string;
}

/** Discord message linkage — not a copy of the task. */
export interface TaskDiscordMessage {
  task_id: string;
  discord_channel_id: string;
  discord_message_id: string;
  last_reminder_at: string | null;
  created_at: string;
  updated_at: string;
}

/** client_id / department null = fallback route. Independent of employees.role. */
export interface DiscordChannelRoute {
  id: string;
  client_id: string | null;
  department: TaskDepartment | null;
  discord_channel_id: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  employee_id: string;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  client_id: string;
  editorial_calendar_id: string | null;
  title: string;
  topic: string | null;
  brief: string | null;
  type: string | null;
  format: VideoFormat | null;
  platform: VideoPlatform | null;
  duration_seconds: number | null;
  status: VideoStatus;
  public_status: VideoPublicStatus;
  priority: TaskPriority;
  cameraman_id: string | null;
  editor_id: string | null;
  /** Date/heure prévues du tournage. */
  shooting_date: string | null;
  /** Date jour seule (legacy) — synchronisée depuis client_delivery_at lors des saves. */
  delivery_deadline: string | null;
  /** Date/heure prévues de livraison ou envoi au client. */
  client_delivery_at: string | null;
  publication_date: string | null;
  preview_url: string | null;
  final_url: string | null;
  rushes_storage_path: string | null;
  client_feedback: string | null;
  revision_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  /** Confirmation « tournage fait » (passage montage). */
  shooting_completed_at?: string | null;
  shooting_started_at?: string | null;
  shooting_expected_end_at?: string | null;
  /** Dernier report de tournage. */
  shooting_postponed_at?: string | null;
  shooting_postponed_reason?: string | null;
  shooting_postponed_note?: string | null;
}

export interface VideoShootingEvent {
  id: string;
  video_id: string;
  event_type: 'confirmed' | 'postponed' | 'in_progress';
  old_shooting_at: string | null;
  new_shooting_at: string | null;
  expected_end_at?: string | null;
  reason: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EditorialCalendar {
  id: string;
  client_id: string;
  month: string; // ISO date — first of month
  quota: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoTemplate {
  id: string;
  sector: string;
  title: string;
  description: string | null;
  format: VideoFormat | null;
  duration_seconds: number | null;
  brief_template: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentIdea {
  id: string;
  client_id: string | null;
  sector: string | null;
  title: string;
  description: string | null;
  format: VideoFormat | null;
  platform: VideoPlatform | null;
  estimated_duration: number | null;
  is_used: boolean;
  used_video_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Invoice {
  id: string;
  client_id: string;
  ref: string;
  issue_date: string;
  due_date: string;
  sent_at: string | null;
  paid_at: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  currency: string;
  notes: string | null;
  payment_terms: string | null;
  template: string;
  pdf_url: string | null;
  pdf_storage_path: string | null;
  visible_to_client: boolean;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number;
  created_at: string;
}

/** Strategic blocks rendered in proposal PDF (French copy). */
export interface QuoteStrategicBlock {
  title: string;
  body: string;
}

export type QuoteDiscountMode = 'fixed' | 'percent';

export interface Quote {
  id: string;
  client_id: string;
  ref: string;
  issue_date: string;
  valid_until: string;
  sent_at: string | null;
  decided_at: string | null;
  status: QuoteStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  currency: string;
  /** Internal — not exposed on client PDF or portal. */
  notes: string | null;
  conditions: string | null;
  /** PDF template key; extend later (e.g. minimal_white). */
  template: string;
  proposal_title: string | null;
  package_name: string | null;
  project_object: string | null;
  strategic_positioning: string | null;
  commercial_recommendation: string | null;
  execution_assumptions: string | null;
  strategic_value_blocks: QuoteStrategicBlock[];
  promotional_label: string | null;
  promotional_terms: string | null;
  discount_mode: QuoteDiscountMode;
  discount_percent: number | null;
  first_month_total: number | null;
  recurring_monthly_total: number | null;
  commitment_months: number | null;
  ads_budget_note: string | null;
  maintenance_note: string | null;
  revision_policy_note: string | null;
  payment_terms: string | null;
  include_signature_block: boolean;
  pdf_url: string | null;
  pdf_storage_path: string | null;
  converted_invoice_id: string | null;
  visible_to_client: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  position: number;
  description: string;
  service_name: string;
  detail_text: string | null;
  strategic_explanation: string | null;
  is_optional: boolean;
  is_recommended: boolean;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  client_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ReportHighlight {
  title: string;
  description: string;
}

export interface Report {
  id: string;
  client_id: string;
  type: ReportType;
  title: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  highlights: ReportHighlight[];
  metrics: Record<string, number>;
  next_actions: string | null;
  recommendations: string | null;
  pdf_url: string | null;
  pdf_storage_path: string | null;
  whatsapp_text: string | null;
  visible_to_client: boolean;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DocumentRecord {
  id: string;
  client_id: string | null;
  project_id: string | null;
  video_id: string | null;
  name: string;
  type: DocumentType;
  description: string | null;
  file_url: string | null;
  file_storage_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_link: string | null;
  visible_to_client: boolean;
  archived_at: string | null;
  period_start: string | null;
  period_end: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

/** Objectif mensuel agence (table agency_monthly_goals). */
export interface AgencyMonthlyGoalRow {
  id: string;
  year: number;
  month: number;
  revenue_goal: number;
  client_goal: number | null;
  video_goal: number | null;
  task_goal: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  recipient_user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  link_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Comment {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgencySettingsRow {
  id: number;
  agency_name: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  tax_id: string | null;
  invoice_prefix: string | null;
  quote_prefix: string | null;
  default_currency: string | null;
  default_payment_terms: string | null;
  default_tax_rate: number | null;
  portal_base_url: string | null;
  portal_show_branding: boolean;
  updated_at: string;
}

export type NotificationSoundVolume = 'low' | 'medium' | 'high';

export interface UserNotificationPreferencesRow {
  user_id: string;
  email_reminders_enabled: boolean;
  morning_reminder_enabled: boolean;
  evening_summary_enabled: boolean;
  deadline_alerts_enabled: boolean;
  notification_sound_enabled: boolean;
  notification_sound_urgent_only: boolean;
  notification_sound_volume: NotificationSoundVolume;
  updated_at: string;
}

// ─── DATABASE TYPE (Supabase shape) ─────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: Employee;
        Insert: Partial<Employee>;
        Update: Partial<Employee>;
        Relationships: [];
      };
      clients: {
        Row: Client;
        Insert: Partial<Client> & { name: string; sector: string };
        Update: Partial<Client>;
        Relationships: [];
      };
      client_portals: {
        Row: ClientPortal;
        Insert: Partial<ClientPortal>;
        Update: Partial<ClientPortal>;
        Relationships: [];
      };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project>; Relationships: [] };
      internal_projects: {
        Row: InternalProject;
        Insert: Partial<InternalProject>;
        Update: Partial<InternalProject>;
        Relationships: [];
      };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task>; Relationships: [] };
      task_assignments: {
        Row: TaskAssignment;
        Insert: Partial<TaskAssignment> & { task_id: string; employee_id: string };
        Update: Partial<TaskAssignment>;
        Relationships: [];
      };
      task_discord_messages: {
        Row: TaskDiscordMessage;
        Insert: Partial<TaskDiscordMessage> & {
          task_id: string;
          discord_channel_id: string;
          discord_message_id: string;
        };
        Update: Partial<TaskDiscordMessage>;
        Relationships: [];
      };
      discord_channel_routes: {
        Row: DiscordChannelRoute;
        Insert: Partial<DiscordChannelRoute> & { discord_channel_id: string };
        Update: Partial<DiscordChannelRoute>;
        Relationships: [];
      };
      videos: { Row: Video; Insert: Partial<Video>; Update: Partial<Video>; Relationships: [] };
      video_assignments: {
        Row: VideoAssignment;
        Insert: Partial<VideoAssignment> & { video_id: string; employee_id: string; assignment_role: VideoAssignmentRole };
        Update: Partial<VideoAssignment>;
        Relationships: [];
      };
      editorial_calendars: {
        Row: EditorialCalendar;
        Insert: Partial<EditorialCalendar>;
        Update: Partial<EditorialCalendar>;
        Relationships: [];
      };
      video_templates: {
        Row: VideoTemplate;
        Insert: Partial<VideoTemplate>;
        Update: Partial<VideoTemplate>;
        Relationships: [];
      };
      content_ideas: {
        Row: ContentIdea;
        Insert: Partial<ContentIdea>;
        Update: Partial<ContentIdea>;
        Relationships: [];
      };
      invoices: { Row: Invoice; Insert: Partial<Invoice>; Update: Partial<Invoice>; Relationships: [] };
      invoice_items: {
        Row: InvoiceItem;
        Insert: Partial<InvoiceItem>;
        Update: Partial<InvoiceItem>;
        Relationships: [];
      };
      quotes: { Row: Quote; Insert: Partial<Quote>; Update: Partial<Quote>; Relationships: [] };
      quote_items: {
        Row: QuoteItem;
        Insert: Partial<QuoteItem>;
        Update: Partial<QuoteItem>;
        Relationships: [];
      };
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment>; Relationships: [] };
      reports: { Row: Report; Insert: Partial<Report>; Update: Partial<Report>; Relationships: [] };
      documents: {
        Row: DocumentRecord;
        Insert: Partial<DocumentRecord>;
        Update: Partial<DocumentRecord>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Partial<Notification>;
        Update: Partial<Notification>;
        Relationships: [];
      };
      comments: { Row: Comment; Insert: Partial<Comment>; Update: Partial<Comment>; Relationships: [] };
      activity_logs: {
        Row: ActivityLog;
        Insert: Partial<ActivityLog>;
        Update: Partial<ActivityLog>;
        Relationships: [];
      };
      agency_settings: {
        Row: AgencySettingsRow;
        Insert: Partial<AgencySettingsRow>;
        Update: Partial<AgencySettingsRow>;
        Relationships: [];
      };
      agency_monthly_goals: {
        Row: AgencyMonthlyGoalRow;
        Insert: Partial<AgencyMonthlyGoalRow> & { year: number; month: number };
        Update: Partial<AgencyMonthlyGoalRow>;
        Relationships: [];
      };
      user_notification_preferences: {
        Row: UserNotificationPreferencesRow;
        Insert: Partial<UserNotificationPreferencesRow> & { user_id: string };
        Update: Partial<UserNotificationPreferencesRow>;
        Relationships: [];
      };
    };
    Views: {
      v_employee_workload: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          weekly_capacity: number;
          active_tasks: number;
          urgent_tasks: number;
          overdue_tasks: number;
          estimated_hours: number;
          load_percent: number;
        };
        Relationships: [];
      };
      v_client_editorial_status: {
        Row: {
          client_id: string;
          client_name: string;
          quota: number;
          delivered: number;
          in_progress: number;
          ideas: number;
        };
        Relationships: [];
      };
      v_revenue_summary: {
        Row: {
          month: string;
          paid_count: number;
          pending_count: number;
          overdue_count: number;
          paid_amount: number;
          pending_amount: number;
          overdue_amount: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      next_invoice_ref: { Args: Record<string, never>; Returns: string };
      next_quote_ref: { Args: Record<string, never>; Returns: string };
      mark_overdue_invoices: { Args: Record<string, never>; Returns: void };
    };
    Enums: {
      user_role: UserRole;
      client_status: ClientStatus;
      contract_type: ContractType;
      project_status: ProjectStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      task_department: TaskDepartment;
      video_status: VideoStatus;
      video_public_status: VideoPublicStatus;
      video_format: VideoFormat;
      video_platform: VideoPlatform;
      invoice_status: InvoiceStatus;
      quote_status: QuoteStatus;
      payment_method: PaymentMethod;
      notification_type: NotificationType;
      notification_priority: NotificationPriority;
      document_type: DocumentType;
      internal_priority: InternalPriority;
      report_type: ReportType;
    };
  };
};

// ─── CONVENIENCE COMPOSITE TYPES ────────────────────────────────────────────

/** Invoice with its line items (commonly fetched together) */
export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
  client?: Client;
  payments?: Payment[];
}

/** Quote with its line items */
export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
  client?: Client;
}

/** Client with aggregated stats */
export interface ClientWithStats extends Client {
  active_projects: number;
  videos_this_month: number;
  videos_delivered: number;
  total_revenue: number;
  outstanding_amount: number;
}

/** Task enriched with related entities for UI rendering */
export interface TaskWithRelations extends Task {
  assignee?: Employee;
  client?: Client;
  project?: Project;
}

/** Task list row / kanban card (denormalized names) */
export interface TaskEnriched extends Task {
  /** Libellé court pour listes (ex. « Julien + 2 autres »). */
  assignee_name: string | null;
  /** Assignés effectifs (pivot + repli legacy assignee_id). */
  assignees: { id: string; full_name: string }[];
  client_name: string | null;
  /** Hex résolu (DB ou palette nom) pour pastilles / barres client. */
  client_brand_hex: string | null;
}

/** Video enriched with related entities */
export interface VideoWithRelations extends Video {
  client?: Client;
  editor?: Employee;
  cameraman?: Employee;
}

/** Sanitized video for client portal — strips internal fields */
export interface PortalVideo {
  id: string;
  title: string;
  type: string | null;
  format: VideoFormat | null;
  platform: VideoPlatform | null;
  public_status: VideoPublicStatus;
  shooting_date: string | null;
  delivery_deadline: string | null;
  client_delivery_at: string | null;
  publication_date: string | null;
  preview_url: string | null;
  final_url: string | null;
}

/** Sanitized invoice for client portal */
export interface PortalInvoice {
  id: string;
  ref: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  total: number;
  currency: string;
  pdf_url: string | null;
}

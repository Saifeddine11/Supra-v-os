-- Deliverable 5: extend notification_type for crons and finance flows.
-- Safe to re-run: IF NOT EXISTS (PostgreSQL 9.1+ enum ADD VALUE).

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deadline_soon';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_due_soon';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_sent';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'quote_expiring';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'quote_converted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'employee_task_not_updated';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN notifications.updated_at IS 'Last mutation (e.g. mark read); mirrors app updates.';

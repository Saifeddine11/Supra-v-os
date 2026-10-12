-- New task_status values must be committed before any later migration uses them.
-- Run this statement alone, then run 20260925130918_task_accountability_safe_rules.sql.

alter type public.task_status add value if not exists 'proposed';
alter type public.task_status add value if not exists 'completed_pending_validation';

-- Retrait du workflow « Attente équipe » : réaffecter les tâches existantes vers « Bloqué ».
-- L’enum task_status conserve waiting_team pour compatibilité historique.

UPDATE public.tasks
SET
  status = 'blocked',
  updated_at = now()
WHERE status = 'waiting_team';

-- Rappels digest alertes critiques (cron toutes les 2h) — distinct des lignes métier.
alter type notification_type add value if not exists 'critical_alert_reminder';

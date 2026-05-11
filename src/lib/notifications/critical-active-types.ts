/** Types partagés API / client — sans import `server-only`. */

export type CriticalActiveSeverity = 'critical' | 'warning';

export type CriticalActiveAlertDTO = {
  id: string;
  entityType: string;
  entityId: string;
  severity: CriticalActiveSeverity;
  title: string;
  message: string;
  href: string;
  dueAt: string | null;
};

export type CriticalActiveAlertsResponse = {
  alerts: CriticalActiveAlertDTO[];
  criticalCount: number;
  warningCount: number;
};

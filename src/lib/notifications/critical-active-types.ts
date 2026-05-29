/** Types partagés API / client — sans import `server-only`. */

export type CriticalActiveSeverity = 'critical' | 'warning';

export type CriticalActiveAlertCategory = 'action_required' | 'follow_up' | 'waiting_external';

export type CriticalActiveAlertDTO = {
  id: string;
  entityType: string;
  entityId: string;
  severity: CriticalActiveSeverity;
  category: CriticalActiveAlertCategory;
  title: string;
  message: string;
  href: string;
  dueAt: string | null;
};

export type CriticalActiveAlertTotals = {
  totalActionableCount: number;
  taskOverdueTotalCount: number;
  videoDeliveryTotalCount: number;
  shootingActionTotalCount: number;
  invoiceOverdueTotalCount: number;
};

export type CriticalAlertScopeHint = 'team' | 'personal';

export type CriticalActiveAlertsResponse = {
  alerts: CriticalActiveAlertDTO[];
  allAlerts: CriticalActiveAlertDTO[];
  criticalCount: number;
  warningCount: number;
  totals: CriticalActiveAlertTotals;
  fingerprint: string;
  scopeHint: CriticalAlertScopeHint;
};

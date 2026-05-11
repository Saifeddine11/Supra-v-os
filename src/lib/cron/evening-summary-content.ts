import 'server-only';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { UserRole, VideoPublicStatus } from '@/types/database';
import { effectiveClientDeliveryIso, isVideoDeliveryOverdue } from '@/lib/videos/video-schedule';
import { isTomorrowCalendar } from '@/lib/deadlines/deadline-state';

export type EveningDigestLine = { text: string; url?: string };

export type EveningDigest = {
  recipientFirstName: string;
  dateLabel: string;
  overdue: EveningDigestLine[];
  tomorrow: EveningDigestLine[];
  watch: EveningDigestLine[];
  finance: EveningDigestLine[];
};

export type EveningVideoRow = {
  id: string;
  title: string;
  status: string;
  public_status?: string;
  shooting_date?: string | null;
  client_delivery_at?: string | null;
  delivery_deadline?: string | null;
  editor_id?: string | null;
  cameraman_id?: string | null;
  clients?: { name?: string } | null;
};

function employeeOnVideo(
  empId: string,
  v: EveningVideoRow,
  va: Map<string, { employee_id: string; assignment_role: string }[]>,
): { editor: boolean; cameraman: boolean } {
  let editor = v.editor_id === empId;
  let cameraman = v.cameraman_id === empId;
  for (const r of va.get(v.id) ?? []) {
    if (r.employee_id !== empId) continue;
    if (r.assignment_role === 'editor') editor = true;
    if (r.assignment_role === 'cameraman') cameraman = true;
  }
  return { editor, cameraman };
}

function seesAllProduction(role: UserRole): boolean {
  return role === 'admin' || role === 'project_manager';
}

function seesFinanceDigest(role: UserRole): boolean {
  return role === 'admin' || role === 'finance';
}

export function buildEveningDigestForEmployee(opts: {
  emp: { id: string; full_name: string; role: UserRole };
  tasks: { id: string; title: string; status: string; deadline: string | null }[];
  videos: EveningVideoRow[];
  videoAssignByVideo: Map<string, { employee_id: string; assignment_role: string }[]>;
  overdueInvoiceCount: number;
  now: Date;
  baseUrl: string;
}): EveningDigest {
  const { emp, tasks, videos, videoAssignByVideo, overdueInvoiceCount, now, baseUrl } = opts;
  const recipientFirstName = emp.full_name.trim().split(/\s+/)[0] ?? emp.full_name;
  const dateLabel = format(now, 'EEEE d MMMM yyyy', { locale: fr });
  const tomorrowStr = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10);

  const remaining = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived');
  const overdueTasks = remaining.filter((t) => t.deadline && new Date(t.deadline) < now);
  const tomorrowTasks = remaining.filter((t) => {
    if (!t.deadline) return false;
    return new Date(t.deadline).toISOString().slice(0, 10) === tomorrowStr;
  });

  const overdue: EveningDigestLine[] = [];
  const tomorrow: EveningDigestLine[] = [];
  const watch: EveningDigestLine[] = [];
  const finance: EveningDigestLine[] = [];

  for (const t of overdueTasks.slice(0, 14)) {
    overdue.push({ text: `Tâche en retard — ${t.title}`, url: `${baseUrl}/tasks` });
  }

  for (const t of tomorrowTasks.slice(0, 12)) {
    tomorrow.push({ text: `Tâche — ${t.title}`, url: `${baseUrl}/tasks` });
  }

  const allProd = seesAllProduction(emp.role);
  const overdueVideosSeen = new Set<string>();

  for (const v of videos) {
    const roles = employeeOnVideo(emp.id, v, videoAssignByVideo);
    const canSeeVideo =
      allProd || roles.editor || roles.cameraman || emp.role === 'community_manager';

    if (!canSeeVideo) continue;

    const client = v.clients?.name ? ` · ${v.clients.name}` : '';

    if (
      isVideoDeliveryOverdue({
        status: v.status,
        public_status: (v.public_status ?? 'topic_proposed') as VideoPublicStatus,
        client_delivery_at: v.client_delivery_at ?? null,
        delivery_deadline: v.delivery_deadline ?? null,
      })
    ) {
      if (allProd || roles.editor || emp.role === 'community_manager') {
        if (!overdueVideosSeen.has(v.id)) {
          overdueVideosSeen.add(v.id);
          overdue.push({
            text: `Livraison vidéo en retard — ${v.title}${client}`,
            url: `${baseUrl}/videos`,
          });
        }
      }
    }

    const shoot = v.shooting_date;
    if (
      shoot &&
      isTomorrowCalendar(shoot, now) &&
      (allProd || roles.cameraman || roles.editor || emp.role === 'community_manager')
    ) {
      tomorrow.push({
        text: `Tournage demain — ${v.title}${client}`,
        url: `${baseUrl}/videos`,
      });
    }

    const del = effectiveClientDeliveryIso({
      client_delivery_at: v.client_delivery_at ?? null,
      delivery_deadline: v.delivery_deadline ?? null,
    });
    if (
      del &&
      isTomorrowCalendar(del, now) &&
      (allProd || roles.editor || emp.role === 'community_manager')
    ) {
      tomorrow.push({
        text: `Livraison demain — ${v.title}${client}`,
        url: `${baseUrl}/videos`,
      });
    }

    if (
      (v.status === 'sent_to_client' || v.public_status === 'in_validation') &&
      (allProd || roles.editor || emp.role === 'community_manager')
    ) {
      watch.push({
        text: `Validation client — ${v.title}${client}`,
        url: `${baseUrl}/videos`,
      });
    }
  }

  if (seesFinanceDigest(emp.role) && overdueInvoiceCount > 0) {
    finance.push({
      text: `${overdueInvoiceCount} facture(s) en retard à traiter`,
      url: `${baseUrl}/invoices`,
    });
  }

  if (emp.role === 'commercial') {
    watch.push({
      text: 'Pensez à relancer les devis envoyés et les prospects à jour cette semaine.',
      url: `${baseUrl}/quotes`,
    });
  }

  return {
    recipientFirstName,
    dateLabel,
    overdue,
    tomorrow,
    watch: watch.slice(0, 12),
    finance,
  };
}

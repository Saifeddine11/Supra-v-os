import 'server-only';

import type { AiMyOperationalWorkPayload, AiTaskContextItem, AiVideoContextItem } from '@/lib/ai/context-schema';
import { SUPAI_EMPTY_ASSIGNED_WORK } from '@/lib/ai/supai-copy';

function formatDeadline(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function formatDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(d);
}

function taskAction(task: AiTaskContextItem): string {
  if (task.isOverdue) return 'traiter en priorité — échéance dépassée.';
  if (task.isDueToday) return 'finaliser aujourd’hui.';
  if (task.priority === 'urgent' || task.priority === 'high') {
    return 'avancer rapidement sur cette priorité.';
  }
  return 'poursuivre et mettre à jour le statut si besoin.';
}

function videoAction(video: AiVideoContextItem): string {
  if (video.roleOnVideo?.includes('cadreur') || video.roleOnVideo?.includes('Cameraman')) {
    return 'confirmer le tournage ou transmettre les rushes.';
  }
  if (video.productionStatus.toLowerCase().includes('montage')) {
    return 'finaliser le montage et préparer l’envoi en révision.';
  }
  return 'suivre la production et les prochaines étapes.';
}

function renderTask(task: AiTaskContextItem, index: number): string {
  const lines = [
    `${index}. ${task.title}${task.clientName ? ` — ${task.clientName}` : ''}`,
    `   Statut : ${task.statusLabel}`,
  ];
  const deadline = formatDeadline(task.deadline);
  if (deadline) lines.push(`   Échéance : ${deadline}`);
  if (task.priorityLabel) lines.push(`   Priorité : ${task.priorityLabel}`);
  lines.push(`   Action recommandée : ${taskAction(task)}`);
  lines.push(`   Voir la tâche : ${task.href}`);
  return lines.join('\n');
}

function renderVideo(video: AiVideoContextItem, index: number): string {
  const lines = [
    `${index}. ${video.title}${video.clientName ? ` — ${video.clientName}` : ''}`,
    `   Statut vidéo : ${video.productionStatus}`,
  ];
  if (video.roleOnVideo) lines.push(`   Votre rôle : ${video.roleOnVideo}`);
  const shooting = formatDateOnly(video.shootingDate);
  const delivery = formatDateOnly(video.deliveryDate);
  if (shooting) lines.push(`   Tournage : ${shooting}`);
  if (delivery) lines.push(`   Livraison client : ${delivery}`);
  lines.push(`   Action recommandée : ${videoAction(video)}`);
  lines.push(`   Voir la vidéo : ${video.href}`);
  return lines.join('\n');
}

export function buildMyWorkReply(payload: AiMyOperationalWorkPayload): string {
  const hasContent =
    payload.tasks.length > 0 ||
    payload.videos.length > 0 ||
    payload.overdueTasks.length > 0 ||
    payload.dueTodayTasks.length > 0 ||
    payload.shootingsToday.length > 0 ||
    payload.deliveriesToday.length > 0;

  if (!hasContent) return SUPAI_EMPTY_ASSIGNED_WORK;

  const sections: string[] = ['Voici ce que vous avez à traiter :', ''];
  let itemIndex = 1;

  const overdueIds = new Set(payload.overdueTasks.map((t) => t.id));
  const todayIds = new Set(payload.dueTodayTasks.map((t) => t.id));
  const renderedTaskIds = new Set<string>();
  const renderedVideoIds = new Set<string>();

  const overdueTasks = payload.overdueTasks.length
    ? payload.overdueTasks
    : payload.tasks.filter((t) => t.isOverdue);
  const todayTasks = payload.dueTodayTasks.length
    ? payload.dueTodayTasks
    : payload.tasks.filter((t) => t.isDueToday && !t.isOverdue);

  if (overdueTasks.length) {
    sections.push('Urgent / en retard', '');
    for (const task of overdueTasks) {
      sections.push(renderTask(task, itemIndex++));
      renderedTaskIds.add(task.id);
      sections.push('');
    }
  }

  if (todayTasks.length) {
    sections.push('Aujourd’hui', '');
    for (const task of todayTasks) {
      if (renderedTaskIds.has(task.id)) continue;
      sections.push(renderTask(task, itemIndex++));
      renderedTaskIds.add(task.id);
      sections.push('');
    }
    for (const video of payload.shootingsToday) {
      if (renderedVideoIds.has(video.id)) continue;
      sections.push(renderVideo(video, itemIndex++));
      renderedVideoIds.add(video.id);
      sections.push('');
    }
    for (const video of payload.deliveriesToday) {
      if (renderedVideoIds.has(video.id)) continue;
      sections.push(renderVideo(video, itemIndex++));
      renderedVideoIds.add(video.id);
      sections.push('');
    }
  }

  const followTasks = payload.tasks.filter(
    (t) => !renderedTaskIds.has(t.id) && !overdueIds.has(t.id) && !todayIds.has(t.id),
  );
  if (followTasks.length) {
    sections.push('À suivre', '');
    for (const task of followTasks) {
      sections.push(renderTask(task, itemIndex++));
      sections.push('');
    }
  }

  const followVideos = payload.videos.filter((v) => !renderedVideoIds.has(v.id));
  if (followVideos.length) {
    sections.push('Vidéos / tournages / montages', '');
    for (const video of followVideos) {
      sections.push(renderVideo(video, itemIndex++));
      sections.push('');
    }
  }

  return sections.join('\n').trim();
}

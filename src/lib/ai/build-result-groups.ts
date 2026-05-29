import 'server-only';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type {
  AiMyOperationalWorkPayload,
  AiScopedCalendarPayload,
  AiTaskContextItem,
  AiVideoContextItem,
} from '@/lib/ai/context-schema';
import type { SupaiResultGroup, SupaiStructuredOperationalResponse } from '@/lib/ai/result-groups-schema';
import {
  SUPAI_EMPTY_ASSIGNED_WORK,
  SUPAI_EMPTY_CALENDAR_GLOBAL,
  SUPAI_EMPTY_CALENDAR_PERSONAL,
} from '@/lib/ai/supai-copy';

function splitTeamNames(value: string | null | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  const parts = value.split(/\s*·\s*|\s*,\s*|\s+et\s+/i).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

function mapTaskItem(task: AiTaskContextItem) {
  return {
    id: task.id,
    title: task.title,
    clientName: task.clientName,
    status: task.statusLabel,
    priority: task.priorityLabel,
    deadline: task.deadline,
    isOverdue: task.isOverdue,
    assigneeNames: task.assigneeNames,
    href: task.href,
  };
}

function mapVideoItem(video: AiVideoContextItem) {
  const team = splitTeamNames(video.teamNames);
  return {
    id: video.id,
    title: video.title,
    clientName: video.clientName,
    productionStatus: video.productionStatus,
    shootingDate: video.shootingDate,
    deliveryDate: video.deliveryDate,
    editorNames: team?.[0] ?? null,
    cameramanNames: team?.[1] ?? null,
    teamNames: team,
    href: video.href,
  };
}

function mapShootingFromCalendar(
  shoot: AiScopedCalendarPayload['shootings'][number],
) {
  return {
    id: shoot.videoId,
    videoId: shoot.videoId,
    title: shoot.title,
    clientName: shoot.clientName,
    shootingDate: shoot.at,
    date: shoot.at,
    teamNames: splitTeamNames(shoot.teamNames),
    productionStatus: shoot.status,
    href: shoot.href,
  };
}

function mapDeliveryFromCalendar(
  delivery: AiScopedCalendarPayload['deliveries'][number],
) {
  return {
    id: delivery.videoId,
    videoId: delivery.videoId,
    title: delivery.title,
    clientName: delivery.clientName,
    deliveryDate: delivery.at,
    date: delivery.at,
    productionStatus: delivery.status,
    href: delivery.href,
  };
}

function mapShootingFromVideo(video: AiVideoContextItem) {
  return {
    id: video.id,
    videoId: video.id,
    title: video.title,
    clientName: video.clientName,
    shootingDate: video.shootingDate,
    date: video.shootingDate,
    teamNames: splitTeamNames(video.teamNames),
    productionStatus: video.productionStatus,
    href: video.href,
  };
}

function mapDeliveryFromVideo(video: AiVideoContextItem) {
  return {
    id: video.id,
    videoId: video.id,
    title: video.title,
    clientName: video.clientName,
    deliveryDate: video.deliveryDate,
    date: video.deliveryDate,
    productionStatus: video.productionStatus,
    href: video.href,
  };
}

function calendarIntro(payload: AiScopedCalendarPayload): string {
  const label = payload.periodLabel.trim().toLowerCase();
  if (label.includes('tournage')) {
    return payload.scopeMode === 'global'
      ? 'Voici les tournages à venir dans le calendrier opérationnel de l’équipe.'
      : 'Voici les tournages à venir dans votre périmètre.';
  }
  if (label.includes('livraison')) {
    return payload.scopeMode === 'global'
      ? 'Voici les livraisons client prévues dans le calendrier opérationnel.'
      : 'Voici les livraisons client prévues dans votre périmètre.';
  }

  if (
    label === "aujourd'hui" ||
    label === 'demain' ||
    label.startsWith('cette ') ||
    label.startsWith('la semaine') ||
    label.startsWith('ce mois') ||
    label.startsWith('le mois')
  ) {
    return payload.scopeMode === 'global'
      ? `Voici le calendrier opérationnel pour ${payload.periodLabel}.`
      : `Voici ce qui est prévu dans votre périmètre pour ${payload.periodLabel}.`;
  }

  const parsed = new Date(payload.startDate);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? payload.periodLabel
    : format(parsed, 'd MMMM yyyy', { locale: fr });

  return payload.scopeMode === 'global'
    ? `Voici le calendrier opérationnel pour le ${dateLabel}.`
    : `Voici ce qui est prévu dans votre périmètre pour le ${dateLabel}.`;
}

export function buildCalendarStructuredResponse(
  payload: AiScopedCalendarPayload,
): SupaiStructuredOperationalResponse | { reply: string; resultGroups: [] } {
  const empty =
    payload.tasks.length === 0 &&
    payload.shootings.length === 0 &&
    payload.deliveries.length === 0 &&
    payload.watchItems.length === 0;

  if (empty) {
    return {
      reply:
        payload.scopeMode === 'global'
          ? SUPAI_EMPTY_CALENDAR_GLOBAL
          : SUPAI_EMPTY_CALENDAR_PERSONAL,
      resultGroups: [],
    };
  }

  const resultGroups: SupaiResultGroup[] = [];

  if (payload.tasks.length) {
    resultGroups.push({
      type: 'task_results',
      title: 'Tâches',
      items: payload.tasks.map(mapTaskItem),
    });
  }

  if (payload.shootings.length) {
    resultGroups.push({
      type: 'shooting_results',
      title: 'Tournages',
      items: payload.shootings.map(mapShootingFromCalendar),
    });
  }

  if (payload.deliveries.length) {
    resultGroups.push({
      type: 'delivery_results',
      title: 'Livraisons client',
      items: payload.deliveries.map(mapDeliveryFromCalendar),
    });
  }

  if (payload.watchItems.length) {
    resultGroups.push({
      type: 'watch_results',
      title: 'Points à surveiller',
      items: payload.watchItems.map((item, index) => ({
        id: `watch-${index}-${item.href}`,
        title: item.label,
        detail: item.detail,
        href: item.href,
      })),
    });
  }

  return {
    reply: calendarIntro(payload),
    resultGroups,
    intentType:
      resultGroups.length === 1 && resultGroups[0]?.type === 'shooting_results'
        ? 'operational_results'
        : resultGroups.length === 1 && resultGroups[0]?.type === 'delivery_results'
          ? 'operational_results'
          : 'ask_calendar_scope',
  };
}

export function buildMyWorkStructuredResponse(
  payload: AiMyOperationalWorkPayload,
  focus?: string,
): SupaiStructuredOperationalResponse | { reply: string; resultGroups: [] } {
  const hasContent =
    payload.tasks.length > 0 ||
    payload.videos.length > 0 ||
    payload.overdueTasks.length > 0 ||
    payload.dueTodayTasks.length > 0 ||
    payload.shootingsToday.length > 0 ||
    payload.deliveriesToday.length > 0;

  if (!hasContent) {
    return { reply: SUPAI_EMPTY_ASSIGNED_WORK, resultGroups: [] };
  }

  const overdueTasks = payload.overdueTasks.length
    ? payload.overdueTasks
    : payload.tasks.filter((t) => t.isOverdue);

  if (focus === 'tasks') {
    return {
      reply: 'Voici vos tâches assignées.',
      resultGroups: [
        {
          type: 'task_results',
          title: 'Mes tâches',
          items: payload.tasks.map(mapTaskItem),
        },
      ],
      intentType: 'summarize_work',
    };
  }

  if (focus === 'overdue') {
    return {
      reply: 'Voici vos tâches en retard.',
      resultGroups: overdueTasks.length
        ? [{ type: 'task_results', title: 'Tâches en retard', items: overdueTasks.map(mapTaskItem) }]
        : [],
      intentType: 'summarize_work',
    };
  }

  if (focus === 'shootings') {
    const items = payload.videos.filter((v) => v.shootingDate).map(mapShootingFromVideo);
    return {
      reply: 'Voici les tournages à venir dans votre périmètre.',
      resultGroups: items.length
        ? [{ type: 'shooting_results', title: 'Mes tournages', items }]
        : [],
      intentType: 'operational_results',
    };
  }

  if (focus === 'videos') {
    return {
      reply: 'Voici vos vidéos assignées.',
      resultGroups: [
        {
          type: 'video_results',
          title: 'Mes vidéos',
          items: payload.videos.map(mapVideoItem),
        },
      ],
      intentType: 'operational_results',
    };
  }

  const resultGroups: SupaiResultGroup[] = [];
  const renderedTaskIds = new Set<string>();
  const renderedVideoIds = new Set<string>();

  const todayTasks = payload.dueTodayTasks.length
    ? payload.dueTodayTasks
    : payload.tasks.filter((t) => t.isDueToday && !t.isOverdue);

  if (overdueTasks.length) {
    resultGroups.push({
      type: 'task_results',
      title: 'Urgent / en retard',
      items: overdueTasks.map(mapTaskItem),
    });
    overdueTasks.forEach((t) => renderedTaskIds.add(t.id));
  }

  if (todayTasks.length) {
    const items = todayTasks.filter((t) => !renderedTaskIds.has(t.id)).map(mapTaskItem);
    if (items.length) {
      resultGroups.push({ type: 'task_results', title: 'Aujourd’hui', items });
      items.forEach((t) => renderedTaskIds.add(t.id));
    }
  }

  if (payload.shootingsToday.length) {
    const items = payload.shootingsToday
      .filter((v) => !renderedVideoIds.has(v.id))
      .map(mapShootingFromVideo);
    if (items.length) {
      resultGroups.push({ type: 'shooting_results', title: 'Tournages aujourd’hui', items });
      items.forEach((i) => renderedVideoIds.add(i.videoId));
    }
  }

  if (payload.deliveriesToday.length) {
    const items = payload.deliveriesToday
      .filter((v) => !renderedVideoIds.has(v.id))
      .map(mapDeliveryFromVideo);
    if (items.length) {
      resultGroups.push({ type: 'delivery_results', title: 'Livraisons aujourd’hui', items });
      items.forEach((i) => renderedVideoIds.add(i.videoId));
    }
  }

  const followTasks = payload.tasks.filter((t) => !renderedTaskIds.has(t.id));
  if (followTasks.length) {
    resultGroups.push({
      type: 'task_results',
      title: 'À suivre',
      items: followTasks.map(mapTaskItem),
    });
  }

  const followVideos = payload.videos.filter((v) => !renderedVideoIds.has(v.id));
  if (followVideos.length) {
    const shootings = followVideos.filter((v) => v.shootingDate).map(mapShootingFromVideo);
    const deliveries = followVideos.filter((v) => v.deliveryDate).map(mapDeliveryFromVideo);
    const otherVideos = followVideos.filter((v) => !v.shootingDate && !v.deliveryDate).map(mapVideoItem);

    if (shootings.length) {
      resultGroups.push({ type: 'shooting_results', title: 'Tournages', items: shootings });
    }
    if (deliveries.length) {
      resultGroups.push({ type: 'delivery_results', title: 'Livraisons', items: deliveries });
    }
    if (otherVideos.length) {
      resultGroups.push({ type: 'video_results', title: 'Vidéos / montages', items: otherVideos });
    }
  }

  return {
    reply:
      focus === 'priorities'
        ? 'Voici vos priorités opérationnelles.'
        : 'Voici ce que vous avez à traiter dans votre périmètre.',
    resultGroups: resultGroups.filter((g) => g.items.length > 0),
    intentType: 'summarize_work',
  };
}

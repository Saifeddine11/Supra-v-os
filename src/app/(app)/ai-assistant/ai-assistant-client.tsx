'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ClipboardList,
  Copy,
  Loader2,
  MessageSquare,
  Pencil,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SectionCard } from '@/components/shared/section-card';
import { TaskDraftCard } from '@/components/ai/task-draft-card';
import { TaskUpdateDraftCard } from '@/components/ai/task-update-draft-card';
import { VideoDraftCard } from '@/components/ai/video-draft-card';
import { SupAIResultGroups } from '@/components/ai/supai-result-groups';
import { cn } from '@/lib/utils/cn';
import type { AiChatMessage } from '@/lib/ai/chat-schema';
import { AI_CHAT_MAX_MESSAGE_CHARS, AI_CHAT_MAX_MESSAGES } from '@/lib/ai/chat-schema';
import type { AiIntentType, AiTaskDraftPayload, AiTaskUpdateDraftPayload, AiVideoDraftPayload } from '@/lib/ai/intent-schema';
import type { AiContextLink } from '@/lib/ai/context-schema';
import type { SupaiResultGroup } from '@/lib/ai/result-groups-schema';
import {
  SUPAI_FOOTER_NOTE,
  SUPAI_NAME,
  SUPAI_WELCOME_MESSAGE,
  SUPAI_EMPTY_REPLY,
  SUPAI_ERROR_NETWORK,
  SUPAI_PARSE_FALLBACK_REPLY,
} from '@/lib/ai/supai-copy';
import {
  buildChatHistoryStorageKey,
  clearChatHistory,
  loadChatHistory,
  newChatMessageId,
  resolveChatHistoryUserKey,
  saveChatHistory,
  type StoredChatMessage,
} from '@/lib/ai/chat-history-storage';
import { hrefTasksOpenDetail } from '@/lib/tasks/task-deep-link';
import { hrefVideosOpenDetailKanban } from '@/lib/videos/video-deep-link';
import {
  QUICK_ACTION_DEFINITIONS,
  QUICK_ACTION_REPLACE_CONFIRM,
  getTemplateCursorPosition,
  type QuickActionDefinition,
  type QuickActionId,
} from '@/lib/ai/quick-action-prompts';

type ChatMessage = AiChatMessage & {
  id: string;
  createdAt: string;
  intentType?: AiIntentType;
  taskDraft?: AiTaskDraftPayload | null;
  videoDraft?: AiVideoDraftPayload | null;
  taskUpdateDraft?: AiTaskUpdateDraftPayload | null;
  contextLinks?: AiContextLink[];
  resultGroups?: SupaiResultGroup[];
  taskDraftStatus?: 'pending' | 'created' | 'dismissed';
  videoDraftStatus?: 'pending' | 'created' | 'dismissed';
  taskUpdateDraftStatus?: 'pending' | 'updated' | 'dismissed';
  createdTaskId?: string;
  createdVideoId?: string;
  updatedTaskId?: string;
};

const WELCOME_CONTENT = SUPAI_WELCOME_MESSAGE;

function createWelcomeMessage(): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: WELCOME_CONTENT,
    createdAt: new Date(0).toISOString(),
  };
}

function looksLikeRawJsonReply(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') && t.includes('"intentType"');
}

function isValidUuid(value?: string): boolean {
  if (!value?.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function resolveAssistantReply(
  content: string,
  intentType?: AiIntentType,
  taskDraft?: AiTaskDraftPayload | null,
  videoDraft?: AiVideoDraftPayload | null,
  taskUpdateDraft?: AiTaskUpdateDraftPayload | null,
): string {
  const hasDraft =
    Boolean(taskDraft?.title?.trim()) ||
    Boolean(videoDraft?.title?.trim()) ||
    Boolean(taskUpdateDraft && (taskUpdateDraft.taskSearchText || taskUpdateDraft.taskId)) ||
    intentType === 'create_task_draft' ||
    intentType === 'create_video_draft' ||
    intentType === 'update_task_draft';

  const trimmed = content?.trim() ?? '';
  if (hasDraft && trimmed && !looksLikeRawJsonReply(trimmed)) {
    return trimmed;
  }

  const trimmedFallback = trimmed;
  if (!trimmedFallback) {
    return SUPAI_EMPTY_REPLY;
  }
  if (looksLikeRawJsonReply(trimmedFallback)) {
    return SUPAI_PARSE_FALLBACK_REPLY;
  }
  return trimmedFallback;
}

function shouldShowTaskDraftCard(m: ChatMessage): boolean {
  if (m.taskDraftStatus === 'created' || m.taskDraftStatus === 'dismissed') return false;
  return Boolean(m.taskDraft?.title?.trim());
}

function shouldShowVideoDraftCard(m: ChatMessage): boolean {
  if (m.videoDraftStatus === 'created' || m.videoDraftStatus === 'dismissed') return false;
  return Boolean(m.videoDraft?.title?.trim());
}

function shouldShowTaskUpdateDraftCard(m: ChatMessage): boolean {
  if (m.taskUpdateDraftStatus === 'updated' || m.taskUpdateDraftStatus === 'dismissed') {
    return false;
  }
  return Boolean(m.taskUpdateDraft);
}

function shouldShowUpdatedTaskLink(m: ChatMessage): boolean {
  return (
    m.role === 'assistant' &&
    m.taskUpdateDraftStatus === 'updated' &&
    isValidUuid(m.updatedTaskId) &&
    !shouldShowTaskUpdateDraftCard(m)
  );
}

function shouldShowCreatedTaskLink(m: ChatMessage): boolean {
  return (
    m.role === 'assistant' &&
    m.taskDraftStatus === 'created' &&
    isValidUuid(m.createdTaskId) &&
    !shouldShowTaskDraftCard(m)
  );
}

function shouldShowCreatedVideoLink(m: ChatMessage): boolean {
  return (
    m.role === 'assistant' &&
    m.videoDraftStatus === 'created' &&
    isValidUuid(m.createdVideoId) &&
    !shouldShowVideoDraftCard(m)
  );
}

function sanitizeLoadedMessage(m: StoredChatMessage): StoredChatMessage {
  const out = { ...m };
  if (out.taskDraftStatus === 'created' && !isValidUuid(out.createdTaskId)) {
    out.taskDraftStatus = out.taskDraft?.title ? 'pending' : undefined;
    delete out.createdTaskId;
  }
  if (out.taskDraftStatus !== 'created') {
    delete out.createdTaskId;
  }
  if (out.videoDraftStatus === 'created' && !isValidUuid(out.createdVideoId)) {
    out.videoDraftStatus = out.videoDraft?.title ? 'pending' : undefined;
    delete out.createdVideoId;
  }
  if (out.videoDraftStatus !== 'created') {
    delete out.createdVideoId;
  }
  if (out.taskUpdateDraftStatus === 'updated' && !isValidUuid(out.updatedTaskId)) {
    out.taskUpdateDraftStatus = out.taskUpdateDraft ? 'pending' : undefined;
    delete out.updatedTaskId;
  }
  if (out.taskUpdateDraftStatus !== 'updated') {
    delete out.updatedTaskId;
  }
  return out;
}

function toStoredMessage(m: ChatMessage): StoredChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content.slice(0, AI_CHAT_MAX_MESSAGE_CHARS),
    createdAt: m.createdAt,
    intentType: m.intentType,
    taskDraft: m.taskDraft ?? undefined,
    videoDraft: m.videoDraft ?? undefined,
    taskUpdateDraft: m.taskUpdateDraft ?? undefined,
    contextLinks: m.contextLinks?.slice(0, 8),
    resultGroups: m.resultGroups?.slice(0, 8),
    taskDraftStatus: m.taskDraftStatus,
    videoDraftStatus: m.videoDraftStatus,
    taskUpdateDraftStatus: m.taskUpdateDraftStatus,
    createdTaskId: m.createdTaskId,
    createdVideoId: m.createdVideoId,
    updatedTaskId: m.updatedTaskId,
  };
}

function fromStoredMessage(m: StoredChatMessage): ChatMessage {
  const sanitized = sanitizeLoadedMessage(m);
  return {
    id: sanitized.id,
    role: sanitized.role,
    content: sanitized.content,
    createdAt: sanitized.createdAt,
    intentType: sanitized.intentType,
    taskDraft: sanitized.taskDraft ?? null,
    videoDraft: sanitized.videoDraft ?? null,
    taskUpdateDraft: sanitized.taskUpdateDraft ?? null,
    contextLinks: sanitized.contextLinks,
    resultGroups: sanitized.resultGroups,
    taskDraftStatus: sanitized.taskDraftStatus,
    videoDraftStatus: sanitized.videoDraftStatus,
    taskUpdateDraftStatus: sanitized.taskUpdateDraftStatus,
    createdTaskId: sanitized.createdTaskId,
    createdVideoId: sanitized.createdVideoId,
    updatedTaskId: sanitized.updatedTaskId,
  };
}

function isWelcomeOnly(messages: ChatMessage[]): boolean {
  return messages.length === 1 && messages[0]?.id === 'welcome';
}

const QUICK_ACTION_ICONS = {
  create_task: ClipboardList,
  create_video: Sparkles,
  update_task: Pencil,
  priorities: CalendarDays,
  overdue_tasks: ClipboardList,
  my_tasks: ClipboardList,
  my_videos: Sparkles,
  my_shootings: CalendarDays,
  my_clients: MessageSquare,
  search_client: MessageSquare,
  search_video: Sparkles,
  client_followup: MessageSquare,
  draft_message: Send,
  calendar_today: CalendarDays,
  calendar_week: CalendarDays,
  calendar_month: CalendarDays,
  calendar_shootings: CalendarDays,
  calendar_deliveries: CalendarDays,
} satisfies Record<QuickActionId, typeof ClipboardList>;

type AiAssistantClientProps = {
  staffName: string;
  canCreateTasks: boolean;
  canCreateVideos: boolean;
  canUpdateTasks: boolean;
  visibleQuickActionIds: QuickActionId[];
  historyUserKey?: string | null;
  employeeId?: string | null;
  userEmail?: string | null;
};

export function AiAssistantClient({
  staffName,
  canCreateTasks,
  canCreateVideos,
  canUpdateTasks,
  visibleQuickActionIds,
  historyUserKey,
  employeeId,
  userEmail,
}: AiAssistantClientProps) {
  const userKey = useMemo(
    () =>
      resolveChatHistoryUserKey({
        userId: historyUserKey,
        employeeId,
        email: userEmail,
      }),
    [historyUserKey, employeeId, userEmail],
  );
  const storageKey = useMemo(() => buildChatHistoryStorageKey(userKey), [userKey]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage()]);
  const [historyReady, setHistoryReady] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = loadChatHistory(storageKey);
    if (saved?.length) {
      setMessages(saved.map(fromStoredMessage));
    } else {
      setMessages([createWelcomeMessage()]);
    }
    setHistoryReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!historyReady || pending) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (isWelcomeOnly(messages)) {
        clearChatHistory(storageKey);
        return;
      }
      saveChatHistory(storageKey, userKey, messages.map(toStoredMessage));
    }, 250);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, historyReady, pending, storageKey, userKey]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pending, scrollToBottom]);

  function resetChat() {
    clearChatHistory(storageKey);
    setMessages([createWelcomeMessage()]);
    setInput('');
    inputRef.current?.focus();
  }

  function patchMessage(messageId: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...patch } : m)));
  }

  async function sendMessage(overrideText?: string) {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || pending) return;
    if (trimmed.length > AI_CHAT_MAX_MESSAGE_CHARS) {
      toast.error(`Maximum ${AI_CHAT_MAX_MESSAGE_CHARS} caractères par message.`);
      return;
    }

    const history = messages.filter((m) => m.id !== 'welcome');
    const nextUser: ChatMessage = {
      id: newChatMessageId(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const outbound = [...history, nextUser];

    if (outbound.length > AI_CHAT_MAX_MESSAGES) {
      toast.error(`Maximum ${AI_CHAT_MAX_MESSAGES} messages — effacez la conversation.`);
      return;
    }

    if (!overrideText) setInput('');
    setMessages(outbound);
    setPending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          messages: outbound.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await res.json()) as {
        message?: AiChatMessage;
        intentType?: AiIntentType;
        taskDraft?: AiTaskDraftPayload | null;
        videoDraft?: AiVideoDraftPayload | null;
        taskUpdateDraft?: AiTaskUpdateDraftPayload | null;
        contextLinks?: AiContextLink[];
        resultGroups?: SupaiResultGroup[];
        error?: string;
      };

      if (!res.ok) {
        toast.error(data.error ?? 'Impossible d’obtenir une réponse.');
        setMessages(outbound.slice(0, -1));
        if (!overrideText) setInput(trimmed);
        return;
      }

      if (!data.message?.content) {
        toast.error('Réponse invalide.');
        setMessages(outbound.slice(0, -1));
        if (!overrideText) setInput(trimmed);
        return;
      }

      const hasTaskDraft = Boolean(data.taskDraft?.title?.trim());
      const hasVideoDraft = Boolean(data.videoDraft?.title?.trim());
      const hasTaskUpdateDraft = Boolean(data.taskUpdateDraft);
      const assistantMsg: ChatMessage = {
        id: newChatMessageId(),
        role: 'assistant',
        content: resolveAssistantReply(
          data.message.content,
          data.intentType,
          data.taskDraft,
          data.videoDraft,
          data.taskUpdateDraft,
        ),
        createdAt: new Date().toISOString(),
        intentType: data.intentType,
        taskDraft: data.taskDraft ?? null,
        videoDraft: data.videoDraft ?? null,
        taskUpdateDraft: data.taskUpdateDraft ?? null,
        contextLinks: data.resultGroups?.length ? undefined : data.contextLinks,
        resultGroups: data.resultGroups,
        taskDraftStatus: hasTaskDraft ? 'pending' : undefined,
        videoDraftStatus: hasVideoDraft ? 'pending' : undefined,
        taskUpdateDraftStatus: hasTaskUpdateDraft ? 'pending' : undefined,
      };

      setMessages([...outbound, assistantMsg]);
    } catch {
      toast.error(SUPAI_ERROR_NETWORK);
      setMessages(outbound.slice(0, -1));
      if (!overrideText) setInput(trimmed);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function focusTemplateInput(prompt: string, focusAfterLabel?: string) {
    setInput(prompt);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const pos = getTemplateCursorPosition(prompt, focusAfterLabel);
      el.setSelectionRange(pos, pos);
    });
  }

  function applyQuickAction(action: QuickActionDefinition) {
    if (pending) return;

    if (action.mode === 'send') {
      void sendMessage(action.prompt);
      return;
    }

    if (input.trim()) {
      const ok = window.confirm(QUICK_ACTION_REPLACE_CONFIRM);
      if (!ok) return;
    }

    focusTemplateInput(action.prompt, action.focusAfterLabel);
  }

  const userTurns = messages.filter((m) => m.role === 'user').length;

  const quickActions = useMemo(
    () => QUICK_ACTION_DEFINITIONS.filter((action) => visibleQuickActionIds.includes(action.id)),
    [visibleQuickActionIds],
  );

  return (
    <SectionCard
      title={SUPAI_NAME}
      description={`Connecté en tant que ${staffName} — SupAI respecte votre périmètre d’accès.`}
      className="flex min-h-[min(72vh,720px)] flex-col"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {quickActions.map((action) => {
          const Icon = QUICK_ACTION_ICONS[action.id];
          return (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              disabled={pending}
              onClick={() => applyQuickAction(action)}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {action.label}
            </Button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {userTurns} message{userTurns > 1 ? 's' : ''} · max {AI_CHAT_MAX_MESSAGES} ·{' '}
          {AI_CHAT_MAX_MESSAGE_CHARS} caractères
          {!canCreateTasks ? ' · création tâche non autorisée pour votre rôle' : ''}
          {!canCreateVideos ? ' · création vidéo non autorisée pour votre rôle' : ''}
          {!canUpdateTasks ? ' · modification tâche non autorisée pour votre rôle' : ''}
        </p>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={resetChat}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Effacer
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-muted/15 p-3 sm:p-4"
      >
        {messages.map((m) => {
          const showTaskDraft = m.role === 'assistant' && shouldShowTaskDraftCard(m);
          const showVideoDraft = m.role === 'assistant' && shouldShowVideoDraftCard(m);
          const showTaskUpdateDraft = m.role === 'assistant' && shouldShowTaskUpdateDraftCard(m);
          const showCopy = m.role === 'assistant' && m.intentType === 'draft_message';
          const showCreatedTaskLink = shouldShowCreatedTaskLink(m);
          const showCreatedVideoLink = shouldShowCreatedVideoLink(m);
          const showUpdatedTaskLink = shouldShowUpdatedTaskLink(m);

          return (
            <div
              key={m.id}
              className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div className="max-w-[min(100%,42rem)]">
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/60 bg-card text-foreground',
                  )}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {m.role === 'user' ? 'Vous' : SUPAI_NAME}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  {showCopy ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 rounded-full px-2 text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(m.content).then(() => {
                          toast.success('Message copié.');
                        });
                      }}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Copier
                    </Button>
                  ) : null}
                </div>
                {showCreatedTaskLink && m.createdTaskId ? (
                  <div className="mt-2">
                    <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                      <Link href={hrefTasksOpenDetail(m.createdTaskId!)}>Voir la tâche</Link>
                    </Button>
                  </div>
                ) : null}
                {showCreatedVideoLink && m.createdVideoId ? (
                  <div className="mt-2">
                    <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                      <Link href={hrefVideosOpenDetailKanban(m.createdVideoId!)}>
                        Voir la vidéo
                      </Link>
                    </Button>
                  </div>
                ) : null}
                {showUpdatedTaskLink && m.updatedTaskId ? (
                  <div className="mt-2">
                    <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                      <Link href={hrefTasksOpenDetail(m.updatedTaskId!)}>Voir la tâche</Link>
                    </Button>
                  </div>
                ) : null}
                {showTaskDraft && m.taskDraft ? (
                  <TaskDraftCard
                    draft={m.taskDraft}
                    canCreate={canCreateTasks}
                    onCancel={() =>
                      patchMessage(m.id, { taskDraftStatus: 'dismissed' })
                    }
                    onTaskCreated={(taskId) =>
                      patchMessage(m.id, {
                        taskDraftStatus: 'created',
                        createdTaskId: taskId,
                      })
                    }
                  />
                ) : null}
                {showTaskUpdateDraft && m.taskUpdateDraft ? (
                  <TaskUpdateDraftCard
                    draft={m.taskUpdateDraft}
                    canUpdate={canUpdateTasks}
                    onCancel={() =>
                      patchMessage(m.id, { taskUpdateDraftStatus: 'dismissed' })
                    }
                    onTaskUpdated={(taskId) =>
                      patchMessage(m.id, {
                        taskUpdateDraftStatus: 'updated',
                        updatedTaskId: taskId,
                      })
                    }
                  />
                ) : null}
                {showVideoDraft && m.videoDraft ? (
                  <VideoDraftCard
                    draft={m.videoDraft}
                    canCreate={canCreateVideos}
                    onCancel={() =>
                      patchMessage(m.id, { videoDraftStatus: 'dismissed' })
                    }
                    onVideoCreated={(videoId) =>
                      patchMessage(m.id, {
                        videoDraftStatus: 'created',
                        createdVideoId: videoId,
                      })
                    }
                  />
                ) : null}
                {m.role === 'assistant' && m.resultGroups && m.resultGroups.length > 0 ? (
                  <SupAIResultGroups groups={m.resultGroups} />
                ) : null}
                {m.role === 'assistant' &&
                m.contextLinks &&
                m.contextLinks.length > 0 &&
                !m.resultGroups?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.contextLinks.map((link) => (
                      <Button
                        key={`${link.href}-${link.label}`}
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full px-2.5 text-[11px]"
                      >
                        <Link href={link.href}>
                          {link.kind === 'task'
                            ? 'Voir la tâche'
                            : link.kind === 'video'
                              ? 'Voir la vidéo'
                              : 'Voir le client'}
                          {' · '}
                          <span className="max-w-[10rem] truncate inline-block align-bottom">
                            {link.label}
                          </span>
                        </Link>
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {pending ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
            Réponse en cours…
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Demandez à SupAI de préparer une tâche, une vidéo, un message ou un résumé…"
          rows={5}
          maxLength={AI_CHAT_MAX_MESSAGE_CHARS}
          disabled={pending}
          className="min-h-[120px] resize-none rounded-xl border-border/70 bg-background sm:flex-1"
        />
        <Button
          type="button"
          variant="primary"
          className="h-11 shrink-0 rounded-full px-5 sm:h-auto sm:min-h-[88px] sm:px-6"
          disabled={pending || !input.trim()}
          onClick={() => void sendMessage()}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              <Send className="mr-1.5 h-4 w-4" aria-hidden />
              Envoyer
            </>
          )}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {SUPAI_FOOTER_NOTE}{' '}
        Entrée pour envoyer · Maj+Entrée pour revenir à la ligne.{' '}
        <Link href="/tasks" className="underline underline-offset-2 hover:text-foreground">
          Voir le kanban tâches
        </Link>
        {' · '}
        <Link href="/videos" className="underline underline-offset-2 hover:text-foreground">
          Voir les vidéos
        </Link>
      </p>
    </SectionCard>
  );
}

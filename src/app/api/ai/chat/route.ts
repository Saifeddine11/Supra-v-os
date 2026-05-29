import { NextResponse } from 'next/server';
import { aiChatRequestSchema } from '@/lib/ai/chat-schema';
import { completeOpenRouterChat, OpenRouterChatError } from '@/lib/ai/openrouter';
import { parseAiStructuredResponse } from '@/lib/ai/parse-ai-response';
import { reconcileAiResponse } from '@/lib/ai/reconcile-ai-response';
import { requireStaffAiContext } from '@/lib/ai/require-staff-ai';
import { buildAiSystemPrompt, buildAiStaffContext } from '@/lib/ai/system-prompt';
import { canRunSupaiContextTool } from '@/lib/ai/supai-permissions';
import type { AiTaskDraftPayload } from '@/lib/ai/task-draft-schema';
import type { AiVideoDraftPayload } from '@/lib/ai/video-draft-schema';
import {
  detectContextIntentFromMessage,
  formatContextBlockForPrompt,
} from '@/lib/ai/detect-context-intent';
import { runAiContextTool } from '@/lib/ai/context-tools';
import type { AiContextLink } from '@/lib/ai/context-schema';
import { buildTaskDraftReply, buildVideoDraftReply } from '@/lib/ai/build-draft-reply';
import { evaluateSupaiGuardrails } from '@/lib/ai/guardrails';
import { SUPAI_ERROR_GENERIC } from '@/lib/ai/supai-copy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeTaskDraft(
  draft: AiTaskDraftPayload | null | undefined,
  canCreate: boolean,
): AiTaskDraftPayload | null {
  if (!canCreate) return null;
  if (!draft?.title?.trim()) return null;
  return draft;
}

function normalizeVideoDraft(
  draft: AiVideoDraftPayload | null | undefined,
  canCreate: boolean,
): AiVideoDraftPayload | null {
  if (!canCreate) return null;
  if (!draft?.title?.trim()) return null;
  return draft;
}

function financeDeniedBlock(): string {
  return 'Demande finance refusée : cet utilisateur n\'a pas accès aux données financières globales. Ne jamais inventer de chiffres. Répondez uniquement par un refus poli en français.';
}

export async function POST(request: Request) {
  const auth = await requireStaffAiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const staffCtx = buildAiStaffContext(auth.ctx);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = aiChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0]?.message ?? 'Requête invalide.';
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const lastUserMessage =
    [...parsed.data.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  const guardrail = evaluateSupaiGuardrails(lastUserMessage, staffCtx);
  if (guardrail) {
    return NextResponse.json({
      message: { role: 'assistant' as const, content: guardrail.reply },
      intentType: 'general_chat' as const,
      taskDraft: null,
      videoDraft: null,
    });
  }

  let operationalContext: string | null = null;
  let contextLinks: AiContextLink[] = [];
  let contextTool: string | null = null;
  let contextEmpty = false;
  let contextTruncated = false;

  const detected = detectContextIntentFromMessage(lastUserMessage, auth.ctx);
  if (detected.action === 'finance_denied') {
    operationalContext = financeDeniedBlock();
  } else if (detected.action === 'fetch') {
    const toolGate = canRunSupaiContextTool(detected.request, auth.ctx.supai);
    if (!toolGate.ok) {
      operationalContext = `Accès refusé : ${toolGate.reason}`;
    } else {
      try {
        const toolResult = await runAiContextTool(auth.ctx, detected.request);
        if (!toolResult.ok) {
          operationalContext = `Accès refusé : ${toolResult.reason}`;
        } else {
          operationalContext = formatContextBlockForPrompt(toolResult);
          contextLinks = toolResult.links;
          contextTool = toolResult.tool;
          contextEmpty = toolResult.empty;
          contextTruncated = toolResult.truncated;
        }
      } catch {
        operationalContext = 'Erreur lors du chargement du contexte opérationnel — répondez sans inventer de données.';
      }
    }
  }

  const messages = [
    { role: 'system' as const, content: buildAiSystemPrompt(staffCtx, operationalContext) },
    ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  if (process.env.NODE_ENV === 'development') {
    console.log('[ai-chat env]', {
      provider: process.env.AI_PROVIDER,
      hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
      model: process.env.AI_MODEL,
      role: staffCtx.role,
      contextTool,
      contextEmpty,
    });
  }

  try {
    const raw = await completeOpenRouterChat(messages, { temperature: 0.35 });
    const parsed = parseAiStructuredResponse(raw);
    const structured = reconcileAiResponse(
      parsed,
      raw,
      lastUserMessage,
      staffCtx.canCreateTasks,
      staffCtx.canCreateVideos,
    );

    const taskDraft = normalizeTaskDraft(structured.taskDraft, staffCtx.canCreateTasks);
    const videoDraft = normalizeVideoDraft(structured.videoDraft, staffCtx.canCreateVideos);

    let intentType = structured.intentType;
    if (videoDraft) intentType = 'create_video_draft';
    else if (taskDraft) intentType = 'create_task_draft';

    let reply = structured.reply;
    if (videoDraft) {
      reply = await buildVideoDraftReply(auth.ctx, videoDraft);
    } else if (taskDraft) {
      reply = await buildTaskDraftReply(auth.ctx, taskDraft);
    }

    return NextResponse.json({
      message: { role: 'assistant' as const, content: reply },
      intentType,
      taskDraft,
      videoDraft,
      contextLinks: contextLinks.length ? contextLinks.slice(0, 8) : undefined,
      contextMeta: contextTool
        ? { tool: contextTool, empty: contextEmpty, truncated: contextTruncated }
        : undefined,
    });
  } catch (e) {
    if (e instanceof OpenRouterChatError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/ai/chat]', e);
    }
    return NextResponse.json(
      { error: SUPAI_ERROR_GENERIC },
      { status: 500 },
    );
  }
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { requireAuth } from '@/lib/auth/permissions';
import { getSupaiPermissions, getVisibleQuickActionIds } from '@/lib/ai/supai-permissions';
import dynamic from 'next/dynamic';

const AiAssistantClient = dynamic(
  () => import('./ai-assistant-client').then((m) => ({ default: m.AiAssistantClient })),
  {
    loading: () => (
      <div className="h-[28rem] animate-pulse rounded-2xl border border-border/50 bg-muted/20" aria-hidden />
    ),
  },
);

export const metadata: Metadata = { title: 'SupAI' };

export default async function AiAssistantPage() {
  const ctx = await requireAuth();
  const supai = getSupaiPermissions(ctx);

  if (!supai.canUseSupAI) {
    redirect('/access-denied');
  }

  const visibleQuickActionIds = getVisibleQuickActionIds(supai, ctx.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-sans text-2xl font-semibold tracking-tight text-foreground">
          <Sparkles className="h-7 w-7 text-primary" aria-hidden />
          SupAI
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Assistant opérationnel interne — tâches, vidéos, clients, priorités et messages, dans votre
          périmètre d’accès.
        </p>
      </div>

      <AiAssistantClient
        staffName={ctx.employee!.full_name}
        canCreateTasks={supai.canUseSupAICreateTaskDraft}
        canCreateVideos={supai.canUseSupAICreateVideoDraft}
        canUpdateTasks={supai.canUseSupAIUpdateTaskDraft}
        visibleQuickActionIds={visibleQuickActionIds}
        historyUserKey={ctx.userId}
        employeeId={ctx.employee!.id}
        userEmail={ctx.email}
      />
    </div>
  );
}

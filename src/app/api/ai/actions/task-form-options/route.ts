import { NextResponse } from 'next/server';
import { requireStaffAiContext } from '@/lib/ai/require-staff-ai';
import { assertSupaiCapability } from '@/lib/ai/supai-permissions';
import { SUPAI_ERROR_PERMISSION } from '@/lib/ai/supai-copy';
import { listClients } from '@/lib/data/clients';
import { listEmployeesForSelect } from '@/lib/data/employees';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireStaffAiContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ctx } = auth;
  const deny = assertSupaiCapability(ctx.supai, 'canUseSupAICreateTaskDraft');
  if (deny) {
    return NextResponse.json({ error: deny }, { status: 403 });
  }

  const [clients, employees] = await Promise.all([
    listClients({}, ctx),
    listEmployeesForSelect(ctx),
  ]);

  return NextResponse.json({
    clients: clients.map((c) => ({ id: c.id, name: c.name })),
    employees: employees.map((e) => ({ id: e.id, full_name: e.full_name })),
  });
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireClientAuth } from '@/lib/clients/session';
import { loadClientPlanning } from '@/lib/clients/workspace-data';
import { ClientEmpty, ClientSectionTitle, ClientSurface } from '@/components/client-workspace/client-ui';

export const metadata: Metadata = { title: 'Planning' };

export default async function ClientPlanningPage() {
  const session = await requireClientAuth();
  const { upcoming } = await loadClientPlanning(session);
  const groups = [
    { title: 'Aujourd’hui', items: upcoming.today },
    { title: 'Cette semaine', items: upcoming.week },
    { title: 'Plus tard', items: upcoming.later },
  ];
  const empty = groups.every((g) => g.items.length === 0);

  return (
    <div className="mx-auto max-w-4xl">
      <ClientSurface>
        <ClientSectionTitle
          title="Agenda"
          hint="Tournages, livraisons, publications et échéances visibles de votre côté."
        />
        {empty ? (
          <ClientEmpty title="Aucun événement à venir pour le moment." />
        ) : (
          <div className="space-y-8">
            {groups.map((g) =>
              g.items.length === 0 ? null : (
                <section key={g.title}>
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {g.title}
                  </h3>
                  <ul className="space-y-2">
                    {g.items.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={e.href}
                          className="block rounded-xl border border-white/[0.06] px-4 py-3 hover:border-primary/25"
                        >
                          <p className="text-sm font-medium text-foreground">{e.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {e.subtitle}
                            {e.meta ? ` · ${e.meta}` : ''}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
            )}
          </div>
        )}
      </ClientSurface>
    </div>
  );
}

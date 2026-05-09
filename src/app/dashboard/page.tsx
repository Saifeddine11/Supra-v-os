import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { APP_NAME, AGENCY } from '@/lib/constants';
import { requireAuth } from '@/lib/auth/permissions';
import { signOutAction } from './actions';

export const metadata: Metadata = {
  title: 'Tableau de bord',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ denied?: string }>;
}) {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    redirect('/login?next=/dashboard');
  }

  const denied = (await searchParams)?.denied === '1';

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-12 sm:px-6">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-serif text-lg font-normal tracking-tight text-supra-gradient">{AGENCY.name}</p>
          <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bienvenue,{' '}
            <span className="text-foreground">{ctx.employee.full_name}</span>
            {ctx.employee.role ? (
              <span className="ml-2 inline-flex rounded-full border border-primary/25 bg-primary/[0.07] px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                {ctx.employee.role.replace(/_/g, ' ')}
              </span>
            ) : null}
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#6b2416]/55 bg-gradient-to-b from-[#221008] to-[#1a0703] px-5 text-sm font-medium text-[#F8F4EF] shadow-sm transition-all hover:border-supra-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Déconnexion
          </button>
        </form>
      </header>

      {denied ? (
        <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
      ) : null}

      <div className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-supra-glow backdrop-blur-sm sm:p-8">
        <h2 className="font-sans text-lg font-semibold text-foreground">Tableau de bord</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Espace interne — les modules (projets, factures, planning…) seront branchés ici au fil des
          itérations. Votre session est active.
        </p>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border/80 bg-background/50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              E-mail
            </dt>
            <dd className="mt-1 text-foreground">{ctx.email}</dd>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Profil
            </dt>
            <dd className="mt-1 text-foreground">{ctx.employee.full_name}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

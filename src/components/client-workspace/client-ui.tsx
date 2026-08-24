import Link from 'next/link';
import { formatAgencyMoney } from '@/lib/money/format-money';
import { CLIENT_PIPELINE_COLUMN_LABEL, formatClientDate } from '@/lib/clients/client-labels';
import type {
  ClientActivityItem,
  ClientAttentionItem,
  ClientFinanceSummary,
  ClientMetric,
  ClientSafeInvoice,
  ClientSafeProject,
  ClientSafeReport,
  ClientSafeVideo,
} from '@/lib/clients/workspace-types';
import { cn } from '@/lib/utils/cn';

export function ClientSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.7)] backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ClientEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body ? <p className="mt-1.5 text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}

export function ClientSectionTitle({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-4', className)}>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ClientMetricRow({ metrics }: { metrics: ClientMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {metrics.map((m) => (
        <div
          key={m.key}
          className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {m.label}
          </p>
          <p className="mt-2 font-serif text-2xl tracking-tight text-foreground">
            {m.kind === 'money'
              ? formatAgencyMoney(m.value, m.currency)
              : m.kind === 'number'
                ? m.value.toLocaleString('fr-FR')
                : m.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ClientAttentionList({ items }: { items: ClientAttentionItem[] }) {
  if (items.length === 0) {
    return <ClientEmpty title="Rien à valider pour le moment." body="Tout est à jour." />;
  }
  return (
    <ul className="divide-y divide-white/[0.05]">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {item.subtitle}
              {item.meta ? ` · ${item.meta}` : ''}
            </p>
          </div>
          <Link
            href={item.href}
            className={cn(
              'inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-4 text-xs font-semibold transition-colors',
              item.tone === 'danger'
                ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
                : 'border-primary/35 text-primary hover:bg-primary/[0.08]',
            )}
          >
            {item.cta}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ClientProjectList({
  projects,
  empty,
}: {
  projects: ClientSafeProject[];
  empty: string;
}) {
  if (projects.length === 0) return <ClientEmpty title={empty} />;
  return (
    <ul className="space-y-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/client/projects/${p.id}`}
            className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 transition-colors hover:border-primary/25 hover:bg-primary/[0.04] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-foreground">{p.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {p.typeLabel} · {p.phaseLabel}
                {p.deadline ? ` · ${formatClientDate(p.deadline)}` : ''}
              </p>
            </div>
            {p.progress != null ? (
              <div className="w-full sm:w-36">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-primary/80"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{p.progress}%</p>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{p.phaseLabel}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ClientVideoList({
  videos,
  actions,
}: {
  videos: ClientSafeVideo[];
  actions?: (video: ClientSafeVideo) => React.ReactNode;
}) {
  if (videos.length === 0) {
    return <ClientEmpty title="Aucun contenu à afficher pour le moment." />;
  }
  return (
    <ul className="space-y-2">
      {videos.map((v) => (
        <li
          id={`video-${v.id}`}
          key={v.id}
          className={cn(
            'scroll-mt-24 rounded-xl border px-4 py-3.5',
            v.needsValidation
              ? 'border-primary/35 bg-primary/[0.06]'
              : 'border-white/[0.06] bg-white/[0.02]',
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-foreground">{v.title}</p>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">
                {v.projectTitle ? `${v.projectTitle} · ` : ''}
                {v.statusLabel}
                {v.shootingDate ? ` · Tournage ${formatClientDate(v.shootingDate)}` : ''}
                {v.deliveryDate ? ` · Livraison ${formatClientDate(v.deliveryDate)}` : ''}
              </p>
              {v.previewUrl || v.finalUrl ? (
                <a
                  href={v.finalUrl || v.previewUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
                >
                  Voir le média
                </a>
              ) : null}
            </div>
            {actions ? <div className="shrink-0">{actions(v)}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ClientPipeline({ videos }: { videos: ClientSafeVideo[] }) {
  const cols = Object.entries(CLIENT_PIPELINE_COLUMN_LABEL) as [
    ClientSafeVideo['pipelineColumn'],
    string,
  ][];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cols.map(([key, label]) => {
        const items = videos.filter((v) => v.pipelineColumn === key);
        return (
          <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 font-serif text-xl text-foreground">{items.length}</p>
            <ul className="mt-3 space-y-1.5">
              {items.slice(0, 3).map((v) => (
                <li key={v.id} className="truncate text-xs text-foreground/90">
                  {v.title}
                </li>
              ))}
              {items.length === 0 ? (
                <li className="text-xs text-muted-foreground">—</li>
              ) : null}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function ClientInvoiceTable({
  invoices,
  empty,
}: {
  invoices: ClientSafeInvoice[];
  empty: string;
}) {
  if (invoices.length === 0) return <ClientEmpty title={empty} />;

  const statusClass = (tone: ClientSafeInvoice['tone']) =>
    cn(
      'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
      tone === 'paid' && 'bg-emerald-500/15 text-emerald-400',
      tone === 'pending' && 'bg-orange-500/15 text-orange-300',
      tone === 'overdue' && 'bg-destructive/15 text-destructive',
    );

  const pdfLink = (inv: ClientSafeInvoice) =>
    inv.hasPdf ? (
      <a
        href={`/api/client/invoices/${inv.id}/pdf`}
        className="text-xs font-semibold text-primary hover:underline"
        aria-label={`Télécharger le PDF de la facture ${inv.ref}`}
      >
        PDF
      </a>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    );

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {invoices.map((inv) => (
          <li
            key={inv.id}
            id={`invoice-${inv.id}`}
            className="scroll-mt-24 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-medium text-foreground">{inv.ref}</p>
              <span className={statusClass(inv.tone)}>{inv.statusLabel}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Émise {formatClientDate(inv.issueDate) ?? '—'} · Échéance {formatClientDate(inv.dueDate) ?? '—'}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="tabular-nums text-sm text-foreground">
                {formatAgencyMoney(inv.total, inv.currency)}
              </p>
              {pdfLink(inv)}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr className="border-b border-white/[0.06]">
              <th className="py-2 pr-3 font-medium">Facture</th>
              <th className="py-2 pr-3 font-medium">Émise</th>
              <th className="py-2 pr-3 font-medium">Échéance</th>
              <th className="py-2 pr-3 font-medium">Montant</th>
              <th className="py-2 pr-3 font-medium">Statut</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-white/[0.04]">
                <td className="py-3 pr-3 font-medium text-foreground">{inv.ref}</td>
                <td className="py-3 pr-3 text-muted-foreground">{formatClientDate(inv.issueDate)}</td>
                <td className="py-3 pr-3 text-muted-foreground">{formatClientDate(inv.dueDate)}</td>
                <td className="py-3 pr-3 tabular-nums text-foreground">
                  {formatAgencyMoney(inv.total, inv.currency)}
                </td>
                <td className="py-3 pr-3">
                  <span className={statusClass(inv.tone)}>{inv.statusLabel}</span>
                </td>
                <td className="py-3 text-right">{pdfLink(inv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ClientFinanceBlock({ finance }: { finance: ClientFinanceSummary }) {
  if (!finance.hasInvoices) {
    return <ClientEmpty title="Aucune facture visible pour le moment." />;
  }
  if (finance.remaining === 0) {
    return <ClientEmpty title="Aucun paiement en attente." body="Votre situation est à jour." />;
  }
  const rows = [
    { label: 'Facturé', value: finance.invoiced },
    { label: 'Payé', value: finance.paid },
    { label: 'Reste dû', value: finance.remaining },
    ...(finance.overdue > 0 ? [{ label: 'En retard', value: finance.overdue }] : []),
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((r) => (
        <div key={r.label} className="rounded-xl border border-white/[0.06] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{r.label}</p>
          <p className="mt-1.5 font-serif text-xl text-foreground">
            {formatAgencyMoney(r.value, finance.currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ClientActivityList({ items }: { items: ClientActivityItem[] }) {
  if (items.length === 0) {
    return <ClientEmpty title="Aucune activité récente." />;
  }
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3">
          <p className="min-w-0 break-words text-sm text-foreground">{a.title}</p>
          <p className="shrink-0 text-xs text-muted-foreground">{formatClientDate(a.at)}</p>
        </li>
      ))}
    </ul>
  );
}

export function ClientReportList({ reports }: { reports: ClientSafeReport[] }) {
  if (reports.length === 0) {
    return <ClientEmpty title="Aucun rapport partagé pour le moment." />;
  }
  return (
    <ul className="space-y-2">
      {reports.map((r) => (
        <li
          key={r.id}
          className="flex flex-col gap-2 rounded-xl border border-white/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="break-words text-sm font-medium text-foreground">{r.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {r.typeLabel}
              {r.periodStart ? ` · ${formatClientDate(r.periodStart)}` : ''}
              {r.periodEnd ? ` — ${formatClientDate(r.periodEnd)}` : ''}
            </p>
          </div>
          {r.pdfUrl ? (
            <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">
              Ouvrir
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { INVOICE_STATUS_MAP, PAYMENT_METHOD_LABELS } from '@/types/domain';
import type { InvoiceStatus, PaymentMethod } from '@/types/database';

const selectCls =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground';

export function PaymentsToolbar({
  clients,
  defaultQ,
  defaultClient,
  defaultMethod,
  defaultFrom,
  defaultTo,
  defaultInvoiceStatus,
}: {
  clients: { id: string; name: string }[];
  defaultQ?: string;
  defaultClient: string;
  defaultMethod: string;
  defaultFrom?: string;
  defaultTo?: string;
  defaultInvoiceStatus: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function push(next: Record<string, string>) {
    const p = new URLSearchParams(sp?.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === 'all') p.delete(k);
      else p.set(k, v);
    }
    start(() => router.push(`/payments?${p.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-4 backdrop-blur-sm lg:flex-row lg:flex-wrap lg:items-end">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={defaultQ}
          placeholder="Réf. facture, client…"
          className="h-10 pl-9"
          onChange={(e) => push({ q: e.target.value })}
        />
      </div>
      <select
        className={selectCls}
        defaultValue={defaultClient}
        disabled={pending}
        onChange={(e) => push({ client: e.target.value })}
      >
        <option value="all">Tous clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultMethod}
        disabled={pending}
        onChange={(e) => push({ method: e.target.value })}
      >
        <option value="all">Tous moyens</option>
        {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </select>
      <select
        className={selectCls}
        defaultValue={defaultInvoiceStatus}
        disabled={pending}
        onChange={(e) => push({ invStatus: e.target.value })}
      >
        <option value="all">Tous statuts facture</option>
        {(Object.keys(INVOICE_STATUS_MAP) as InvoiceStatus[]).map((s) => (
          <option key={s} value={s}>
            {INVOICE_STATUS_MAP[s].label}
          </option>
        ))}
      </select>
      <Input
        type="date"
        className="h-10 w-[160px]"
        defaultValue={defaultFrom}
        onChange={(e) => push({ from: e.target.value })}
      />
      <Input
        type="date"
        className="h-10 w-[160px]"
        defaultValue={defaultTo}
        onChange={(e) => push({ to: e.target.value })}
      />
    </div>
  );
}

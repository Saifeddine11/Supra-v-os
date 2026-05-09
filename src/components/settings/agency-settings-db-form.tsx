'use client';

import { useEffect, useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DEFAULT_AGENCY_SETTINGS } from '@/data/agency-settings';
import type { AgencySettingsRow } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateAgencySettingsAction } from '@/app/(app)/settings/actions';

function displayValues(row: AgencySettingsRow | null) {
  const d = DEFAULT_AGENCY_SETTINGS;
  return {
    agency_name: row?.agency_name?.trim() || d.agencyName,
    logo_url: row?.logo_url?.trim() || d.logoUrl || '',
    email: row?.email?.trim() || d.email,
    phone: row?.phone?.trim() || d.phone || '',
    address: row?.address?.trim() || d.address || '',
    website: row?.website?.trim() || d.website || '',
    tax_id: row?.tax_id?.trim() || d.taxId || '',
    invoice_prefix: row?.invoice_prefix?.trim() || d.invoicePrefix,
    quote_prefix: row?.quote_prefix?.trim() || d.quotePrefix,
    default_currency: row?.default_currency?.trim() || d.defaultCurrency,
    default_payment_terms: row?.default_payment_terms?.trim() || d.defaultPaymentTerms,
    default_tax_rate: row?.default_tax_rate ?? d.defaultTaxRatePercent,
    portal_base_url: row?.portal_base_url?.trim() || d.portalBaseUrl || '',
    portal_show_branding: row?.portal_show_branding ?? d.portalShowBranding,
  };
}

function FormFeedback({ kind, message }: { kind: 'success' | 'error'; message: string }) {
  if (kind === 'success') {
    return (
      <div
        role="status"
        className="rounded-xl border border-primary/50 bg-gradient-to-br from-primary/[0.14] to-primary/[0.06] px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.2)]"
      >
        <span className="font-medium text-primary">{message}</span>
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

export function AgencySettingsDbForm({
  row,
  canEdit,
}: {
  row: AgencySettingsRow | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (feedback?.kind !== 'success') return;
    const t = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(t);
  }, [feedback]);

  if (!row) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        La table <code className="text-xs">agency_settings</code> est introuvable. Appliquez la migration Supabase
        P1 (<code className="text-xs">20260511120000_p1_storage_agency_activity.sql</code>) puis rechargez.
      </div>
    );
  }

  const v = displayValues(row);

  if (!canEdit) {
    return (
      <dl className="grid max-w-2xl gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Agence</dt>
          <dd className="text-foreground">{v.agency_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Email / téléphone</dt>
          <dd className="text-foreground">
            {v.email} {v.phone ? `· ${v.phone}` : ''}
          </dd>
        </div>
        <p className="text-xs text-muted-foreground">Modification réservée aux administrateurs.</p>
      </dl>
    );
  }

  return (
    <form
      className="grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setFeedback(null);
        startTransition(async () => {
          const res = await updateAgencySettingsAction(formData);
          if (res.ok) {
            setFeedback({ kind: 'success', text: 'Paramètres agence enregistrés.' });
            router.refresh();
          } else {
            setFeedback({ kind: 'error', text: res.error });
          }
        });
      }}
    >
      {feedback ? <FormFeedback kind={feedback.kind} message={feedback.text} /> : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="agency_name">Nom de l&apos;agence</Label>
          <Input id="agency_name" name="agency_name" defaultValue={v.agency_name} required disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="logo_url">Logo (URL)</Label>
          <Input id="logo_url" name="logo_url" defaultValue={v.logo_url} placeholder="https://…" disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={v.email} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" name="phone" defaultValue={v.phone} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="website">Site web</Label>
          <Input id="website" name="website" defaultValue={v.website} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tax_id">TVA / identifiant fiscal</Label>
          <Input id="tax_id" name="tax_id" defaultValue={v.tax_id} disabled={pending} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="address">Adresse</Label>
          <Textarea id="address" name="address" rows={2} defaultValue={v.address} disabled={pending} />
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border border-primary/20 bg-muted/20 p-4 sm:grid-cols-2 dark:border-primary/25 dark:bg-card/40">
        <div className="grid gap-2">
          <Label htmlFor="invoice_prefix">Préfixe factures</Label>
          <Input id="invoice_prefix" name="invoice_prefix" defaultValue={v.invoice_prefix} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quote_prefix">Préfixe devis</Label>
          <Input id="quote_prefix" name="quote_prefix" defaultValue={v.quote_prefix} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="default_currency">Devise par défaut</Label>
          <Input id="default_currency" name="default_currency" defaultValue={v.default_currency} disabled={pending} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="default_tax_rate">TVA % défaut</Label>
          <Input
            id="default_tax_rate"
            name="default_tax_rate"
            type="number"
            min={0}
            step={0.5}
            defaultValue={v.default_tax_rate}
            disabled={pending}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="default_payment_terms">Conditions de paiement type</Label>
          <Textarea
            id="default_payment_terms"
            name="default_payment_terms"
            rows={2}
            defaultValue={v.default_payment_terms}
            disabled={pending}
          />
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border border-primary/20 bg-muted/20 p-4 dark:border-primary/25 dark:bg-card/40">
        <div className="grid gap-2">
          <Label htmlFor="portal_base_url">URL de base du portail client</Label>
          <Input
            id="portal_base_url"
            name="portal_base_url"
            placeholder="https://app.suprav3.com"
            defaultValue={v.portal_base_url}
            disabled={pending}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="hidden" name="portal_show_branding" value="false" />
          <input
            type="checkbox"
            name="portal_show_branding"
            value="true"
            defaultChecked={v.portal_show_branding}
            disabled={pending}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Afficher le branding Supra v. côté portail
        </label>
      </div>
      <Button type="submit" variant="primary" className="w-fit rounded-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enregistrement…
          </>
        ) : (
          'Enregistrer'
        )}
      </Button>
    </form>
  );
}

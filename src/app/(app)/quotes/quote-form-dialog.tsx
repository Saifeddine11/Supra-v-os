'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createQuoteAction } from './actions';
import { QUOTE_PRESETS } from '@/data/quote-presets';

export function QuoteFormDialog({
  clients,
  trigger,
}: {
  clients: Pick<Client, 'id' | 'name'>[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [presetKey, setPresetKey] = useState('');

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  const defaultValid = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  };

  const usingPreset = presetKey.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle proposition</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = await createQuoteAction(formData);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              const newId = res.data?.id;
              if (newId) router.push(`/quotes/${newId}`);
              router.refresh();
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
          className="grid gap-4"
        >
          {usingPreset ? <input type="hidden" name="preset_key" value={presetKey} /> : null}
          <div className="grid gap-2">
            <Label htmlFor="qt-client">Client</Label>
            <select
              id="qt-client"
              name="client_id"
              required
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="qt-preset">Modèle de départ</Label>
            <select
              id="qt-preset"
              value={presetKey}
              onChange={(e) => setPresetKey(e.target.value)}
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
            >
              <option value="">Devis simple (une ligne)</option>
              {QUOTE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Le forfait « acquisition & visibilité » préremplit textes stratégiques et lignes — ajustez les montants dans
              l’éditeur.
            </p>
          </div>

          {usingPreset ? null : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="qt-desc">Libellé ligne</Label>
                  <Input id="qt-desc" name="line_description" defaultValue="Prestation" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qt-unit">Unité</Label>
                  <Input id="qt-unit" name="line_unit" placeholder="ex. forfait" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="qt-qty">Quantité</Label>
                  <Input id="qt-qty" name="line_quantity" type="number" min={1} step={1} defaultValue={1} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qt-price">Prix unitaire (HT)</Label>
                  <Input id="qt-price" name="line_unit_price" type="number" min={0} step={0.01} required />
                </div>
              </div>
            </>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="qt-tax">TVA %</Label>
              <Input id="qt-tax" name="tax_rate" type="number" min={0} step={0.01} defaultValue={0} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qt-disc-mode">Remise</Label>
              <input type="hidden" name="discount_mode" value="fixed" />
              <Input id="qt-disc" name="discount" type="number" min={0} step={0.01} defaultValue={0} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="qt-valid">Valide jusqu&apos;au</Label>
              <Input id="qt-valid" name="valid_until" type="date" required defaultValue={defaultValid()} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qt-cur">Devise</Label>
              <Input id="qt-cur" name="currency" defaultValue="MAD" />
            </div>
          </div>
          <input type="hidden" name="template" value="supra_premium_black_orange" />
          <div className="grid gap-2">
            <Label htmlFor="qt-notes">Notes internes</Label>
            <Textarea id="qt-notes" name="notes" rows={2} className="resize-none" placeholder="Non visible client" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="hidden" name="visible_to_client" value="false" />
            <input
              type="checkbox"
              name="visible_to_client"
              value="true"
              defaultChecked
              className="rounded border-border"
            />
            Visible sur le portail client
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="hidden" name="include_signature_block" value="false" />
            <input
              type="checkbox"
              name="include_signature_block"
              value="true"
              defaultChecked
              className="rounded border-border"
            />
            Bloc signature sur le PDF
          </label>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="submit" variant="primary" className="rounded-full" disabled={pending}>
            {pending ? 'Création…' : 'Créer et ouvrir'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

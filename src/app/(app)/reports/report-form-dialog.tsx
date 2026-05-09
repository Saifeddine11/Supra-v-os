'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client } from '@/types/database';
import { REPORT_TYPE_LABELS } from '@/types/domain';
import type { ReportType } from '@/types/database';
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
import { createReportAction } from './actions';

const REPORT_TYPES = Object.keys(REPORT_TYPE_LABELS) as ReportType[];

export function ReportFormDialog({
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

  useEffect(() => {
    if (!open) setErr(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau rapport</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={async (formData) => {
            setErr(null);
            setPending(true);
            try {
              const res = await createReportAction(formData);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              router.refresh();
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="rep-client">Client</Label>
            <select
              id="rep-client"
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
            <Label htmlFor="rep-title">Titre</Label>
            <Input id="rep-title" name="title" required placeholder="Rapport mensuel — janvier" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-type">Période / type</Label>
            <select
              id="rep-type"
              name="type"
              required
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REPORT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rep-start">Début période</Label>
              <Input id="rep-start" name="period_start" type="date" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rep-end">Fin période</Label>
              <Input id="rep-end" name="period_end" type="date" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-summary">Synthèse</Label>
            <Textarea id="rep-summary" name="summary" rows={3} className="resize-none" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-work">Travail réalisé (une ligne = un point)</Label>
            <Textarea id="rep-work" name="work_completed" rows={4} className="resize-none" placeholder={'Vidéo X livrée\nRéunion bilan'} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-next">Prochaines actions</Label>
            <Textarea id="rep-next" name="next_actions" rows={2} className="resize-none" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-rec">Recommandations</Label>
            <Textarea id="rep-rec" name="recommendations" rows={2} className="resize-none" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-wa">Texte WhatsApp (copie rapide)</Label>
            <Textarea id="rep-wa" name="whatsapp_text" rows={2} className="resize-none" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rep-pdf">URL PDF (optionnel)</Label>
            <Input id="rep-pdf" name="pdf_url" placeholder="https://…" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="hidden" name="visible_to_client" value="false" />
            <input type="checkbox" name="visible_to_client" value="true" defaultChecked className="rounded border-border" />
            Visible sur le portail client
          </label>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="submit" variant="primary" className="rounded-full" disabled={pending}>
            {pending ? 'Création…' : 'Créer le rapport'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

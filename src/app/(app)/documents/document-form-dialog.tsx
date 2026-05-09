'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Client } from '@/types/database';
import type { ProjectOption } from '@/lib/data/projects-list';
import { DOCUMENT_TYPE_LABELS } from '@/types/domain';
import type { DocumentType } from '@/types/database';
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
import { createDocumentAction } from './actions';
import { Loader2 } from 'lucide-react';

const DOC_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];

export function DocumentFormDialog({
  clients,
  projects,
  storageConfigured,
  trigger,
}: {
  clients: Pick<Client, 'id' | 'name'>[];
  projects: ProjectOption[];
  storageConfigured: boolean;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    if (!open) {
      setErr(null);
      setOk(null);
    }
  }, [open]);

  const filteredProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.client_id === clientId) : projects),
    [projects, clientId]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau document</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          encType="multipart/form-data"
          action={async (formData) => {
            setErr(null);
            setOk(null);
            setPending(true);
            try {
              const res = await createDocumentAction(formData);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              setOk('Document ajouté.');
              router.refresh();
              await new Promise((r) => setTimeout(r, 450));
              setOpen(false);
            } finally {
              setPending(false);
            }
          }}
        >
          {!storageConfigured ? (
            <div
              role="note"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground dark:bg-amber-500/15"
            >
              Upload désactivé tant que le Storage Supabase (service role + buckets) n&apos;est pas configuré. Utilisez
              une URL fichier ou un lien externe.
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="doc-name">Nom</Label>
            <Input id="doc-name" name="name" required placeholder="ex. Charte graphique v2" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="doc-client">Client</Label>
            <select
              id="doc-client"
              name="client_id"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
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
            <Label htmlFor="doc-project">Projet (optionnel)</Label>
            <select
              id="doc-project"
              name="project_id"
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
            >
              <option value="">—</option>
              {filteredProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.clients?.name ? ` · ${p.clients.name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="doc-type">Type</Label>
            <select
              id="doc-type"
              name="type"
              required
              className="h-10 rounded-lg border border-border bg-muted px-3 text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="doc-file">Fichier (Storage privé)</Label>
            <Input
              id="doc-file"
              name="file"
              type="file"
              className="cursor-pointer text-sm"
              disabled={!storageConfigured}
            />
            <p className="text-xs text-muted-foreground">
              {storageConfigured
                ? 'Envoi vers le bucket « documents », ouverture via lien signé temporaire.'
                : 'Configurez le Storage pour activer l’upload — voir l’avertissement ci-dessus.'}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="doc-url">Ou URL fichier (hébergement externe / public)</Label>
            <Input id="doc-url" name="file_url" placeholder="https://…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="doc-link">Ou lien externe (Drive, Notion…)</Label>
            <Input id="doc-link" name="external_link" placeholder="https://…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="doc-desc">Description</Label>
            <Textarea id="doc-desc" name="description" rows={2} className="resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="hidden" name="visible_to_client" value="false" />
            <input type="checkbox" name="visible_to_client" value="true" className="rounded border-border" />
            Visible sur le portail client
          </label>
          {ok ? (
            <p
              role="status"
              className="rounded-lg border border-primary/45 bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
            >
              {ok}
            </p>
          ) : null}
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="submit" variant="primary" className="rounded-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              'Ajouter'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

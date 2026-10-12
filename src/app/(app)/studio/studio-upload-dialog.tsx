'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { resumableUpload } from '@/lib/studio/upload-client';
import { CONTENT_TYPE_META } from '@/lib/studio/constants';
import type { StudioClientRef } from '@/lib/data/studio';
import type { StudioContentType, StudioWorkflowMode } from '@/types/studio';
import { createSourceVideoAction, startProcessingAction } from './actions';

const CONTENT_TYPES = Object.entries(CONTENT_TYPE_META) as [
  StudioContentType,
  { label: string; defaultMode: StudioWorkflowMode },
][];

const selectClass =
  'flex h-10 w-full rounded-xl border border-border/70 bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

export function StudioUploadOpener({ clients }: { clients: StudioClientRef[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Importer une vidéo
      </Button>
      <UploadDialog open={open} onOpenChange={setOpen} clients={clients} />
    </>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  clients,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: StudioClientRef[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState('');
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<StudioContentType>('podcast');
  const [workflowMode, setWorkflowMode] = useState<StudioWorkflowMode>('transcript');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'creating' | 'uploading' | 'starting'>('idle');

  useEffect(() => {
    setWorkflowMode(CONTENT_TYPE_META[contentType].defaultMode);
  }, [contentType]);

  useEffect(() => {
    if (!clientId) {
      setProjects([]);
      setProjectId('');
      return;
    }
    const supabase = createClient();
    supabase
      .from('projects')
      .select('id, title')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setProjects((data as { id: string; title: string }[]) ?? []));
  }, [clientId]);

  async function handleSubmit() {
    if (!clientId || !title.trim() || !file) {
      toast.error('Client, titre et fichier sont requis.');
      return;
    }
    setBusy(true);
    setPhase('creating');
    try {
      const created = await createSourceVideoAction({
        clientId,
        projectId: projectId || null,
        title: title.trim(),
        contentType,
        workflowMode,
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type || 'video/mp4',
      });
      if (!created.ok || !created.data) {
        throw new Error(created.ok ? 'Création impossible.' : created.error);
      }

      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Session expirée — reconnectez-vous.');

      setPhase('uploading');
      await resumableUpload({
        bucket: created.data.bucket,
        objectPath: created.data.uploadPath,
        file,
        accessToken,
        contentType: file.type || 'video/mp4',
        onProgress: setProgress,
      });

      setPhase('starting');
      const started = await startProcessingAction(created.data.id);
      if (!started.ok) throw new Error(started.error);

      toast.success('Vidéo importée — traitement en cours.');
      onOpenChange(false);
      router.push(`/studio/source/${created.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec du téléversement.');
    } finally {
      setBusy(false);
      setPhase('idle');
      setProgress(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (busy ? null : onOpenChange(v))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer une vidéo source</DialogTitle>
          <DialogDescription>
            Le fichier original reste intact. Un proxy léger est généré pour le montage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Client</label>
            <select
              className={selectClass}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={busy}
            >
              <option value="">Sélectionner un client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {projects.length > 0 ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Projet (optionnel)</label>
              <select
                className={selectClass}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={busy}
              >
                <option value="">Aucun</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Titre</label>
            <Input
              className="border-border/70 bg-background/40"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Podcast #42 — Invité X"
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type de contenu</label>
              <select
                className={selectClass}
                value={contentType}
                onChange={(e) => setContentType(e.target.value as StudioContentType)}
                disabled={busy}
              >
                {CONTENT_TYPES.map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mode</label>
              <select
                className={selectClass}
                value={workflowMode}
                onChange={(e) => setWorkflowMode(e.target.value as StudioWorkflowMode)}
                disabled={busy}
              >
                <option value="transcript">Transcription + IA</option>
                <option value="visual">Visuel (marqueurs)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fichier vidéo</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border file:border-border/70 file:bg-background/40 file:px-4 file:py-2 file:text-sm file:text-foreground"
            />
            {file ? (
              <p className="text-xs text-muted-foreground">
                {file.name} — {(file.size / (1024 * 1024)).toFixed(1)} Mo
              </p>
            ) : null}
          </div>

          {phase === 'uploading' ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Téléversement…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
          {phase === 'creating' ? <p className="text-xs text-muted-foreground">Préparation…</p> : null}
          {phase === 'starting' ? (
            <p className="text-xs text-muted-foreground">Démarrage du traitement…</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'En cours…' : 'Importer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

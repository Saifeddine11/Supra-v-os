import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { listDocumentsWithRelations } from '@/lib/data/documents';
import { listClients } from '@/lib/data/clients';
import { listProjectsForSelect } from '@/lib/data/projects-list';
import { getAuthContext } from '@/lib/auth/permissions';
import { canModifyClients } from '@/lib/auth/capabilities';
import { DOCUMENT_TYPE_LABELS } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { DocumentFormDialog } from './document-form-dialog';
import { DocumentRowActions } from './document-row-actions';
import type { DocumentWithRelations } from '@/lib/data/documents';
import { isSupabaseStorageUploadConfigured } from '@/lib/storage/buckets';

export const metadata: Metadata = { title: 'Documents' };

function fileTypeLabel(d: DocumentWithRelations): string {
  if (d.file_storage_path && d.mime_type) {
    const m = d.mime_type.toLowerCase();
    if (m.includes('pdf')) return 'PDF';
    if (m.startsWith('image/')) return 'Image';
    if (m.startsWith('video/')) return 'Vidéo';
    if (m.includes('zip')) return 'ZIP';
    return d.mime_type.split('/').pop() ?? d.mime_type;
  }
  if (d.file_storage_path) return 'Fichier';
  if (d.file_url) return 'URL';
  if (d.external_link) return 'Lien';
  return '—';
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp?.archived === '1';

  const ctx = await getAuthContext();
  const canModify = canModifyClients(ctx?.role ?? null);
  const storageConfigured = isSupabaseStorageUploadConfigured();

  const [documents, clients, projects] = await Promise.all([
    listDocumentsWithRelations({ includeArchived }, ctx),
    listClients({}, ctx),
    listProjectsForSelect(ctx),
  ]);
  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      {!storageConfigured ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/45 bg-gradient-to-br from-amber-500/12 to-amber-500/5 px-4 py-3 text-sm text-foreground dark:from-amber-500/15 dark:to-amber-500/8"
        >
          <p className="font-medium text-amber-900 dark:text-amber-100">Stockage fichiers non configuré</p>
          <p className="mt-1 text-muted-foreground dark:text-amber-100/80">
            Pour l&apos;upload vers le bucket « documents », définissez{' '}
            <code className="rounded bg-background/60 px-1 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> et{' '}
            <code className="rounded bg-background/60 px-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> sur le serveur,
            et appliquez la migration des buckets. Les liens URL et externes fonctionnent sans Storage.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fichiers privés (Storage + signed URL) ou liens externes — la case « visible client » contrôle le portail.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link href={includeArchived ? '/documents' : '/documents?archived=1'}>
              {includeArchived ? 'Masquer archivés' : 'Inclure archivés'}
            </Link>
          </Button>
          {canModify ? (
            <DocumentFormDialog
              clients={clientOpts}
              projects={projects}
              storageConfigured={storageConfigured}
              trigger={
                <Button variant="primary" className="rounded-full">
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      <SectionCard title="Bibliothèque" description={`${documents.length} entrée(s)`}>
        {documents.length === 0 ? (
          <EmptyState
            title="Aucun document"
            description="Ajoutez un fichier (Storage), une URL ou un lien externe."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[1024px] text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Type doc</th>
                  <th className="px-4 py-3 font-medium">Fichier</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Projet</th>
                  <th className="px-4 py-3 font-medium">Portail</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Ajout</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {documents.map((d) => (
                  <tr key={d.id} className="bg-card/40 transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{DOCUMENT_TYPE_LABELS[d.type]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fileTypeLabel(d)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.clients?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.projects?.title ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={d.visible_to_client ? 'success' : 'outline'}>
                        {d.visible_to_client ? 'Client' : 'Interne'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {d.archived_at ? (
                        <Badge variant="outline">Archivé</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Actif</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {format(new Date(d.uploaded_at), 'd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DocumentRowActions doc={d} canModify={canModify} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

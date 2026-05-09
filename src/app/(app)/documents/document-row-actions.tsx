'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Archive, Download, ExternalLink } from 'lucide-react';
import type { DocumentRecord } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { archiveDocumentAction, deleteDocumentAction } from './actions';

function openHref(doc: DocumentRecord): string | null {
  if (doc.file_storage_path) return `/api/documents/${doc.id}/download`;
  return doc.file_url || doc.external_link || null;
}

export function DocumentRowActions({
  doc,
  canModify,
}: {
  doc: DocumentRecord;
  canModify: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const href = openHref(doc);

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {href ? (
        <Button variant="ghost" size="sm" className="h-8" asChild>
          <a href={href} target="_blank" rel="noopener noreferrer">
            <Download className="h-3.5 w-3.5" />
            {doc.file_storage_path ? 'Télécharger' : 'Ouvrir'}
          </a>
        </Button>
      ) : null}
      {doc.client_id ? (
        <Button variant="ghost" size="sm" className="h-8" asChild>
          <Link href={`/clients/${doc.client_id}`}>
            <ExternalLink className="h-3.5 w-3.5" />
            Client
          </Link>
        </Button>
      ) : null}
      {canModify && !doc.archived_at ? (
        <ConfirmDialog
          title="Archiver ce document ?"
          description="Il disparaît de la liste principale mais reste consultable via « Inclure les archivés »."
          confirmLabel="Archiver"
          onConfirm={() =>
            startTransition(async () => {
              await archiveDocumentAction(doc.id);
              router.refresh();
            })
          }
        >
          <Button variant="ghost" size="sm" className="h-8" disabled={pending}>
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </ConfirmDialog>
      ) : null}
      {canModify ? (
        <ConfirmDialog
          title="Supprimer ce document ?"
          description="Irréversible. Les fichiers sur Supabase Storage seront supprimés si configurés."
          confirmLabel="Supprimer"
          onConfirm={() =>
            startTransition(async () => {
              await deleteDocumentAction(doc.id);
              router.refresh();
            })
          }
        >
          <Button variant="ghost" size="sm" className="h-8 text-destructive" disabled={pending}>
            Suppr.
          </Button>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

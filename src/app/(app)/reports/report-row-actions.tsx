'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Report } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ReportWhatsappButton } from './report-whatsapp-button';
import { deleteReportAction } from './actions';

export function ReportRowActions({ report, canModify }: { report: Report; canModify: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <ReportWhatsappButton text={report.whatsapp_text} />
      {canModify ? (
        <Button variant="ghost" size="sm" className="h-8" asChild>
          <Link href={`/reports/${report.id}`}>Éditer</Link>
        </Button>
      ) : (
        <Button variant="ghost" size="sm" className="h-8" asChild>
          <Link href={`/reports/${report.id}`}>Voir</Link>
        </Button>
      )}
      {canModify ? (
        <ConfirmDialog
          title="Supprimer ce rapport ?"
          description="Irréversible."
          confirmLabel="Supprimer"
          onConfirm={() =>
            startTransition(async () => {
              await deleteReportAction(report.id);
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

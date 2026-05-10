'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setDocumentClientVisibilityAction } from '@/app/(app)/documents/actions';
import { Button } from '@/components/ui/button';

export function DocumentPortalVisibilityButton({
  documentId,
  visible,
  canModify,
}: {
  documentId: string;
  visible: boolean;
  canModify: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canModify) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full text-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setDocumentClientVisibilityAction(documentId, !visible);
          router.refresh();
        })
      }
    >
      {visible ? 'Masquer du portail' : 'Afficher sur le portail'}
    </Button>
  );
}

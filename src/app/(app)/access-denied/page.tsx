import type { Metadata } from 'next';
import { AccessDenied } from '@/components/shared/access-denied';

export const metadata: Metadata = { title: 'Accès refusé' };

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[min(70vh,calc(100vh-8rem))] flex-col items-center justify-center px-4 py-12">
      <AccessDenied />
    </div>
  );
}

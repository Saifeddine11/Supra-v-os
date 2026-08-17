import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetPasswordForm } from './set-password-form';

export const metadata: Metadata = {
  title: 'Créer votre mot de passe',
};

function SetPasswordFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Chargement…</p>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordFallback />}>
      <SetPasswordForm />
    </Suspense>
  );
}

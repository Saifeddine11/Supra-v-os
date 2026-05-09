import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Accès refusé — à utiliser côté pages métier (composant serveur ou client).
 */
export function AccessDenied() {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border/80 bg-card/95 p-8 text-center shadow-[0_20px_50px_-24px_rgba(255,61,10,0.25)] backdrop-blur-sm sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/[0.08]">
        <ShieldOff className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h1 className="mt-6 font-sans text-xl font-semibold tracking-tight text-foreground">Accès non autorisé</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Votre rôle ne permet pas d&apos;accéder à cette section.
      </p>
      <Button asChild variant="primary" className="mt-8 rounded-full">
        <Link href="/dashboard">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/section-card';

export interface ModulePlaceholderProps {
  title: string;
  description: string;
  previewPoints: string[];
  primaryCta?: { href: string; label: string };
}

export function ModulePlaceholder({
  title,
  description,
  previewPoints,
  primaryCta,
}: ModulePlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
      </div>

      <SectionCard
        title="Module en préparation"
        description="Cette section sera connectée à Supabase et aux workflows métier dans une prochaine itération."
        action={
          primaryCta ? (
            <Button variant="primary" size="sm" asChild>
              <Link href={primaryCta.href}>
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                Retour au tableau de bord
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )
        }
      >
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.08] text-primary">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Aperçu des prochaines capacités</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {previewPoints.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

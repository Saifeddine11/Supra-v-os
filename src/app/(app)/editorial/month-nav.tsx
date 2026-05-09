'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EditorialMonthNav({ year, month }: { year: number; month: number }) {
  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() - 1);
  const prevY = d.getFullYear();
  const prevM = d.getMonth() + 1;
  d.setMonth(d.getMonth() + 2);
  const nextY = d.getFullYear();
  const nextM = d.getMonth() + 1;

  const label = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" className="rounded-full" asChild>
        <Link href={`/editorial?y=${prevY}&m=${prevM}`} aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </Button>
      <span className="min-w-[160px] text-center font-medium capitalize text-foreground">{label}</span>
      <Button variant="outline" size="sm" className="rounded-full" asChild>
        <Link href={`/editorial?y=${nextY}&m=${nextM}`} aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

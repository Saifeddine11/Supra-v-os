import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import type { ClientFollowMock } from '@/data/dashboard-mock';

const tagLabel: Record<ClientFollowMock['tag'], string> = {
  active: 'Actif',
  'follow-up': 'Relance',
  portal: 'Portail',
  invoice: 'Facture',
};

export function ClientOverview({ clients }: { clients: ClientFollowMock[] }) {
  return (
    <SectionCard title="Clients à suivre" description="Synthèse relationnelle et points d’attention.">
      <ul className="space-y-2">
        {clients.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-gradient-to-br from-card to-surface-secondary px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.note}</p>
            </div>
            <Badge variant="primary" className="w-fit shrink-0">
              {tagLabel[c.tag]}
            </Badge>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

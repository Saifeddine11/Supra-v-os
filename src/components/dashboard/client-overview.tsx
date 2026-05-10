import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import type { ClientFollowMock } from '@/data/dashboard-mock';
import { cn } from '@/lib/utils/cn';
import { clientFollowTagToTone, getStatusBlockSurface } from '@/lib/ui/status-block-tone';

const tagLabel: Record<ClientFollowMock['tag'], string> = {
  active: 'Actif',
  'follow-up': 'Relance',
  portal: 'Portail',
  invoice: 'Facture',
};

export function ClientOverview({ clients }: { clients: ClientFollowMock[] }) {
  return (
    <SectionCard
      title="Clients à suivre"
      description="Clients actifs récents — signaux facture, validation vidéo ou portail."
    >
      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun client à suivre pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li
              key={c.id}
              className={cn(
                'flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
                getStatusBlockSurface(clientFollowTagToTone(c.tag)),
              )}
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
      )}
    </SectionCard>
  );
}

import type { Metadata } from 'next';
import { requireClientAuth } from '@/lib/clients/session';
import { loadClientProjects } from '@/lib/clients/workspace-data';
import { ClientProjectList, ClientSectionTitle, ClientSurface } from '@/components/client-workspace/client-ui';

export const metadata: Metadata = { title: 'Projets' };

export default async function ClientProjectsPage() {
  const session = await requireClientAuth();
  const { projects } = await loadClientProjects(session);
  return (
    <div className="mx-auto max-w-5xl">
      <ClientSurface>
        <ClientSectionTitle title="Vos projets" hint="Uniquement les dossiers rattachés à votre compte." />
        <ClientProjectList projects={projects} empty="Aucun projet n’est encore partagé de votre côté." />
      </ClientSurface>
    </div>
  );
}

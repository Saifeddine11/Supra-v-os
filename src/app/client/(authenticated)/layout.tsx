import { requireClientAuth } from '@/lib/clients/session';
import { loadClientShellProfile } from '@/lib/clients/workspace-data';
import { ClientWorkspaceShell } from '@/components/client-workspace/client-shell';

export default async function ClientAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireClientAuth();
  const profile = await loadClientShellProfile(session);
  return (
    <ClientWorkspaceShell
      clientName={profile.name}
      userName={session.fullName?.trim() || session.email}
      email={session.email}
      logoUrl={profile.logoUrl}
      colorHex={profile.colorHex}
      showReports={profile.reportsAvailable}
    >
      {children}
    </ClientWorkspaceShell>
  );
}

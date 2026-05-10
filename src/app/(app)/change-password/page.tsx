import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/permissions';
import { ChangePasswordForm } from './change-password-form';

function firstName(fullName: string): string {
  const p = fullName.trim().split(/\s+/)[0];
  return p || '—';
}

export default async function ChangePasswordPage() {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    redirect('/login?next=/change-password');
  }

  return <ChangePasswordForm employeeFirstName={firstName(ctx.employee.full_name)} />;
}

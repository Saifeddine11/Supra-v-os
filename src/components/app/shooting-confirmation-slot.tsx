import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth/permissions';
import { fetchShootingConfirmationQueue } from '@/lib/data/shooting-confirmation-queue';
import { ShootingConfirmationHost } from '@/components/videos/shooting-confirmation-modal';

async function ShootingConfirmationQueueInner({ userId }: { userId: string }) {
  const ctx = await getAuthContext();
  if (!ctx?.employee) return null;
  let queue: Awaited<ReturnType<typeof fetchShootingConfirmationQueue>> = [];
  try {
    queue = await fetchShootingConfirmationQueue(ctx);
  } catch {
    queue = [];
  }
  if (queue.length === 0) return null;
  return <ShootingConfirmationHost userId={userId} initialQueue={queue} />;
}

/** Loads shooting confirmations after the app shell, without blocking navigation. */
export function ShootingConfirmationSlot({ userId }: { userId: string }) {
  return (
    <Suspense fallback={null}>
      <ShootingConfirmationQueueInner userId={userId} />
    </Suspense>
  );
}

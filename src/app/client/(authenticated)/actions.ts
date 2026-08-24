'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLIENT_LOGIN_PATH } from '@/lib/clients/auth-errors';
import { approveClientVideo, requestClientVideoRevision } from '@/lib/clients/video-validation';
import type { ActionResult } from '@/lib/actions/types';

export async function signOutClientAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(CLIENT_LOGIN_PATH);
}

export async function approveClientVideoAction(videoId: string): Promise<ActionResult> {
  return approveClientVideo(videoId);
}

export async function requestClientVideoRevisionAction(
  videoId: string,
  comment: string,
): Promise<ActionResult> {
  return requestClientVideoRevision(videoId, comment);
}

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';
import { ensureEmployeeLinkedByEmail } from '@/lib/employees/auth-provision';

function safeNext(raw: string | null): string {
  if (!raw) return '/dashboard';
  return raw.startsWith('/') ? raw : '/dashboard';
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const nextPath = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');

  const supabaseUrl = normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    const to = new URL('/login', request.url);
    to.searchParams.set('error', 'Configuration Supabase manquante.');
    return NextResponse.redirect(to);
  }

  const response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const to = new URL('/login', request.url);
      to.searchParams.set('error', "Lien d'activation invalide ou expiré. Demandez une nouvelle invitation.");
      return NextResponse.redirect(to);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const to = new URL('/login', request.url);
    to.searchParams.set('error', 'Session non créée depuis le lien. Réessayez.');
    return NextResponse.redirect(to);
  }

  // Défense en profondeur : si l'employé n'était pas encore lié par user_id, lier par e-mail.
  try {
    const admin = createAdminClient();
    const link = await ensureEmployeeLinkedByEmail(admin, user.id, user.email);
    if (link.error) {
      const to = new URL('/login', request.url);
      to.searchParams.set('error', link.error);
      return NextResponse.redirect(to);
    }
  } catch {
    // La liaison est best-effort : on laisse la suite gérer un éventuel "profil introuvable".
  }

  const to = new URL(nextPath, request.url);
  return NextResponse.redirect(to, { headers: response.headers });
}


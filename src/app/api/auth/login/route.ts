/**
 * POST /api/auth/login
 * --------------------------------------------------------------------------
 * Server-side sign-in (browser calls same-origin /api only).
 * Uses anon key + cookies — never SUPABASE_SERVICE_ROLE_KEY.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { normalizeSupabaseProjectUrl } from '@/lib/supabase/normalize-url';
import { clientIpFrom, rateLimit } from '@/lib/security/rate-limit';
import { isPerfLogEnabled, perfLog, perfMs } from '@/lib/perf/dev-time';

const NO_EMPLOYEE_MSG =
  'Compte connecté mais aucun profil employé trouvé.';

const SUPABASE_DNS_MSG =
  'Impossible de joindre Supabase (nom de domaine introuvable). Dans .env.local, remplacez NEXT_PUBLIC_SUPABASE_URL par l’URL exacte du projet : Supabase Dashboard → Settings → API → Project URL (https://<réf-projet>.supabase.co). Les valeurs du type xxxxxxxxxxxx.supabase.co sont des exemples : mettez votre vraie référence. Enregistrez le fichier puis redémarrez npm run dev.';

const SUPABASE_URL_PLACEHOLDER_MSG =
  'NEXT_PUBLIC_SUPABASE_URL ressemble encore à un exemple (placeholder). Remplacez-la par l’URL réelle du projet dans Supabase (Settings → API), puis redémarrez npm run dev.';

const SUPABASE_ANON_PLACEHOLDER_MSG =
  'NEXT_PUBLIC_SUPABASE_ANON_KEY est encore un placeholder ou invalide. Copiez la clé « anon » / « publishable » depuis Supabase (Settings → API), puis redémarrez npm run dev.';

/** Détecte les refs factices (ex. xxxxxxxxxxxx) sans rejeter une vraie ref qui contiendrait la sous-chaîne « xxxx ». */
function supabaseUrlLooksLikePlaceholder(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const m = host.match(/^([^.]+)\.supabase\.co$/);
    if (!m) return false;
    const ref = m[1];
    if (/^x+$/i.test(ref)) return true;
    if (ref === 'xxxxxxxxxxxx') return true;
    if (/^your[-_]?project[-_]?ref$/i.test(ref)) return true;
    if (ref === 'project_ref') return true;
    return false;
  } catch {
    return false;
  }
}

function supabaseAnonKeyLooksLikePlaceholder(key: string): boolean {
  const k = key.trim().toLowerCase();
  if (!k) return true;
  if (k === 'your_publishable_or_anon_key') return true;
  if (k.startsWith('your_')) return true;
  return false;
}

function describeSupabaseFetchFailure(err: unknown): { message: string; code: string } {
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.message);
    if (err.cause instanceof Error) parts.push(err.cause.message);
    const c = err.cause as NodeJS.ErrnoException | undefined;
    if (c?.code) parts.push(String(c.code));
  }
  const text = parts.join(' ');

  if (/ENOTFOUND|getaddrinfo/i.test(text)) {
    return { message: SUPABASE_DNS_MSG, code: 'SUPABASE_DNS' };
  }
  if (/ECONNREFUSED|ETIMEDOUT|CERT_|SSL|certificate/i.test(text)) {
    return {
      message:
        'Connexion à Supabase refusée ou sécurisée impossible. Vérifiez l’URL (https), le réseau, un VPN ou un proxy, puis réessayez.',
      code: 'SUPABASE_NETWORK',
    };
  }
  return {
    message:
      'Le service d’authentification Supabase n’a pas répondu. Vérifiez NEXT_PUBLIC_SUPABASE_URL, la clé anon, et que la machine qui lance Next.js a accès à Internet.',
    code: 'SUPABASE_UNREACHABLE',
  };
}

function mapAuthMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'E-mail ou mot de passe incorrect.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Veuillez confirmer votre adresse e-mail avant de vous connecter.';
  }
  return message;
}

/** GET → 405 with JSON (browser check / debugging). */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Méthode non autorisée. Utilisez POST avec JSON { "email", "password" }.',
      allow: ['POST'],
    },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(request: NextRequest) {
  // Best-effort rate-limit (10 tentatives par 60s par IP). Empêche le bruteforce
  // séquentiel ; un attaquant distribué nécessitera une couche Upstash/KV pour
  // un blocage strict — à brancher au moment du go-live.
  const ip = clientIpFrom(request);
  const rl = rateLimit({ key: `login:${ip}`, max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans un instant.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (parseErr) {
    console.error('[auth/login] JSON body parse error', parseErr);
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const email =
    typeof body === 'object' &&
    body !== null &&
    'email' in body &&
    typeof (body as { email: unknown }).email === 'string'
      ? (body as { email: string }).email.trim()
      : '';
  const password =
    typeof body === 'object' &&
    body !== null &&
    'password' in body &&
    typeof (body as { password: unknown }).password === 'string'
      ? (body as { password: string }).password
      : '';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'E-mail et mot de passe requis.' },
      { status: 400 }
    );
  }

  const missingEnv: string[] = [];
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl) missingEnv.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!rawAnon) missingEnv.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (missingEnv.length > 0) {
    console.error('[auth/login] missing env:', missingEnv.join(', '));
    return NextResponse.json(
      {
        error: `Configuration serveur incomplète — variable(s) manquante(s) : ${missingEnv.join(', ')}.`,
        code: 'ENV_MISSING',
        missing: missingEnv,
      },
      { status: 500 }
    );
  }

  const url = normalizeSupabaseProjectUrl(rawUrl);
  const anonKey = rawAnon as string;
  if (supabaseAnonKeyLooksLikePlaceholder(anonKey)) {
    console.error('[auth/login] anon key still placeholder');
    return NextResponse.json(
      { error: SUPABASE_ANON_PLACEHOLDER_MSG, code: 'ENV_ANON_PLACEHOLDER' },
      { status: 500 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json(
        {
          error:
            'NEXT_PUBLIC_SUPABASE_URL doit commencer par https:// (URL du projet Supabase).',
          code: 'SUPABASE_URL_INVALID',
        },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        error:
          'NEXT_PUBLIC_SUPABASE_URL n’est pas une URL valide. Copiez la Project URL depuis Supabase (Settings → API).',
        code: 'SUPABASE_URL_INVALID',
      },
      { status: 500 }
    );
  }

  if (supabaseUrlLooksLikePlaceholder(url)) {
    console.error('[auth/login] Supabase URL hostname looks like placeholder');
    return NextResponse.json(
      { error: SUPABASE_URL_PLACEHOLDER_MSG, code: 'SUPABASE_URL_PLACEHOLDER' },
      { status: 502 }
    );
  }

  const sessionCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        sessionCookies.push(...cookiesToSet);
      },
    },
  });

  try {
    const signStart = performance.now();
    perfLog('[login-perf] signInWithPassword start');
    const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    const signMs = perfMs(signStart);
    perfLog(`[login-perf] signInWithPassword end: ${signMs} ms`);

    if (signError) {
      console.warn('[auth/login] signIn error:', signError.code || 'unknown');
      const fail = NextResponse.json(
        { error: mapAuthMessage(signError.message) },
        { status: 401 }
      );
      if (isPerfLogEnabled()) {
        fail.headers.set('Server-Timing', `signInWithPassword;dur=${signMs}`);
      }
      return fail;
    }

    const user = signData.user;
    if (!user) {
      console.error('[auth/login] no user after signIn');
      return NextResponse.json(
        { error: 'Session invalide après connexion. Réessayez.' },
        { status: 500 }
      );
    }

    const empStart = performance.now();
    const empLookup = await supabase
      .from('employees')
      .select('id, must_change_password')
      .eq('user_id', user.id)
      .maybeSingle();
    const empMs = perfMs(empStart);
    perfLog(`[login-perf] employee lookup: ${empMs} ms`);

    if (empLookup.error) {
      console.error('[auth/login] employees lookup:', empLookup.error.message);
      return NextResponse.json(
        { error: 'Impossible de vérifier le profil employé. Réessayez plus tard.' },
        { status: 500 }
      );
    }

    const employee = empLookup.data as { id: string; must_change_password: boolean } | null;

    if (!employee) {
      console.warn('[auth/login] no employee row for auth user');
      return NextResponse.json({ error: NO_EMPLOYEE_MSG }, { status: 403 });
    }

    const mustChangePassword = employee.must_change_password === true;
    const res = NextResponse.json({
      ok: true as const,
      success: true as const,
      mustChangePassword,
    });
    sessionCookies.forEach(({ name, value, options }) => {
      res.cookies.set(name, value, options);
    });
    if (isPerfLogEnabled()) {
      res.headers.set(
        'Server-Timing',
        `signInWithPassword;dur=${signMs}, employeeLookup;dur=${empMs}`,
      );
    }
    return res;
  } catch (err) {
    console.error('[auth/login] unexpected error', err);
    const { message, code } = describeSupabaseFetchFailure(err);
    return NextResponse.json({ error: message, code }, { status: 502 });
  }
}

import 'server-only';

/**
 * Petite défense rate-limit best-effort, en mémoire de l'instance.
 * --------------------------------------------------------------------------
 * Vercel sert chaque requête sur une instance serverless qui peut être réutilisée
 * (warm) ou nouvellement créée (cold). Conséquence :
 *   - Sur une instance warm, on bloque effectivement le bruteforce séquentiel.
 *   - Sur des instances froides ou parallèles, un attaquant peut contourner
 *     en répartissant. Pour une protection robuste, brancher Upstash Redis
 *     ou Vercel KV ; cette implémentation est volontairement zéro-dépendance
 *     et reste **utile** comme première couche.
 *
 * Identifiant recommandé : IP (x-forwarded-for) + chemin sensible.
 */

type Bucket = { count: number; resetAt: number };
const STORE = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Identifiant logique (ex : `login:ip:1.2.3.4` ou `respond:client:abc`). */
  key: string;
  /** Nombre max d'évènements autorisés dans la fenêtre. */
  max: number;
  /** Durée de la fenêtre en ms. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit({ key, max, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = STORE.get(key);
  if (!bucket || bucket.resetAt < now) {
    STORE.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  bucket.count += 1;
  STORE.set(key, bucket);
  if (bucket.count > max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec: retryAfter };
  }
  return {
    ok: true,
    remaining: Math.max(0, max - bucket.count),
    retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** Extrait une IP "raisonnable" depuis les en-têtes de la requête. */
export function clientIpFrom(request: Request): string {
  const h = request.headers;
  const fwd = h.get('x-forwarded-for');
  if (fwd) {
    const ip = fwd.split(',')[0]?.trim();
    if (ip) return ip;
  }
  return h.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Compétences opérationnelles (assignation vidéo, filtres équipe).
 * Ne jamais s’en servir pour RBAC, nav, ou capabilities — seul `employees.role` compte.
 */
import type { Employee, UserRole } from '@/types/database';
import { OPERATIONAL_SKILL_ROLES } from '@/types/domain';

const ALLOWED = new Set<UserRole>(OPERATIONAL_SKILL_ROLES);

export function normalizeOperationalSkills(raw: UserRole[]): UserRole[] {
  return [...new Set(raw.filter((r) => ALLOWED.has(r)))].sort();
}

export function parseOperationalSkillsFromForm(formData: FormData): UserRole[] {
  const raw = formData.getAll('operational_skills').map((v) => String(v).trim()) as UserRole[];
  return normalizeOperationalSkills(raw);
}

/**
 * Normalise la colonne `operational_skills` quelle que soit la forme renvoyée par PostgREST / JSON.
 * (tableau, littéral Postgres `{a,b}`, chaîne JSON, ou objet clé → booléen hérité d’anciennes écritures.)
 */
export function coerceOperationalSkills(value: unknown): UserRole[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    const raw = value.filter((x): x is string => typeof x === 'string').map((x) => x.trim()) as UserRole[];
    return normalizeOperationalSkills(raw);
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || s === '{}') return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s) as unknown;
        return coerceOperationalSkills(parsed);
      } catch {
        return [];
      }
    }
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      const parts = inner
        .split(',')
        .map((p) => p.trim().replace(/^"+|"+$/g, ''))
        .filter(Boolean) as UserRole[];
      return normalizeOperationalSkills(parts);
    }
    if (ALLOWED.has(s as UserRole)) return normalizeOperationalSkills([s as UserRole]);
    return [];
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const roles: UserRole[] = [];
    for (const [k, v] of Object.entries(o)) {
      if (!ALLOWED.has(k as UserRole)) continue;
      if (v === true || v === 1 || v === 'true' || v === k) roles.push(k as UserRole);
    }
    return normalizeOperationalSkills(roles);
  }
  return [];
}

/** Assignation monteur : rôle principal editor ou compétence editor. */
export function employeeCanBeVideoEditor(e: Pick<Employee, 'role' | 'operational_skills'>): boolean {
  const skills = coerceOperationalSkills(e.operational_skills);
  return e.role === 'editor' || skills.includes('editor');
}

/** Assignation cadreur : rôle principal cameraman ou compétence cameraman. */
export function employeeCanBeVideoCameraman(e: Pick<Employee, 'role' | 'operational_skills'>): boolean {
  const skills = coerceOperationalSkills(e.operational_skills);
  return e.role === 'cameraman' || skills.includes('cameraman');
}

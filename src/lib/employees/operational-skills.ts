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

export function coerceOperationalSkills(value: UserRole[] | null | undefined): UserRole[] {
  return Array.isArray(value) ? value : [];
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

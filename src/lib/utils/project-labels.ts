import { PROJECT_TYPE_OPTIONS } from '@/types/domain';

const map = new Map<string, string>(PROJECT_TYPE_OPTIONS.map((o) => [o.value, o.label]));

export function formatProjectType(type: string): string {
  return map.get(type) ?? type.replace(/_/g, ' ');
}

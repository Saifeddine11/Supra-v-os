import { z } from 'zod';

export const SUPAI_RESULT_GROUP_TYPES = [
  'task_results',
  'video_results',
  'shooting_results',
  'delivery_results',
  'watch_results',
] as const;

export type SupaiResultGroupType = (typeof SUPAI_RESULT_GROUP_TYPES)[number];

export const supaiTaskResultItemSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  clientName: z.string().max(200).nullable().optional(),
  status: z.string().max(80),
  priority: z.string().max(40).nullable().optional(),
  deadline: z.string().max(40).nullable().optional(),
  isOverdue: z.boolean().optional(),
  assigneeNames: z.string().max(200).nullable().optional(),
  href: z.string().max(500),
});

export const supaiVideoResultItemSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  clientName: z.string().max(200).nullable().optional(),
  productionStatus: z.string().max(80),
  shootingDate: z.string().max(40).nullable().optional(),
  deliveryDate: z.string().max(40).nullable().optional(),
  editorNames: z.string().max(200).nullable().optional(),
  cameramanNames: z.string().max(200).nullable().optional(),
  teamNames: z.array(z.string().max(120)).max(8).optional(),
  href: z.string().max(500),
});

export const supaiShootingResultItemSchema = z.object({
  id: z.string().min(1).max(80),
  videoId: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  clientName: z.string().max(200).nullable().optional(),
  shootingDate: z.string().max(40).nullable().optional(),
  date: z.string().max(40).nullable().optional(),
  cameramanNames: z.string().max(200).nullable().optional(),
  teamNames: z.array(z.string().max(120)).max(8).optional(),
  productionStatus: z.string().max(80),
  href: z.string().max(500),
});

export const supaiDeliveryResultItemSchema = z.object({
  id: z.string().min(1).max(80),
  videoId: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  clientName: z.string().max(200).nullable().optional(),
  deliveryDate: z.string().max(40).nullable().optional(),
  date: z.string().max(40).nullable().optional(),
  productionStatus: z.string().max(80),
  href: z.string().max(500),
});

export const supaiWatchResultItemSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  detail: z.string().max(300),
  href: z.string().max(500),
});

export const supaiResultGroupSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('task_results'),
    title: z.string().max(120),
    items: z.array(supaiTaskResultItemSchema).max(25),
  }),
  z.object({
    type: z.literal('video_results'),
    title: z.string().max(120),
    items: z.array(supaiVideoResultItemSchema).max(25),
  }),
  z.object({
    type: z.literal('shooting_results'),
    title: z.string().max(120),
    items: z.array(supaiShootingResultItemSchema).max(25),
  }),
  z.object({
    type: z.literal('delivery_results'),
    title: z.string().max(120),
    items: z.array(supaiDeliveryResultItemSchema).max(25),
  }),
  z.object({
    type: z.literal('watch_results'),
    title: z.string().max(120),
    items: z.array(supaiWatchResultItemSchema).max(12),
  }),
]);

export type SupaiTaskResultItem = z.infer<typeof supaiTaskResultItemSchema>;
export type SupaiVideoResultItem = z.infer<typeof supaiVideoResultItemSchema>;
export type SupaiShootingResultItem = z.infer<typeof supaiShootingResultItemSchema>;
export type SupaiDeliveryResultItem = z.infer<typeof supaiDeliveryResultItemSchema>;
export type SupaiWatchResultItem = z.infer<typeof supaiWatchResultItemSchema>;
export type SupaiResultGroup = z.infer<typeof supaiResultGroupSchema>;

export const supaiResultGroupsSchema = z.array(supaiResultGroupSchema).max(8);

export type SupaiStructuredOperationalResponse = {
  reply: string;
  resultGroups: SupaiResultGroup[];
  intentType: 'ask_calendar_scope' | 'summarize_work' | 'operational_results';
};

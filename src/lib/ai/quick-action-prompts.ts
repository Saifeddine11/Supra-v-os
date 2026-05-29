import {
  getTemplateCursorPosition,
  type ParsedLabeledFields,
} from '@/lib/ai/parse-structured-template';

export type QuickActionId =
  | 'create_task'
  | 'create_video'
  | 'update_task'
  | 'priorities'
  | 'overdue_tasks'
  | 'my_tasks'
  | 'my_videos'
  | 'my_shootings'
  | 'my_clients'
  | 'search_client'
  | 'search_video'
  | 'client_followup'
  | 'draft_message'
  | 'calendar_today'
  | 'calendar_week'
  | 'calendar_month'
  | 'calendar_shootings'
  | 'calendar_deliveries';

export type QuickActionMode = 'input' | 'send';

export type QuickActionDefinition = {
  id: QuickActionId;
  label: string;
  mode: QuickActionMode;
  prompt: string;
  /** Place cursor after this field label (input mode). */
  focusAfterLabel?: string;
};

export const QUICK_ACTION_REPLACE_CONFIRM =
  'Remplacer le texte actuel par ce modèle ? Annuler pour conserver votre texte.';

const TASK_CREATE_TEMPLATE = `Je souhaite créer une tâche avec les informations suivantes :

Titre :
Client :
Assigné(s) :
Vidéo liée :
Échéance :
Priorité : normale
Statut : à faire
Description :

Instructions :
- Si un champ n'est pas nécessaire, laissez-le vide.
- SupAI doit préparer un brouillon, pas créer directement.
- La création doit se faire uniquement après confirmation.`;

const TASK_UPDATE_TEMPLATE = `Je souhaite modifier une tâche avec les informations suivantes :

Tâche à modifier :
Nouveau titre :
Client :
Assigné(s) :
Échéance :
Priorité :
Statut :
Description :

Instructions :
- SupAI doit préparer une modification, pas modifier directement.
- La modification doit se faire uniquement après confirmation.`;

const VIDEO_CREATE_TEMPLATE = `Je souhaite créer une vidéo avec les informations suivantes :

Titre :
Client :
Sujet :
Type :
Tournage :
Livraison client :
Monteur :
Cadreur :
Priorité : normale
Statut initial : idée / brief
Description :

Instructions :
- Si un champ n'est pas nécessaire, laissez-le vide.
- SupAI doit préparer un brouillon, pas créer directement.
- La création doit se faire uniquement après confirmation.`;

const MESSAGE_DRAFT_TEMPLATE = `Je souhaite rédiger un message avec les informations suivantes :

Canal : WhatsApp
Destinataire :
Objectif du message :
Ton : professionnel et amical
Contexte :
Message souhaité :

Instructions :
- SupAI propose un message prêt à copier, sans créer de tâche ni de vidéo.`;

const PRIORITIES_TEMPLATE = `Donne-moi mes priorités opérationnelles aujourd'hui.

Analyse :
- tâches urgentes
- tâches en retard
- vidéos à suivre
- livraisons client
- tournages
- points bloquants

Réponds simplement avec une liste d'actions concrètes.`;

const OVERDUE_TASKS_TEMPLATE = `Montre-moi les tâches en retard à traiter.

Pour chaque tâche, indique :
- titre
- client
- assigné(s)
- échéance
- priorité
- action recommandée

Ne montre pas les tâches terminées, archivées, en attente client ou en révision.`;

const MY_CLIENTS_TEMPLATE = `Montre-moi mes clients visibles et les relances à prévoir.

Pour chaque client, indique :
- nom
- statut
- prochaine action recommandée
- échéances ouvertes si visibles

Ne montre que les clients de mon périmètre commercial.`;

const SEARCH_CLIENT_TEMPLATE = `Je cherche les informations sur ce client :

Nom du client :

Je veux voir :
- résumé du client
- tâches ouvertes
- vidéos en cours
- prochaines échéances
- actions recommandées`;

const SEARCH_VIDEO_TEMPLATE = `Je cherche une vidéo avec les informations suivantes :

Titre de la vidéo :
Client :

Je veux voir :
- statut de production
- date de tournage
- livraison client
- monteur
- cadreur
- prochaines actions`;

const MY_TASKS_TEMPLATE = `Montre-moi mes tâches assignées.

Pour chaque tâche, indique :
- titre
- client
- échéance
- priorité
- statut
- action recommandée

Ne montre que les tâches qui me sont assignées.`;

const MY_SHOOTINGS_TEMPLATE = `Montre-moi mes tournages assignés.

Pour chaque tournage / vidéo, indique :
- titre
- client
- statut de production
- date de tournage
- prochaines actions

Ne montre que les tournages qui me sont assignés.`;

const MY_VIDEOS_TEMPLATE = `Montre-moi mes vidéos et tournages assignés.

Pour chaque vidéo, indique :
- titre
- client
- statut de production
- date de tournage
- livraison client
- prochaines actions

Ne montre que ce qui me concerne directement.`;

const CALENDAR_TODAY_TEMPLATE = `On a quoi aujourd'hui ?`;

const CALENDAR_WEEK_TEMPLATE = `On a quoi cette semaine ?`;

const CALENDAR_MONTH_TEMPLATE = `On a quoi ce mois-ci ?`;

const CALENDAR_SHOOTINGS_TEMPLATE = `Quels tournages cette semaine ?`;

const CALENDAR_DELIVERIES_TEMPLATE = `Quelles livraisons client cette semaine ?`;

const CLIENT_FOLLOWUP_TEMPLATE = `Je souhaite préparer une relance client :

Client :
Objectif de la relance :
Dernier contact :
Message souhaité :

Instructions :
- SupAI propose un message prêt à copier, sans envoi automatique.`;

export const QUICK_ACTION_DEFINITIONS: QuickActionDefinition[] = [
  {
    id: 'create_task',
    label: 'Créer une tâche',
    mode: 'input',
    prompt: TASK_CREATE_TEMPLATE,
    focusAfterLabel: 'Titre',
  },
  {
    id: 'create_video',
    label: 'Créer une vidéo',
    mode: 'input',
    prompt: VIDEO_CREATE_TEMPLATE,
    focusAfterLabel: 'Titre',
  },
  {
    id: 'update_task',
    label: 'Modifier une tâche',
    mode: 'input',
    prompt: TASK_UPDATE_TEMPLATE,
    focusAfterLabel: 'Tâche à modifier',
  },
  {
    id: 'priorities',
    label: 'Mes priorités',
    mode: 'send',
    prompt: PRIORITIES_TEMPLATE,
  },
  {
    id: 'overdue_tasks',
    label: 'Tâches en retard',
    mode: 'send',
    prompt: OVERDUE_TASKS_TEMPLATE,
  },
  {
    id: 'my_tasks',
    label: 'Mes tâches',
    mode: 'send',
    prompt: MY_TASKS_TEMPLATE,
  },
  {
    id: 'my_videos',
    label: 'Mes vidéos',
    mode: 'send',
    prompt: MY_VIDEOS_TEMPLATE,
  },
  {
    id: 'my_shootings',
    label: 'Mes tournages',
    mode: 'send',
    prompt: MY_SHOOTINGS_TEMPLATE,
  },
  {
    id: 'calendar_today',
    label: 'Aujourd’hui',
    mode: 'send',
    prompt: CALENDAR_TODAY_TEMPLATE,
  },
  {
    id: 'calendar_week',
    label: 'Cette semaine',
    mode: 'send',
    prompt: CALENDAR_WEEK_TEMPLATE,
  },
  {
    id: 'calendar_month',
    label: 'Ce mois-ci',
    mode: 'send',
    prompt: CALENDAR_MONTH_TEMPLATE,
  },
  {
    id: 'calendar_shootings',
    label: 'Tournages',
    mode: 'send',
    prompt: CALENDAR_SHOOTINGS_TEMPLATE,
  },
  {
    id: 'calendar_deliveries',
    label: 'Livraisons',
    mode: 'send',
    prompt: CALENDAR_DELIVERIES_TEMPLATE,
  },
  {
    id: 'my_clients',
    label: 'Mes clients',
    mode: 'send',
    prompt: MY_CLIENTS_TEMPLATE,
  },
  {
    id: 'search_client',
    label: 'Chercher un client',
    mode: 'input',
    prompt: SEARCH_CLIENT_TEMPLATE,
    focusAfterLabel: 'Nom du client',
  },
  {
    id: 'search_video',
    label: 'Chercher une vidéo',
    mode: 'input',
    prompt: SEARCH_VIDEO_TEMPLATE,
    focusAfterLabel: 'Titre de la vidéo',
  },
  {
    id: 'client_followup',
    label: 'Relances clients',
    mode: 'input',
    prompt: CLIENT_FOLLOWUP_TEMPLATE,
    focusAfterLabel: 'Client',
  },
  {
    id: 'draft_message',
    label: 'Rédiger un message',
    mode: 'input',
    prompt: MESSAGE_DRAFT_TEMPLATE,
    focusAfterLabel: 'Destinataire',
  },
];

export function getQuickActionById(id: QuickActionId): QuickActionDefinition | undefined {
  return QUICK_ACTION_DEFINITIONS.find((a) => a.id === id);
}

export { getTemplateCursorPosition };

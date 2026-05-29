/** Au-delà de ce seuil, les cartes passent en mode compact + scroll colonne. */
export const KANBAN_COLUMN_COMPACT_THRESHOLD = 8;

/** Largeur fixe des colonnes — ne pas utiliser flex-1 ni shrink. */
export const KANBAN_COLUMN_WIDTH_CLASS = 'w-[320px] shrink-0 flex-none';

/** Hauteur fixe des colonnes (viewport − chrome page). */
export const KANBAN_COLUMN_HEIGHT_CLASS = 'h-[min(calc(100dvh-14rem),720px)]';

/** Carte du board kanban (tasks / videos). */
export const KANBAN_BOARD_OUTER_CLASS =
  'w-full overflow-hidden rounded-[24px] border border-border/60 bg-muted/15 p-2 dark:bg-muted/10 md:p-3';

/** Zone de défilement horizontal — ne jamais mettre overflow-hidden ici. */
export const KANBAN_SCROLL_CLASS =
  'kanban-scroll w-full overflow-x-auto overflow-y-hidden scroll-smooth overscroll-x-contain pb-3 [-webkit-overflow-scrolling:touch]';

/** Rangée de colonnes — width: max-content via w-max. */
export const KANBAN_COLUMNS_ROW_CLASS = 'flex w-max min-w-full items-start gap-4 px-1 md:gap-4 md:px-2';

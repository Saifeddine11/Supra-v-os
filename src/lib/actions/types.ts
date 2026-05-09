export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; code?: string };

export function actionError(message: string, code?: string): ActionResult<never> {
  return { ok: false, error: message, code };
}

export function actionOk<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function getPostgrestError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Une erreur inattendue est survenue.';
}

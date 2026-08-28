// Libelle d'un evenement rendu dans la langue du lecteur.
// Les lignes creees avant cette bascule n'ont pas de cle : leur phrase francaise
// figee reste le seul repli possible, on ne peut pas en reconstruire les parametres.
type Translator = (key: string, params?: Record<string, string | number>) => string;

type EventLike = {
  eventType: string;
  eventLabel?: string | null;
  metadata?: unknown;
};

export function workflowEventLabel(t: Translator, ev: EventLike): string {
  const meta = ev.metadata as { labelKey?: string; labelParams?: Record<string, string | number> } | null;
  if (meta?.labelKey) {
    try {
      return t(meta.labelKey, meta.labelParams ?? {});
    } catch {
      /* cle disparue du catalogue : on retombe sur la phrase stockee */
    }
  }
  return ev.eventLabel || ev.eventType;
}

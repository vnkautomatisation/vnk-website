// Composant de chargement plein page thémé VNK.
// Utilisé par les loading.tsx au niveau des segments de route Next.js App Router.
// Quand un Server Component fetch des données, Next.js affiche automatiquement
// le loading.tsx du segment via <Suspense>. Cela évite l'effet "rien ne se passe".
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function PageLoader({
  label,
  sublabel,
  variant = "inline",
}: {
  /** Texte principal (défaut "Chargement…") */
  label?: string;
  /** Texte secondaire optionnel pour préciser ce qui charge */
  sublabel?: string;
  /** "inline" = centré dans le contenu (recommandé pour loading.tsx de route segment).
   *  "full" = plein écran (overlay, rare — préférer NavigationProgress) */
  variant?: "inline" | "full";
}) {
  const t = useTranslations("admin.ui");
  if (variant === "full") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <LoaderContent label={label ?? t("chargement")} sublabel={sublabel} />
      </div>
    );
  }
  return (
    <div className="min-h-[40vh] flex items-center justify-center py-12">
      <LoaderContent label={label ?? t("chargement")} sublabel={sublabel} />
    </div>
  );
}

function LoaderContent({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center px-4">
      <div className="relative">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center shadow-lg">
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        </div>
        <div className="absolute inset-0 rounded-full bg-[#0F2D52]/20 animate-ping" aria-hidden />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-[#0F2D52]">{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Mini version inline pour les zones étroites (cartes, sections).
 * Pas de plein écran ni de hero, juste un spinner discret + label.
 */
export function InlineLoader({ label }: { label?: string }) {
  const t = useTranslations("admin.ui");
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0F2D52]" />
      <span>{label ?? t("chargement")}</span>
    </div>
  );
}

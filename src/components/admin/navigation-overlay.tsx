"use client";
// Overlay de chargement avec dismissals fiables pour éviter qu'il reste collé.
//
// Mécanismes de fermeture (par ordre de priorité) :
// 1. Pathname / searchParams change (= nouvelle page rendue) → hide immédiat
// 2. Safety timeout 8s → auto-hide même si la nav n'a jamais "terminé"
// 3. Click sur l'overlay → dismiss manuel (échappatoire utilisateur)
// 4. Touche Escape → dismiss manuel
// 5. Browser back/forward (popstate) → reset
// 6. Page visibility change → reset (changement onglet)
//
// L'overlay est NON-bloquant : pointer-events-none sur le wrapper, juste visuel.
// L'utilisateur peut continuer à interagir avec la page si le chargement tarde.
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const SHOW_DELAY_MS = 300; // attendre avant d'afficher (évite flicker sur navs instantanées)
const MAX_VISIBLE_MS = 8000; // safety : auto-hide après 8s

export function NavigationOverlay() {
  const tc = useTranslations("common");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: reset complet de l'état
  const clearAll = () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    setVisible(false);
  };

  // Cache l'overlay quand l'URL change (= nouvelle page rendue)
  useEffect(() => {
    clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Écoute les clicks sur les liens internes + back/forward + escape
  useEffect(() => {
    const startLoading = () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        setVisible(true);
        // Safety : si la nav ne termine jamais, auto-hide après 8s
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(() => {
          setVisible(false);
        }, MAX_VISIBLE_MS);
      }, SHOW_DELAY_MS);
    };

    const handleClick = (e: MouseEvent) => {
      // Ignore modifiers, middle click, defaultPrevented
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const link = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href) return;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        (link.host && link.host !== window.location.host)
      ) {
        return;
      }
      // Same URL → pas de nav, ne pas démarrer
      try {
        const targetUrl = new URL(href, window.location.href);
        if (
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }

      startLoading();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearAll();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearAll();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", clearAll);
    window.addEventListener("pageshow", clearAll);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", clearAll);
      window.removeEventListener("pageshow", clearAll);
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 backdrop-blur-md animate-overlay-fade-in"
      aria-live="polite"
      aria-busy="true"
      onClick={clearAll}
      role="button"
      tabIndex={-1}
    >
      <div className="flex flex-col items-center gap-4 px-8 py-7 rounded-xl bg-background/95 border-2 border-[#0F2D52]/20 shadow-2xl pointer-events-none">
        <div className="relative h-16 w-16">
          <svg
            className="absolute inset-0 h-full w-full animate-spin-slow"
            viewBox="0 0 64 64"
            fill="none"
            aria-hidden
          >
            <circle cx="32" cy="32" r="28" stroke="#0F2D52" strokeOpacity="0.15" strokeWidth="3" />
            <circle cx="32" cy="32" r="28" stroke="#0F2D52" strokeWidth="3" strokeLinecap="round" strokeDasharray="60 200" strokeDashoffset="0" />
          </svg>
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        </div>
        <p className="text-sm font-bold text-[#0F2D52]">{tc("loading")}</p>
        <p className="text-[10px] text-muted-foreground">Cliquez ou appuyez sur Échap pour fermer</p>
      </div>
    </div>
  );
}

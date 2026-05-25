"use client";
// Barre fine en haut de l'écran : feedback instantané dès le clic sur un lien.
//
// Mécanismes de fermeture fiables :
// 1. Pathname / searchParams change → hide
// 2. Safety timeout 8s → auto-hide
// 3. popstate / pageshow → reset (back/forward)
// 4. visibilitychange → reset (tab caché)
//
// Théme VNK navy. Z-index [100] = au-dessus de tout (overlay z-90 inclus).
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SHOW_DELAY_MS = 200;
const MIN_VISIBLE_MS = 250;
const MAX_VISIBLE_MS = 8000; // safety : auto-hide après 8s

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const showAtRef = useRef<number | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper : reset complet
  const clearAll = () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    showAtRef.current = null;
    setVisible(false);
  };

  // Cache la barre quand l'URL change, en respectant MIN_VISIBLE_MS pour éviter flicker
  useEffect(() => {
    if (visible && showAtRef.current) {
      const elapsed = Date.now() - showAtRef.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      hideTimerRef.current = setTimeout(() => {
        clearAll();
      }, remaining);
      return () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      };
    }
    clearAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Listener clicks + back/forward
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
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

      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        setVisible(true);
        showAtRef.current = Date.now();
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(clearAll, MAX_VISIBLE_MS);
      }, SHOW_DELAY_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearAll();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", clearAll);
    window.addEventListener("pageshow", clearAll);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", clearAll);
      window.removeEventListener("pageshow", clearAll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[3px] z-[100] overflow-hidden pointer-events-none"
      aria-hidden
    >
      <div className="h-full w-full bg-[#0F2D52]/10">
        <div className="h-full bg-gradient-to-r from-[#0F2D52] via-[#1a3a66] to-[#0F2D52] animate-nav-progress" />
      </div>
    </div>
  );
}

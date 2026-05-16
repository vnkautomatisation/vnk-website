"use client";
// ─────────────────────────────────────────────────────────
// ThemeProvider — applique le thème admin (light / dark / auto)
// et la couleur d'accent comme variable CSS globale.
//
// - Lit admin.theme via /api/profile/me au premier rendu
// - Applique class "dark" sur <html> si dark ou (auto + prefers-color-scheme: dark)
// - Persiste en localStorage pour éviter le flash au reload
// - Écoute les changements de prefers-color-scheme en mode auto
// ─────────────────────────────────────────────────────────
import { useEffect } from "react";

type Theme = "light" | "dark" | "auto";

function applyTheme(theme: Theme, accent: string | null) {
  const html = document.documentElement;
  const effective: "light" | "dark" =
    theme === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : theme;
  html.classList.toggle("dark", effective === "dark");

  if (accent) {
    html.style.setProperty("--vnk-accent", accent);
  } else {
    html.style.removeProperty("--vnk-accent");
  }
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. Au montage : appliquer immédiatement depuis localStorage (anti-flash)
    try {
      const cached = localStorage.getItem("vnk-admin-theme");
      const cachedAccent = localStorage.getItem("vnk-admin-accent");
      if (cached) applyTheme(cached as Theme, cachedAccent);
    } catch {}

    // 2. Synchroniser depuis le serveur
    fetch("/api/profile/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const theme = (d?.admin?.theme as Theme) ?? "light";
        const accent = (d?.admin?.accentColor as string | null) ?? null;
        const shortcuts = (d?.admin?.shortcuts as Record<string, string> | null) ?? {};
        try {
          localStorage.setItem("vnk-admin-theme", theme);
          localStorage.setItem("vnk-admin-accent", accent ?? "");
          if (shortcuts.search) localStorage.setItem("vnk-admin-shortcut-search", shortcuts.search);
          if (shortcuts.save) localStorage.setItem("vnk-admin-shortcut-save", shortcuts.save);
        } catch {}
        applyTheme(theme, accent);
      })
      .catch(() => {});

    // 3. Écouter les changements système (mode auto)
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      try {
        const t = localStorage.getItem("vnk-admin-theme") as Theme | null;
        if (t === "auto") {
          const accent = localStorage.getItem("vnk-admin-accent");
          applyTheme("auto", accent);
        }
      } catch {}
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  return <>{children}</>;
}

// Helper pour appliquer immédiatement lors d'un changement utilisateur
// (à appeler depuis tab-preferences après save)
export function applyAdminTheme(theme: Theme, accent: string | null) {
  try {
    localStorage.setItem("vnk-admin-theme", theme);
    localStorage.setItem("vnk-admin-accent", accent ?? "");
  } catch {}
  if (typeof document !== "undefined") applyTheme(theme, accent);
}

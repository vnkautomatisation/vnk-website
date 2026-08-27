"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

export function ViewToggle({
  storageKey,
  defaultView = "list",
  onChange,
}: {
  storageKey: string;
  defaultView?: ViewMode;
  onChange?: (view: ViewMode) => void;
}) {
  const t = useTranslations("admin.ui");
  const [view, setView] = useState<ViewMode>(defaultView);

  useEffect(() => {
    const saved = localStorage.getItem(`vnk-view-${storageKey}`);
    if (saved === "grid" || saved === "list") {
      setView(saved);
      onChange?.(saved);
    }
  }, [storageKey, onChange]);

  const toggle = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(`vnk-view-${storageKey}`, v);
    onChange?.(v);
  };

  return (
    <div className="flex border rounded-lg overflow-hidden shrink-0">
      <button
        onClick={() => toggle("grid")}
        className={cn(
          "flex items-center justify-center h-8 w-8 transition-colors",
          view === "grid"
            ? "bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground hover:bg-muted"
        )}
        aria-label={t("vue_grille")}
        title={t("vue_grille")}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => toggle("list")}
        className={cn(
          "flex items-center justify-center h-8 w-8 transition-colors",
          view === "list"
            ? "bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground hover:bg-muted"
        )}
        aria-label={t("vue_liste")}
        title={t("vue_liste")}
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useViewMode(storageKey: string, defaultView: ViewMode = "list") {
  const [view, setView] = useState<ViewMode>(defaultView);

  useEffect(() => {
    const saved = localStorage.getItem(`vnk-view-${storageKey}`);
    if (saved === "grid" || saved === "list") setView(saved);
  }, [storageKey]);

  const setAndSave = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(`vnk-view-${storageKey}`, v);
  };

  return [view, setAndSave] as const;
}

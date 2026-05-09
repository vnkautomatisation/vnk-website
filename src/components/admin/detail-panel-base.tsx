"use client";
import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

/**
 * Base partage pour tous les panneaux de detail entite (client, mandat, devis, facture, contrat).
 * Header gradient navy + slot pour stats + slot pour actions sticky + body scrollable.
 *
 * Le X de fermeture utilise le close natif Radix (style override pour blanc sur navy).
 */
export function DetailPanelBase({
  open,
  onOpenChange,
  loading,
  title,
  subtitle,
  avatarText,
  icon,
  headerStats,
  headerActions,
  children,
  /** Empeche la fermeture par click outside / escape (utile quand sub-modal ouvert) */
  preventClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  title: string;
  subtitle?: string;
  /** Si fourni, affiche un Avatar avec ces initiales. Sinon utilise icon */
  avatarText?: string;
  icon?: ReactNode;
  headerStats?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  preventClose?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-xl p-0 overflow-hidden flex flex-col [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/15 [&>button]:rounded-md [&>button]:p-1.5 [&>button]:top-5 [&>button]:right-5 [&>button]:transition-colors"
        onPointerDownOutside={(e) => { if (preventClose) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (preventClose) e.preventDefault(); }}
      >
        {/* Title/Description toujours presents pour a11y Radix */}
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{subtitle ?? "Détail"}</SheetDescription>

        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Chargement…
          </div>
        ) : (
          <>
            {/* Header gradient navy */}
            <div className="bg-gradient-to-br from-[#0F2D52] to-[#1e4a7e] text-white p-6 space-y-4 shrink-0">
              <div className="flex items-center gap-4">
                {avatarText ? (
                  <Avatar className="h-14 w-14 ring-2 ring-white/20">
                    <AvatarFallback className="bg-white/10 text-white font-bold backdrop-blur">
                      {initials(avatarText)}
                    </AvatarFallback>
                  </Avatar>
                ) : icon ? (
                  <div className="h-14 w-14 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                ) : null}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">{title}</h2>
                  {subtitle && <p className="text-sm text-white/70 truncate">{subtitle}</p>}
                </div>
              </div>

              {headerStats}
              {headerActions}
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PanelStatBox({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur border border-white/10 p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-white/60 font-semibold">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xl font-bold mt-0.5 text-white">{value}</p>
    </div>
  );
}

export function PanelEmptyState({ text, icon: Icon }: { text: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="text-center py-10 px-6 rounded-lg border-2 border-dashed">
      {Icon && <Icon className="h-6 w-6 mx-auto opacity-30 mb-2" />}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

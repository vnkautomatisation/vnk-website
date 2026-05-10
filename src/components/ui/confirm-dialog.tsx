"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "destructive",
  loading = false,
  disableConfirm = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  disableConfirm?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  const isDestructive = variant === "destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header VNK navy ou rouge selon variant */}
        <div
          className={cn(
            "px-6 py-5 text-white relative overflow-hidden",
            isDestructive
              ? "bg-gradient-to-br from-red-700 via-red-600 to-red-700"
              : "bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52]"
          )}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
          <div className="relative flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isDestructive ? (
                <AlertTriangle className="h-5 w-5 text-white" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-white">{title}</DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {description}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Contenu custom optionnel (form champs additionnels) */}
        {children && <div className="px-6 py-4 bg-card border-b">{children}</div>}

        {/* Footer */}
        <div className="px-6 py-4 bg-card flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            className={cn(
              "shadow-md",
              isDestructive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            )}
            onClick={onConfirm}
            disabled={loading || disableConfirm}
          >
            {loading ? "En cours..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Indicateur HelpCircle non utilise mais reserve pour usage futur
export const _ConfirmIcons = { AlertTriangle, ShieldCheck, HelpCircle };

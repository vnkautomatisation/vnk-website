"use client";
import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";

export type PreviewSection = {
  title: string;
  content: ReactNode;
};

export function PreviewModal({
  open,
  onOpenChange,
  title,
  subtitle,
  badge,
  badgeVariant = "secondary",
  sections,
  actions,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  sections: PreviewSection[];
  actions?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("admin.ui");
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none",
          fullscreen
            ? "sm:w-[95vw] sm:max-w-[95vw] sm:h-[95vh] sm:max-h-[95vh] sm:rounded-lg"
            : "sm:w-[95vw] sm:max-w-4xl sm:h-auto sm:max-h-[90vh] sm:rounded-lg",
          className
        )}
      >
        {/* Header */}
        <DialogHeader className="px-4 sm:px-5 py-3 sm:py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-sm sm:text-base truncate">{title}</DialogTitle>
                {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
              </div>
              {subtitle && (
                <DialogDescription className="mt-0.5 text-[11px] sm:text-xs truncate">
                  {subtitle}
                </DialogDescription>
              )}
            </div>
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors shrink-0"
              aria-label={fullscreen ? t("reduire") : t("plein_ecran")}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Maximize2 className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </DialogHeader>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-6">
          {sections.map((section, i) => (
            <div key={i}>
              {i > 0 && <Separator className="mb-4 sm:mb-6" />}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 sm:mb-3">
                  {section.title}
                </h3>
                <div>{section.content}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        {actions && (
          <div className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 flex flex-wrap items-center gap-2 [&>button]:flex-1 sm:[&>button]:flex-initial">
            {actions}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Ligne de detail reutilisable dans une PreviewModal */
export function PreviewField({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between py-1.5", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

"use client";
import { type ReactNode } from "react";
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
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden flex flex-col",
          fullscreen
            ? "sm:max-w-[95vw] sm:max-h-[95vh] h-[95vh]"
            : "sm:max-w-4xl sm:max-h-[85vh]",
          className
        )}
      >
        {/* Header */}
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="truncate">{title}</DialogTitle>
                {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
              </div>
              {subtitle && (
                <DialogDescription className="mt-0.5 truncate">
                  {subtitle}
                </DialogDescription>
              )}
            </div>
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors shrink-0 mr-6"
              title={fullscreen ? "Reduire" : "Plein ecran"}
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
        <div className="flex-1 overflow-y-auto space-y-6 py-2">
          {sections.map((section, i) => (
            <div key={i}>
              {i > 0 && <Separator className="mb-6" />}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {section.title}
                </h3>
                <div>{section.content}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        {actions && (
          <div className="shrink-0 flex flex-wrap items-center gap-2 pt-4 border-t">
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

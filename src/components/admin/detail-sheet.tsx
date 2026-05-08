"use client";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  accent = "bg-blue-500",
  badge,
  badgeVariant = "secondary",
  children,
  actions,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  accent?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("overflow-y-auto", className)}>
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-3">
            {Icon && (
              <div
                className={cn(
                  "h-11 w-11 rounded-lg flex items-center justify-center text-white shrink-0",
                  accent
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="truncate">{title}</SheetTitle>
                {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
              </div>
              {description && (
                <SheetDescription className="mt-0.5 truncate">
                  {description}
                </SheetDescription>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 mt-3">{actions}</div>
          )}
        </SheetHeader>

        <div className="py-4 space-y-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

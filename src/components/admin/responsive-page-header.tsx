"use client";
// Header standardisé pour pages admin/mon-espace.
// Gère responsive : titre + sous-titre + actions wrap correctement sur mobile.
import { cn } from "@/lib/utils";

export function ResponsivePageHeader({
  icon: Icon,
  iconColor = "text-[#0F2D52]",
  title,
  description,
  actions,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold flex items-center gap-2">
          {Icon && <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />}
          <span className="truncate">{title}</span>
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

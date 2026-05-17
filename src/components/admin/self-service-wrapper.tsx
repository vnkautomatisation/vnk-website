"use client";
// Wrapper pour pages "Mon espace" qui réutilisent des vues admin/RH.
// Ajoute un header self-service VNK clair pour distinguer le contexte.
import { cn } from "@/lib/utils";

export function SelfServiceWrapper({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52]/5 to-transparent border border-[#0F2D52]/10 p-4">
        <h1 className="text-lg font-bold flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-[#0F2D52]" />}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

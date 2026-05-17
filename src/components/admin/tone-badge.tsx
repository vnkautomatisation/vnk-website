"use client";
// Badge sémantique réutilisable avec icône optionnelle.
// Distinct du StatusBadge existant (qui mappe des statuts métier).
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-red-100 text-red-700 border-red-200",
  muted: "bg-gray-100 text-gray-600 border-gray-200",
};

export function ToneBadge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] gap-1 font-medium inline-flex items-center", TONE_CLASSES[tone], className)}
    >
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {children}
    </Badge>
  );
}

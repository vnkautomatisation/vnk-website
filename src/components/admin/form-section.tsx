"use client";
// ─────────────────────────────────────────────────────────
// FormSection — header standardisé pour les sections de formulaire
// dans les pages settings. Style : icône navy + label uppercase tracking.
//
// Usage :
//   <FormSection icon={KeyRound} title="Mots de passe">
//     <Field label="Longueur">...</Field>
//   </FormSection>
// ─────────────────────────────────────────────────────────
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function FormSection({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-[#0F2D52]" />}
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
            {title}
          </h3>
        </div>
        {action}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground -mt-1">{description}</p>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

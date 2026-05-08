"use client";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

export function EditModal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon = Pencil,
  accent = "bg-amber-500",
  children,
  submitLabel = "Enregistrer",
  onSubmit,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  accent?: string;
  children: ReactNode;
  submitLabel?: string;
  onSubmit: () => Promise<{ success: boolean; error?: string }>;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await onSubmit();
      if (result.success) {
        toast.success("Modifications enregistrees");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Une erreur est survenue");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-lg", className)}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center text-white shrink-0",
                accent
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-0.5">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {children}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "En cours..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

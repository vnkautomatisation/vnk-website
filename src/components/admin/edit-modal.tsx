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
        toast.success("Modifications enregistrées");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Une erreur est survenue");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-lg",
          className
        )}
      >
        <DialogHeader className="px-4 sm:px-5 py-3 sm:py-4 border-b shrink-0">
          <div className="flex items-center gap-3 pr-8">
            <div
              className={cn(
                "h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center text-white shrink-0",
                accent
              )}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm sm:text-base truncate">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="mt-0.5 text-[11px] sm:text-xs">
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  Formulaire de modification
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-4">
          {children}
        </div>

        <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
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

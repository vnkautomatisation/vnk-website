"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const tc = useTranslations("common");
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Desktop: center modal — max-h évite débordement viewport, overflow auto par défaut
        "fixed left-[50%] top-[50%] z-[10001] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-xl",
        // Mobile: bottom-sheet plein écran, safe area iOS
        "max-sm:left-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:max-h-[92dvh] max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:pb-[max(env(safe-area-inset-bottom),1rem)]",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label={tc("close")}
        className="absolute right-3 top-3 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0F2D52] shadow-md ring-1 ring-black/10 transition-all hover:bg-white hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/40 focus:ring-offset-2 disabled:pointer-events-none"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
        <span className="sr-only">{tc("close")}</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

// ─── Helper pour dialogs avec header navy + body scrollable + footer fixe ───
// Usage :
//   <DialogContent className="max-w-2xl p-0">
//     <DialogScrollableShell
//       header={<DialogHeader>...</DialogHeader>}
//       footer={<DialogFooter>...</DialogFooter>}
//     >
//       <p>{tc("dialog_contenu_long_qui_scroll_proprement")}</p>
//     </DialogScrollableShell>
//   </DialogContent>
const DialogScrollableShell = ({
  header,
  footer,
  children,
  className,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col max-h-[calc(100dvh-3rem)] max-sm:max-h-[92dvh] overflow-hidden -m-6 max-sm:-m-0", className)}>
    {header && <div className="shrink-0">{header}</div>}
    <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
    {footer && <div className="shrink-0 border-t bg-muted/30">{footer}</div>}
  </div>
);

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogScrollableShell,
};

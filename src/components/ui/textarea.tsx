import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-all resize-y",
        "hover:border-[#0F2D52]/30",
        "focus-visible:outline-none focus-visible:border-[#0F2D52] focus-visible:ring-2 focus-visible:ring-[#0F2D52]/15",
        "placeholder:text-muted-foreground/70",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/30",
        "md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

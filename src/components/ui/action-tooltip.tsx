"use client";
// Helper léger : wrap un trigger avec un Tooltip VNK-themed.
// Évite les <button title="..."> natifs qui affichent le tooltip OS gris (cassent le thème).
//
// Usage :
//   <ActionTooltip label="Renvoyer le reçu par courriel">
//     <button onClick={...}><Send className="h-4 w-4" /></button>
//   </ActionTooltip>
//
// Le TooltipProvider est déjà fourni au niveau du layout admin.

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Side = "top" | "right" | "bottom" | "left";

export function ActionTooltip({
  label,
  children,
  side = "top",
  align = "center",
  asChild = true,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: Side;
  align?: "start" | "center" | "end";
  asChild?: boolean;
}) {
  if (!label) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} className="max-w-[260px]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

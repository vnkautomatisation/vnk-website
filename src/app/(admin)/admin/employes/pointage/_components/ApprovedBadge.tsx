"use client";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Shared "approved" badge (cards, rows, panels).
// `strong` = solid fill for card headers; default = light inline badge.
export function ApprovedBadge({ strong = false, className = "" }: { strong?: boolean; className?: string }) {
  if (strong) {
    return (
      <Badge className={`text-[10px] bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 ${className}`}>
        <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Validé
      </Badge>
    );
  }
  return (
    <Badge className={`text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 ${className}`}>
      <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Validé
    </Badge>
  );
}

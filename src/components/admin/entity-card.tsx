"use client";
import { type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/utils";

export type EntityAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
  separator?: boolean;
};

export type EntityStat = {
  label: string;
  value: string | number;
};

export function EntityCard({
  title,
  subtitle,
  avatarName,
  icon,
  badges,
  stats,
  actions,
  footer,
  onClick,
  accent,
  alert,
  className,
}: {
  title: string;
  subtitle?: string;
  avatarName?: string;
  icon?: ReactNode;
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "destructive" | "outline" }>;
  stats?: EntityStat[];
  actions?: EntityAction[];
  footer?: ReactNode;
  onClick?: () => void;
  accent?: string;
  alert?: boolean;
  className?: string;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "vnk-card-hover overflow-hidden",
        alert && "border-amber-300",
        onClick && "cursor-pointer hover:border-[#0F2D52]/30",
        className
      )}
    >
      {accent && <div className={cn("h-1 w-full", accent)} />}
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Avatar or icon */}
          {avatarName && (
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="vnk-gradient text-white text-xs font-bold">
                {initials(avatarName)}
              </AvatarFallback>
            </Avatar>
          )}
          {!avatarName && icon && (
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}

          {/* Title + subtitle */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* Actions menu */}
          {actions && actions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors shrink-0">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {actions.map((action, i) => (
                  <div key={i}>
                    {action.separator && i > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={action.onClick}
                      className={action.variant === "destructive" ? "text-destructive" : ""}
                    >
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Badges */}
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {badges.map((b, i) => (
              <Badge key={i} variant={b.variant ?? "secondary"} className="text-[10px]">
                {b.label}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {stats.map((s, i) => (
              <div key={i} className="text-center p-1.5 rounded-md bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
                <p className="text-sm font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {footer && <div className="mt-3 pt-3 border-t">{footer}</div>}
      </CardContent>
    </Card>
  );
}

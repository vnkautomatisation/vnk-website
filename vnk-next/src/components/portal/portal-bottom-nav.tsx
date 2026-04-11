"use client";
import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Briefcase, Plus, Calendar, Menu } from "lucide-react";

export function PortalBottomNav({
  onMoreClick,
}: {
  onMoreClick?: () => void;
}) {
  const t = useTranslations("portal.sidebar");
  const pathname = usePathname();

  const items = [
    { key: "dashboard", icon: LayoutDashboard, href: "/portail" },
    { key: "mandates", icon: Briefcase, href: "/portail/mandats" },
    { key: "new", icon: Plus, href: "/portail/demandes/nouvelle", primary: true },
    { key: "appointments", icon: Calendar, href: "/portail/rendez-vous" },
    { key: "more", icon: Menu, href: "#", onClick: onMoreClick },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t h-[64px] pb-safe flex items-stretch justify-around"
      aria-label="Navigation mobile"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        const content = (
          <div
            className={cn(
              "flex flex-col items-center justify-center flex-1 gap-0.5 text-xs",
              item.primary && "relative",
              active && !item.primary && "text-primary font-medium",
              !active && !item.primary && "text-muted-foreground"
            )}
          >
            {item.primary ? (
              <div className="h-11 w-11 rounded-full vnk-gradient text-white flex items-center justify-center shadow-lg -mt-6">
                <Icon className="h-5 w-5" />
              </div>
            ) : (
              <>
                <Icon className="h-5 w-5" />
                <span>{t(item.key as "dashboard")}</span>
              </>
            )}
          </div>
        );
        if (item.onClick) {
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className="flex-1"
              aria-label={t(item.key as "dashboard")}
            >
              {content}
            </button>
          );
        }
        return (
          <Link
            key={item.key}
            href={item.href as "/portail"}
            className="flex-1"
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

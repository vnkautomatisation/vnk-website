"use client";
// Menu déroulant "Ajouter au calendrier" : Google, Outlook 365, Outlook.com, .ics
// Génère des URLs directes pour ajouter un événement au calendrier de l'utilisateur
// sans qu'il ait à télécharger un fichier manuellement.
//
// Convention VNK : tous les boutons "ajouter au calendrier" passent par ce menu
// (jamais de download .ics direct).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { CalendarPlus, Download, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";

export type CalendarEventInput = {
  /** ID de la demande de congé (pour télécharger l'ICS via API) */
  leaveId: number;
  /** Titre/sujet affiché dans le calendrier */
  title: string;
  /** Date début ISO YYYY-MM-DD (jour complet) */
  startDate: string;
  /** Date fin ISO YYYY-MM-DD (jour complet, INCLUSIVE) */
  endDate: string;
  /** Description optionnelle (raison du congé, etc.) */
  description?: string;
};

// ─── Helpers de formatage URL ─────────────────────────────────────
function toYYYYMMDD(dateStr: string): string {
  return dateStr.replace(/-/g, "").slice(0, 8);
}
function toISO(dateStr: string): string {

  return `${dateStr.slice(0, 10)}T00:00:00`;
}
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildGoogleUrl(ev: CalendarEventInput): string {

  const start = toYYYYMMDD(ev.startDate);
  const end = toYYYYMMDD(addOneDay(ev.endDate));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${start}/${end}`,
    ...(ev.description ? { details: ev.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookComUrl(ev: CalendarEventInput): string {

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: toISO(ev.startDate),
    enddt: toISO(addOneDay(ev.endDate)),
    allday: "true",
    ...(ev.description ? { body: ev.description } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function buildOffice365Url(ev: CalendarEventInput): string {

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: toISO(ev.startDate),
    enddt: toISO(addOneDay(ev.endDate)),
    allday: "true",
    ...(ev.description ? { body: ev.description } : {}),
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function buildYahooUrl(ev: CalendarEventInput): string {

  const start = toYYYYMMDD(ev.startDate);
  const end = toYYYYMMDD(addOneDay(ev.endDate));
  const params = new URLSearchParams({
    v: "60",
    title: ev.title,
    st: `${start}T000000Z`,
    et: `${end}T000000Z`,
    dur: "allday",
    ...(ev.description ? { desc: ev.description } : {}),
  });
  return `https://calendar.yahoo.com/?${params.toString()}`;
}

// ─── Composant principal ──────────────────────────────────────────
export function AddToCalendarMenu({
  event,
  variant = "default",
  size = "sm",
  align = "end",
  triggerLabel,
  iconOnly = false,
}: {
  event: CalendarEventInput;

  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
  align?: "start" | "end" | "center";

  triggerLabel?: string;

  iconOnly?: boolean;
}) {
  const t = useTranslations("admin.ui");
  const [opened, setOpened] = useState<string | null>(null);

  const handleOpen = (kind: "google" | "outlook" | "office365" | "yahoo", url: string) => {
    setOpened(kind);
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(
      kind === "google" ? t("ouverture_google_calendar") :
      kind === "office365" ? t("ouverture_outlook_microsoft_365") :
      kind === "outlook" ? "Ouverture d'Outlook.com..." :
      t("ouverture_calendrier")
    );
    setTimeout(() => setOpened(null), 2000);
  };

  const handleIcsDownload = () => {


    const a = document.createElement("a");
    a.href = `/api/admin/leaves/${event.leaveId}/ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(t("fichier_ics_telecharge_importez_apple"));
  };

  return (
    <DropdownMenu>
      <ActionTooltip label={t("ajouter_conge_calendrier_google_outlook")}>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className="h-7 text-xs">
            <CalendarPlus className="h-3.5 w-3.5" />
            {!iconOnly && <span className="ml-1.5">{triggerLabel ?? t("calendrier")}</span>}
          </Button>
        </DropdownMenuTrigger>
      </ActionTooltip>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("ajouter_calendrier")}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => handleOpen("google", buildGoogleUrl(event))}>
          <GoogleIcon className="h-3.5 w-3.5 mr-2" />
          <span className="flex-1">{t("google_calendar")}</span>
          {opened === "google" ? <Check className="h-3 w-3 text-emerald-600" /> : <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleOpen("office365", buildOffice365Url(event))}>
          <MicrosoftIcon className="h-3.5 w-3.5 mr-2" />
          <span className="flex-1">{t("outlook_teams_m365")}</span>
          {opened === "office365" ? <Check className="h-3 w-3 text-emerald-600" /> : <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleOpen("outlook", buildOutlookComUrl(event))}>
          <MicrosoftIcon className="h-3.5 w-3.5 mr-2" />
          <span className="flex-1">Outlook.com (perso)</span>
          {opened === "outlook" ? <Check className="h-3 w-3 text-emerald-600" /> : <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleOpen("yahoo", buildYahooUrl(event))}>
          <YahooIcon className="h-3.5 w-3.5 mr-2" />
          <span className="flex-1">{t("yahoo_calendar")}</span>
          {opened === "yahoo" ? <Check className="h-3 w-3 text-emerald-600" /> : <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleIcsDownload}>
          <Download className="h-3.5 w-3.5 mr-2" />
          <span className="flex-1">{t("fichier_ics_apple_autre")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Petits logos SVG inline (couleur de marque, pas d'emoji) ─────
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z" />
    </svg>
  );
}
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden>
      <rect width="10" height="10" x="1" y="1" fill="#F25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
      <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
      <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
    </svg>
  );
}
function YahooIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#6001D2" d="M2 4h6.2l4 6.4L16.4 4H22l-8.6 13.4V20h-3.2v-2.6L2 4z" />
    </svg>
  );
}

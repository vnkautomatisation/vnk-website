"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Monitor, Smartphone, Tablet, MapPin, Clock, LogOut, AlertCircle, Globe, Trash2,
  MoreHorizontal, ShieldCheck, ShieldAlert, Pencil, History, Wifi, Activity, Server, ChevronRight,
} from "lucide-react";
import {
  revokeSessionAction, revokeAllOtherSessionsAction, renameSessionAction,
  trustSessionDeviceAction, reportSuspiciousSessionAction,
} from "@/app/actions/profile";
import { parseUserAgent } from "@/lib/security/ua-parser";
import type { SessionRow } from "../profile-view";

function formatLocation(s: SessionRow): string {
  if (s.ipAddress && /^(::1|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.)/.test(s.ipAddress)) {
    return "Réseau local (développement)";
  }
  const parts = [s.city, s.country].filter(Boolean);
  if (parts.length === 0) return "Localisation non disponible";
  return parts.join(", ");
}

function formatIp(ip: string | null): string {
  if (!ip) return "IP masquée";
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  if (ip === "::1") return "::1 (localhost)";
  if (ip === "127.0.0.1") return "127.0.0.1 (localhost)";
  return ip;
}

export function TabSessions({ sessions }: { sessions: SessionRow[] }) {
  const t = useTranslations("admin.profile.sessions");
  const tCommon = useTranslations("admin.profile.common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState<SessionRow | null>(null);
  const [detailsSession, setDetailsSession] = useState<SessionRow | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState("");

  const handleRevoke = (id: string) => {
    startTransition(async () => {
      const r = await revokeSessionAction(id);
      if (r.success) {
        toast.success("Session révoquée");
        router.refresh();
      } else toast.error(r.error);
    });
  };

  const handleRevokeAllOthers = () => {
    startTransition(async () => {
      const r = await revokeAllOtherSessionsAction();
      if (r.success) {
        toast.success("Tous les autres appareils ont été déconnectés", {
          description: "Les sessions actuelles sur d'autres appareils ont été invalidées. Ils seront déconnectés automatiquement.",
          duration: 6000,
        });
        router.refresh();
      } else toast.error(r.error);
      setConfirmAllOpen(false);
    });
  };

  const handleRename = (id: string) => {
    startTransition(async () => {
      const r = await renameSessionAction(id, labelValue);
      if (r.success) {
        toast.success("Renommé");
        router.refresh();
      } else toast.error(r.error);
      setRenamingId(null);
      setLabelValue("");
    });
  };

  const handleTrust = (s: SessionRow) => {
    startTransition(async () => {
      const r = await trustSessionDeviceAction(s.id);
      if (r.success) {
        toast.success("Appareil ajouté à votre liste d'appareils de confiance", {
          description: "Vous ne serez plus invité à entrer un code 2FA depuis cet appareil. Vous pouvez retirer la confiance à tout moment depuis l'onglet Sécurité.",
          duration: 5000,
        });
        router.refresh();
      } else toast.error(r.error);
    });
  };

  const handleReport = () => {
    if (!reportOpen) return;
    startTransition(async () => {
      const r = await reportSuspiciousSessionAction(reportOpen.id);
      if (r.success) {
        toast.success("Session signalée et révoquée. Un évènement critique a été enregistré.");
        router.refresh();
      } else toast.error(r.error);
      setReportOpen(null);
    });
  };

  const now = new Date();
  const activeSessions = sessions.filter((s) => new Date(s.expiresAt) > now);
  const inactiveSessions = sessions.filter((s) => new Date(s.expiresAt) <= now);
  const otherSessionsCount = activeSessions.filter((s) => !s.isCurrent).length;

  const orderedSessions = [
    ...activeSessions.filter((s) => s.isCurrent),
    ...activeSessions.filter((s) => !s.isCurrent),
    ...inactiveSessions,
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              {t("title")}
              <Badge variant="secondary">{t("active_count", { count: activeSessions.length })}</Badge>
              {inactiveSessions.length > 0 && (
                <Badge variant="outline" className="text-muted-foreground">{t("offline_count", { count: inactiveSessions.length })}</Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setConfirmAllOpen(true)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <LogOut className="h-3.5 w-3.5" />
            {otherSessionsCount > 0
              ? t("disconnect_others_n", { count: otherSessionsCount })
              : t("disconnect_others")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {orderedSessions.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Monitor className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>{t("empty_title")}</p>
            <p className="text-[11px] mt-1">{t("empty_hint")}</p>
          </div>
        ) : (
          <ul className="divide-y -mx-3">
            {orderedSessions.map((s) => {
              const isExpired = new Date(s.expiresAt) <= now;
              const parsed = s.browser
                ? { browser: s.browser, os: s.os ?? "Inconnu", deviceType: (s.deviceType as "desktop" | "mobile" | "tablet") ?? "desktop", label: `${s.browser} sur ${s.os ?? "Inconnu"}` }
                : parseUserAgent(s.userAgent);
              const Icon = parsed.deviceType === "mobile" ? Smartphone : parsed.deviceType === "tablet" ? Tablet : Monitor;
              const lastActive = s.lastActiveAt ? new Date(s.lastActiveAt) : new Date(s.createdAt);
              const minutesAgo = Math.floor((Date.now() - lastActive.getTime()) / 60000);
              // Pour les sessions actives : "actif maintenant" / "il y a X min/h/j"
              // Pour les sessions hors ligne : date complète de la dernière utilisation
              const lastActiveLabel = isExpired
                ? `dernier accès ${lastActive.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })}`
                : minutesAgo < 2 ? "actif maintenant"
                : minutesAgo < 60 ? `il y a ${minutesAgo} min`
                : minutesAgo < 1440 ? `il y a ${Math.floor(minutesAgo / 60)} h`
                : `il y a ${Math.floor(minutesAgo / 1440)} j`;
              const location = formatLocation(s);
              const ipDisplay = formatIp(s.ipAddress);
              const isRenaming = renamingId === s.id;

              return (
                <li key={s.id}>
                  <div
                    role={isRenaming ? undefined : "button"}
                    tabIndex={isRenaming ? -1 : 0}
                    onClick={() => { if (!isRenaming) setDetailsSession(s); }}
                    onKeyDown={(e) => { if (!isRenaming && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setDetailsSession(s); } }}
                    className={`group flex items-center gap-3 px-3 py-3 rounded-lg transition cursor-pointer hover:bg-muted/50 ${isExpired ? "opacity-60" : ""}`}
                  >
                    {/* Icône appareil */}
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.isCurrent ? "bg-emerald-100 text-emerald-700" : isExpired ? "bg-zinc-100 text-zinc-400" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Contenu principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {isRenaming ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={labelValue}
                              onChange={(e) => setLabelValue(e.target.value)}
                              placeholder={parsed.label}
                              className="h-7 w-48 text-sm"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") handleRename(s.id); if (e.key === "Escape") { setRenamingId(null); setLabelValue(""); } }}
                            />
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => handleRename(s.id)} disabled={pending}>OK</Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setRenamingId(null); setLabelValue(""); }}>Annuler</Button>
                          </div>
                        ) : (
                          <p className="text-sm font-medium truncate">{s.label || parsed.label}</p>
                        )}
                        {s.isCurrent && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">{t("current_session")}</Badge>}
                        {isExpired && !s.isCurrent && <Badge variant="outline" className="text-[10px] text-muted-foreground">{t("offline")}</Badge>}
                        {s.isTrusted && s.trustedUntil && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] gap-0.5">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            {t("trusted_until", { date: new Date(s.trustedUntil).toLocaleDateString(undefined, { day: "numeric", month: "short" }) })}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {ipDisplay}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {location}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {lastActiveLabel}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        Première connexion {new Date(s.createdAt).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })}
                        {isExpired && s.lastActiveAt && ` · Dernière activité ${new Date(s.lastActiveAt).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })}`}
                      </p>
                    </div>

                    {/* ─── Actions visibles à droite (stopPropagation) ─── */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Action principale selon l'état */}
                      {!isExpired && !s.isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevoke(s.id)}
                          disabled={pending}
                          className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline ml-1">{t("actions.disconnect")}</span>
                        </Button>
                      )}
                      {isExpired && !s.isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevoke(s.id)}
                          disabled={pending}
                          className="h-8 text-muted-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline ml-1">{t("actions.delete")}</span>
                        </Button>
                      )}
                      {s.isCurrent && !isExpired && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setRenamingId(s.id); setLabelValue(s.label ?? ""); }}
                          className="h-8"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline ml-1">{t("actions.rename")}</span>
                        </Button>
                      )}

                      {/* Menu secondaire compact (actions moins fréquentes) */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Autres actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {!s.isCurrent && !isExpired && (
                            <DropdownMenuItem onClick={() => { setRenamingId(s.id); setLabelValue(s.label ?? ""); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              <span>{t("actions.rename")}</span>
                            </DropdownMenuItem>
                          )}
                          {!isExpired && !s.isTrusted && (
                            <DropdownMenuItem onClick={() => handleTrust(s)} disabled={pending}>
                              <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                              <span>{t("actions.trust")}</span>
                            </DropdownMenuItem>
                          )}
                          {s.isTrusted && s.trustedUntil && (
                            <DropdownMenuItem disabled className="opacity-100 cursor-default">
                              <ShieldCheck className="h-3.5 w-3.5 mr-2 text-blue-600" />
                              <span className="text-blue-700">
                                {t("actions.trusted_until", { date: new Date(s.trustedUntil).toLocaleDateString(undefined, { day: "numeric", month: "short" }) })}
                              </span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <a href={`/admin/profile?tab=activite&filter=session:${s.id}`}>
                              <History className="h-3.5 w-3.5 mr-2" />
                              <span>{t("actions.view_activity")}</span>
                            </a>
                          </DropdownMenuItem>
                          {!s.isCurrent && !isExpired && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setReportOpen(s)} className="text-destructive focus:text-destructive">
                                <ShieldAlert className="h-3.5 w-3.5 mr-2" />
                                <span>{t("actions.report")}</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Indicateur visuel que la ligne est cliquable */}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition hidden sm:block" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* ─── Dialog : confirmer révocation de toutes les autres ─── */}
      <Dialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white flex items-center gap-2"><AlertCircle className="h-5 w-5" /> {t("revoke_all_title")}</DialogTitle>
            <DialogDescription className="text-white/80 text-sm mt-1">
              {t("revoke_all_description", { count: otherSessionsCount })}
            </DialogDescription>
          </div>
          <div className="p-5 text-sm text-muted-foreground">
            <p>{t("revoke_all_body")}</p>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setConfirmAllOpen(false)}>{tCommon("cancel")}</Button>
            <Button variant="destructive" onClick={handleRevokeAllOthers} disabled={pending}>
              {pending ? "…" : t("revoke_all_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog : signaler comme suspect ─── */}
      <Dialog open={!!reportOpen} onOpenChange={(o) => !o && setReportOpen(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-red-600 text-white p-5">
            <DialogTitle className="text-white flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> {t("report_title")}</DialogTitle>
            <DialogDescription className="text-white/85 text-sm mt-1">
              {t("report_description")}
            </DialogDescription>
          </div>
          <div className="p-5 text-sm space-y-2">
            <p className="text-muted-foreground">{t("report_use_if")}</p>
            <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1">
              <li>{t("report_reason_1")}</li>
              <li>{t("report_reason_2")}</li>
              <li>{t("report_reason_3")}</li>
            </ul>
            <p className="text-xs mt-3 bg-amber-50 border border-amber-200 rounded-md p-2.5">
              <strong>{t("report_recommendation")}</strong> {t("report_recommendation_text")}
            </p>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setReportOpen(null)}>{tCommon("cancel")}</Button>
            <Button variant="destructive" onClick={handleReport} disabled={pending}>
              {pending ? "…" : t("report_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog : détails complets ─── */}
      <Dialog open={!!detailsSession} onOpenChange={(o) => !o && setDetailsSession(null)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white">{t("details_title")}</DialogTitle>
            <DialogDescription className="text-white/80 text-sm mt-1">
              {detailsSession?.label || (detailsSession ? parseUserAgent(detailsSession.userAgent).label : "")}
            </DialogDescription>
          </div>
          {detailsSession && (
            <div className="p-5 space-y-3 text-sm">
              <DetailRow icon={Server} label={t("details_id")} value={<code className="text-xs font-mono">{detailsSession.id}</code>} />
              <DetailRow icon={Monitor} label={t("details_browser")} value={detailsSession.browser ?? "—"} />
              <DetailRow icon={Server} label={t("details_os")} value={detailsSession.os ?? "—"} />
              <DetailRow icon={Smartphone} label={t("details_device_type")} value={(detailsSession.deviceType ?? "desktop").charAt(0).toUpperCase() + (detailsSession.deviceType ?? "desktop").slice(1)} />
              <DetailRow icon={Wifi} label={t("details_ip")} value={<code className="font-mono">{formatIp(detailsSession.ipAddress)}</code>} />
              <DetailRow icon={MapPin} label={t("details_location")} value={formatLocation(detailsSession)} />
              <DetailRow
                icon={Activity}
                label={t("details_last_active")}
                value={
                  detailsSession.lastActiveAt
                    ? (
                      <span>
                        {new Date(detailsSession.lastActiveAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
                        {(() => {
                          const minutesAgo = Math.floor((Date.now() - new Date(detailsSession.lastActiveAt).getTime()) / 60000);
                          const ago = minutesAgo < 2 ? t("ago_now")
                            : minutesAgo < 60 ? t("ago_minutes", { count: minutesAgo })
                            : minutesAgo < 1440 ? t("ago_hours", { count: Math.floor(minutesAgo / 60) })
                            : minutesAgo < 43200 ? t("ago_days", { count: Math.floor(minutesAgo / 1440) })
                            : t("ago_months", { count: Math.floor(minutesAgo / 43200) });
                          return <span className="text-[10px] text-muted-foreground block mt-0.5">{ago}</span>;
                        })()}
                      </span>
                    )
                    : t("never")
                }
              />
              <DetailRow icon={Clock} label={t("details_first_connection")} value={new Date(detailsSession.createdAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })} />
              <DetailRow
                icon={Clock}
                label={new Date(detailsSession.expiresAt) > new Date() ? t("details_active_until") : t("details_expired_on")}
                value={
                  <span>
                    {new Date(detailsSession.expiresAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
                    {new Date(detailsSession.expiresAt) > new Date() && (
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {t("details_auto_renew")}
                      </span>
                    )}
                  </span>
                }
              />
              {detailsSession.userAgent && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-1.5">{t("details_user_agent")}</p>
                  <p className="text-[10px] font-mono bg-muted rounded-md p-2 break-all">{detailsSession.userAgent}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setDetailsSession(null)}>{t("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b last:border-b-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

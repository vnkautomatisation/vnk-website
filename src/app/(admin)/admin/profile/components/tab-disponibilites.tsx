"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, Globe, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { key: "lun", i18nKey: "day_mon" },
  { key: "mar", i18nKey: "day_tue" },
  { key: "mer", i18nKey: "day_wed" },
  { key: "jeu", i18nKey: "day_thu" },
  { key: "ven", i18nKey: "day_fri" },
  { key: "sam", i18nKey: "day_sat" },
  { key: "dim", i18nKey: "day_sun" },
] as const;

const DURATIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];

type DaySchedule = { enabled: boolean; start: string; end: string };

export function TabDisponibilites() {
  const tc = useTranslations("common");
  const t = useTranslations("admin.profile.availability");
  const [days, setDays] = useState<Record<string, DaySchedule>>({
    lun: { enabled: true, start: "09:00", end: "17:00" },
    mar: { enabled: true, start: "09:00", end: "17:00" },
    mer: { enabled: true, start: "09:00", end: "17:00" },
    jeu: { enabled: true, start: "09:00", end: "17:00" },
    ven: { enabled: true, start: "09:00", end: "17:00" },
    sam: { enabled: false, start: "09:00", end: "12:00" },
    dim: { enabled: false, start: "09:00", end: "12:00" },
  });
  const [duration, setDuration] = useState("30");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [buffer, setBuffer] = useState("10");
  const [notice, setNotice] = useState("120");
  const [horizon, setHorizon] = useState("30");
  const [autoApprove, setAutoApprove] = useState(true);
  const [meetingLink, setMeetingLink] = useState("");

  const updateDay = (key: string, field: keyof DaySchedule, value: string | boolean) => {
    setDays((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const copyToAll = () => {
    const firstEnabled = Object.entries(days).find(([, d]) => d.enabled);
    if (!firstEnabled) return;
    const [, schedule] = firstEnabled;
    setDays((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].enabled) {
          next[key] = { ...next[key], start: schedule.start, end: schedule.end };
        }
      }
      return next;
    });
    toast.success(t("copied_toast"));
  };

  const handleSave = () => {
    // TODO: sauvegarder dans settings BD
    toast.success(t("saved_toast"));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Heures de travail */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("work_hours_title")}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={copyToAll} className="gap-1.5">
                <Copy className="h-3 w-3" />
                {t("copy_to_all")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("copy_hint")}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {DAYS.map((day) => {
              const s = days[day.key];
              return (
                <div
                  key={day.key}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    s.enabled ? "bg-card" : "bg-muted/50 opacity-60"
                  )}
                >
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={(v) => updateDay(day.key, "enabled", v)}
                  />
                  <span className="text-sm font-medium w-20">{t(day.i18nKey as "day_mon")}</span>
                  {s.enabled ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={s.start}
                        onChange={(e) => updateDay(day.key, "start", e.target.value)}
                        className="w-28 h-8 text-sm"
                      />
                      <span className="text-muted-foreground text-xs">{t("from_to_separator")}</span>
                      <Input
                        type="time"
                        value={s.end}
                        onChange={(e) => updateDay(day.key, "end", e.target.value)}
                        className="w-28 h-8 text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("disabled")}</span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button onClick={handleSave}>{t("save_button")}</Button>
      </div>

      {/* Options sidebar */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                <Globe className="h-3 w-3 inline mr-1" />
                {t("timezone_label")}
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Toronto">Eastern (Quebec)</SelectItem>
                  <SelectItem value="America/Vancouver">Pacific</SelectItem>
                  <SelectItem value="America/Winnipeg">Central</SelectItem>
                  <SelectItem value="America/Halifax">Atlantic</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t("duration_label")}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={cn(
                    "py-2 px-3 rounded-lg text-sm font-medium border transition-colors",
                    duration === d.value
                      ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Pause entre reunions</Label>
              <Select value={buffer} onValueChange={setBuffer}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Aucune</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Preavis minimum</Label>
              <Select value={notice} onValueChange={setNotice}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{tc("none")}</SelectItem>
                  <SelectItem value="60">1 heure</SelectItem>
                  <SelectItem value="120">2 heures</SelectItem>
                  <SelectItem value="1440">24 heures</SelectItem>
                  <SelectItem value="2880">48 heures</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Horizon de reservation</Label>
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="14">14 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="60">60 jours</SelectItem>
                  <SelectItem value="90">90 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Approbation auto</p>
                <p className="text-[10px] text-muted-foreground">Confirme toutes les demandes automatiquement</p>
              </div>
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Lien reunion par defaut</Label>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://teams.microsoft.com/..."
              className="mt-1.5 h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Teams, Zoom, Google Meet... Ajoute auto a chaque RDV</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

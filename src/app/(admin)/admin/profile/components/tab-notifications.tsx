"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, MessageSquare, Smartphone, Moon, AlertCircle } from "lucide-react";
import { updateNotificationPrefsAction } from "@/app/actions/profile";
import { EditableSection, ReadField } from "./editable-section";
import type { AdminProfile } from "../profile-view";

type Channel = "email" | "push" | "slack";
type CategoryDef = {
  key: string;
  critical?: boolean;
};

const CATEGORIES: CategoryDef[] = [
  { key: "new_request" },
  { key: "new_message" },
  { key: "invoice_paid" },
  { key: "invoice_overdue" },
  { key: "quote_accepted" },
  { key: "appointment_booked" },
  { key: "appointment_reminder" },
  { key: "weekly_digest" },
  { key: "security_alert", critical: true },
  { key: "system_update" },
];

function useAutoSave(callback: () => Promise<void>, deps: unknown[], delay = 800) {
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { callback(); }, delay);
    return () => clearTimeout(t);

  }, deps);
}

export function TabNotifications({ admin }: { admin: AdminProfile }) {
  const t = useTranslations("admin.profile.notifications");
  const tCommon = useTranslations("admin.profile.common");
  const prefs = (admin.notificationPrefs as Record<string, Record<string, boolean> | string> | null) ?? {};
  const init = (ch: Channel) => (prefs[ch] as Record<string, boolean>) ?? {};

  const [email, setEmail] = useState<Record<string, boolean>>({
    ...Object.fromEntries(CATEGORIES.map((c) => [c.key, c.critical ?? true])),
    ...init("email"),
  });
  const [push, setPush] = useState<Record<string, boolean>>({
    ...Object.fromEntries(CATEGORIES.map((c) => [c.key, c.critical ?? false])),
    ...init("push"),
  });
  const [slack, setSlack] = useState<Record<string, boolean>>({
    ...Object.fromEntries(CATEGORIES.map((c) => [c.key, c.critical ?? false])),
    ...init("slack"),
  });
  const [digest, setDigest] = useState<"instant" | "hourly" | "daily" | "weekly" | "off">(
    (prefs.digest as "instant" | "hourly" | "daily" | "weekly" | "off") ?? "instant"
  );
  const [quietStart, setQuietStart] = useState<string>((prefs.quietHoursStart as string) ?? "22:00");
  const [quietEnd, setQuietEnd] = useState<string>((prefs.quietHoursEnd as string) ?? "07:00");
  const [loginAlerts, setLoginAlerts] = useState(admin.loginAlertsEnabled);

  const [savingFreq, startFreq] = useTransition();
  const [, startMatrix] = useTransition();

  const saveFrequency = () => {
    return new Promise<void>((resolve) => {
      startFreq(async () => {
        const r = await updateNotificationPrefsAction({
          digest,
          quietHoursStart: quietStart,
          quietHoursEnd: quietEnd,
          loginAlertsEnabled: loginAlerts,
        });
        if (r.success) toast.success(t("frequence_enregistree"));
        else toast.error(r.error);
        resolve();
      });
    });
  };


  useAutoSave(() => {
    return new Promise<void>((resolve) => {
      startMatrix(async () => {
        await updateNotificationPrefsAction({ email, push, slack });
        resolve();
      });
    });
  }, [email, push, slack], 600);

  const toggle = (ch: Channel, key: string, value: boolean) => {
    if (ch === "email") setEmail({ ...email, [key]: value });
    else if (ch === "push") setPush({ ...push, [key]: value });
    else if (ch === "slack") setSlack({ ...slack, [key]: value });
  };

  const toggleAll = (ch: Channel, val: boolean) => {
    const newState = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.critical ? true : val]));
    if (ch === "email") setEmail(newState);
    else if (ch === "push") setPush(newState);
    else if (ch === "slack") setSlack(newState);
  };

  return (
    <div className="space-y-4">

      <EditableSection
        title={t("frequency_title")}
        icon={Bell}
        saving={savingFreq}
        onSave={saveFrequency}
        editLabel={tCommon("edit")}
        saveLabel={tCommon("save")}
        cancelLabel={tCommon("cancel")}
        readView={
          <div>
            <ReadField label={t("cadence_label")} value={t(`digest_${digest}` as "digest_instant")} />
            <ReadField label={t("quiet_hours")} value={`${quietStart} – ${quietEnd}`} />
            <ReadField label={t("login_alerts_title")} value={loginAlerts ? tCommon("enabled") : tCommon("disabled")} />
          </div>
        }
        editView={
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("cadence_label")}</Label>
              <Select value={digest} onValueChange={(v) => setDigest(v as "instant" | "hourly" | "daily" | "weekly" | "off")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">{t("digest_instant")}</SelectItem>
                  <SelectItem value="hourly">{t("digest_hourly")}</SelectItem>
                  <SelectItem value="daily">{t("digest_daily")}</SelectItem>
                  <SelectItem value="weekly">{t("digest_weekly")}</SelectItem>
                  <SelectItem value="off">{t("digest_off")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Moon className="h-3 w-3" /> {t("quiet_start")}</Label>
              <Input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("quiet_end")}</Label>
              <Input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="h-9" />
            </div>
            <div className="sm:col-span-3 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 text-amber-900"><AlertCircle className="h-3.5 w-3.5" /> {t("login_alerts_title")}</p>
                <p className="text-xs text-amber-800 mt-0.5">{t("login_alerts_desc")}</p>
              </div>
              <Switch checked={loginAlerts} onCheckedChange={setLoginAlerts} />
            </div>
          </div>
        }
      />


      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {t("channels_title")}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{t("channels_subtitle")}</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{t("auto_save")}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-4 sm:px-2 font-medium">{tCommon("not_set") === "Not set" ? t("category") : t("categorie")}</th>
                  <th className="text-center py-2 px-2 font-medium">
                    <div className="flex flex-col items-center gap-0.5">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{t("channel_email")}</span>
                      <button onClick={() => toggleAll("email", !Object.values(email).every(Boolean))} className="text-[10px] underline text-muted-foreground hover:text-foreground">{t("toggle_all")}</button>
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 font-medium">
                    <div className="flex flex-col items-center gap-0.5">
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>{t("channel_push")}</span>
                      <button onClick={() => toggleAll("push", !Object.values(push).every(Boolean))} className="text-[10px] underline text-muted-foreground hover:text-foreground">{t("toggle_all")}</button>
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 font-medium">
                    <div className="flex flex-col items-center gap-0.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>{t("channel_slack")}</span>
                      <button onClick={() => toggleAll("slack", !Object.values(slack).every(Boolean))} className="text-[10px] underline text-muted-foreground hover:text-foreground">{t("toggle_all")}</button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => (
                  <tr key={c.key} className="border-b hover:bg-muted/30">
                    <td className="py-3 px-4 sm:px-2">
                      <div>
                        <p className="font-medium text-sm">{t(`categories.${c.key}_label` as "categories.new_request_label")}</p>
                        <p className="text-[11px] text-muted-foreground">{t(`categories.${c.key}_desc` as "categories.new_request_desc")}</p>
                        {c.critical && <Badge variant="destructive" className="text-[9px] mt-0.5">{t("critical_badge")}</Badge>}
                      </div>
                    </td>
                    <td className="text-center py-3 px-2"><Switch checked={email[c.key] ?? false} onCheckedChange={(v) => toggle("email", c.key, v)} disabled={c.critical} /></td>
                    <td className="text-center py-3 px-2"><Switch checked={push[c.key] ?? false} onCheckedChange={(v) => toggle("push", c.key, v)} disabled={c.critical} /></td>
                    <td className="text-center py-3 px-2"><Switch checked={slack[c.key] ?? false} onCheckedChange={(v) => toggle("slack", c.key, v)} disabled={c.critical} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 px-4 sm:px-0">{t("critical_hint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

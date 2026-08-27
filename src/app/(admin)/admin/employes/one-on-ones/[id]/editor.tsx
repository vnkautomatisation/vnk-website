"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MessageSquare, CheckCircle2, Clock, ArrowLeft, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { upsertOneOnOneAction } from "@/app/actions/hr-performance";
import { confirmDialog } from "@/components/admin/prompt-dialog";

type ActionItem = { text: string; owner?: "employee" | "manager"; dueDate?: string; done: boolean };

type Meeting = {
  id: number;
  adminId: number;
  managerId: number;
  scheduledAt: string;
  durationMin: number;
  status: string;
  agenda: string | null;
  notes: string | null;
  privateNotes: string | null;
  actionItems: ActionItem[] | null;
  heldAt: string | null;
  admin: { id: number; fullName: string | null; email: string; avatarUrl: string | null };
  manager: { id: number; fullName: string | null; email: string; avatarUrl: string | null };
};

export function OneOnOneEditor({ meeting, isManager, isEmployee, currentAdminId }: {
  meeting: Meeting;
  isManager: boolean;
  isEmployee: boolean;
  currentAdminId: number;
}) {
  const t = useTranslations("admin.one_on_ones");
  const tc = useTranslations("common");
  const router = useRouter();
  const [agenda, setAgenda] = useState(meeting.agenda ?? "");
  const [notes, setNotes] = useState(meeting.notes ?? "");
  const [privateNotes, setPrivateNotes] = useState(meeting.privateNotes ?? "");
  const [actionItems, setActionItems] = useState<ActionItem[]>(meeting.actionItems ?? []);
  const [status, setStatus] = useState(meeting.status);
  const [pending, setPending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);


  useEffect(() => {
    setAgenda(meeting.agenda ?? "");
    setNotes(meeting.notes ?? "");
    setPrivateNotes(meeting.privateNotes ?? "");
    setActionItems(meeting.actionItems ?? []);
    setStatus(meeting.status);
    setIsDirty(false);
  }, [meeting]);


  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const markDirty = () => setIsDirty(true);

  const save = async (newStatus?: string) => {
    setPending(true);
    const r = await upsertOneOnOneAction({
      id: meeting.id,
      adminId: meeting.adminId,
      managerId: meeting.managerId,
      scheduledAt: meeting.scheduledAt,
      durationMin: meeting.durationMin,
      agenda: agenda || null,
      notes: notes || null,
      privateNotes: isManager ? (privateNotes || null) : undefined,
      actionItems,
      status: (newStatus as "scheduled" | "held" | "cancelled" | "rescheduled") ?? status as "scheduled" | "held" | "cancelled" | "rescheduled",
    });
    setPending(false);
    if (r.success) {
      toast.success(newStatus === "held" ? t("marquee_comme_tenue") : t("enregistre"));
      setIsDirty(false);
      if (newStatus) setStatus(newStatus);
      router.refresh();
    } else toast.error(r.error || t("erreur"));
  };

  const other = meeting.adminId === currentAdminId ? meeting.manager : meeting.admin;
  const scheduledDate = new Date(meeting.scheduledAt);
  const isUpcoming = scheduledDate > new Date();
  const canEdit = isManager || isEmployee;
  const canMarkHeld = isManager && status !== "held" && status !== "cancelled";

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/employes/one-on-ones"><ArrowLeft className="h-4 w-4 mr-1" />{tc("back")}</Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#0F2D52]" />1-on-1 avec {other.fullName || other.email}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 inline-flex items-center gap-2 flex-wrap">
            <Clock className="h-3.5 w-3.5" />
            {scheduledDate.toLocaleString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            <span>·</span>
            <span>{meeting.durationMin} min</span>
            <span>·</span>
            <Badge variant="outline" className="text-[10px]">
              {status === "held" ? t("tenue") : status === "cancelled" ? t("annulee") : status === "rescheduled" ? t("reportee") : isUpcoming ? t("venir") : t("passee")}
            </Badge>
            {isDirty && <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">{t("non_sauvegarde")}</Badge>}
          </p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("ordre_jour")}</Label>
          <textarea
            value={agenda}
            onChange={(e) => { setAgenda(e.target.value); markDirty(); }}
            rows={3}
            disabled={!canEdit}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y disabled:opacity-70"
            placeholder={t("sujets_aborder_objectifs_rencontre")}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("notes_reunion")}</Label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); markDirty(); }}
            rows={6}
            disabled={!canEdit}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y disabled:opacity-70"
            placeholder={t("discussion_points_cles_decisions_prises")}
          />
          <p className="text-[11px] text-muted-foreground">{t("visible_apos_employe_manager")}</p>
        </div>

        {isManager && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("notes_privees_manager_seulement")}</Label>
            <textarea
              value={privateNotes}
              onChange={(e) => { setPrivateNotes(e.target.value); markDirty(); }}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              placeholder={t("reflexions_confidentielles_points_suivre_rh")}
            />
            <p className="text-[11px] text-muted-foreground">{t("visible_uniquement_vous_manager")}</p>
          </div>
        )}


        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("actions_suivre")}</Label>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => { setActionItems((arr) => [...arr, { text: "", owner: "employee", done: false }]); markDirty(); }}
              >
                <Plus className="h-3 w-3 mr-1" />{tc("add")}
              </Button>
            )}
          </div>
          {actionItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-1">{t("aucune_action_definie")}</p>
          ) : (
            <div className="space-y-1.5">
              {actionItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-md border bg-muted/20">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setActionItems((arr) => arr.map((x, i) => i === idx ? { ...x, done: v } : x));
                      markDirty();
                    }}
                    disabled={!canEdit}
                    className="h-4 w-4 mt-0.5 rounded border-input"
                  />
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const v = e.target.value;
                      setActionItems((arr) => arr.map((x, i) => i === idx ? { ...x, text: v } : x));
                      markDirty();
                    }}
                    disabled={!canEdit}
                    placeholder={t("description_action")}
                    className={`h-8 text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}
                  />
                  <select
                    value={item.owner ?? "employee"}
                    onChange={(e) => {
                      const v = e.target.value as "employee" | "manager";
                      setActionItems((arr) => arr.map((x, i) => i === idx ? { ...x, owner: v } : x));
                      markDirty();
                    }}
                    disabled={!canEdit}
                    className="h-8 px-2 text-xs rounded-md border border-input bg-background"
                  >
                    <option value="employee">{t("employe")}</option>
                    <option value="manager">{t("manager")}</option>
                  </select>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:text-destructive"
                      aria-label={t("retirer")}
                      onClick={() => {
                        setActionItems((arr) => arr.filter((_, i) => i !== idx));
                        markDirty();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-3 border-t">
          {canEdit && (
            <Button variant="outline" onClick={() => save()} disabled={pending || !isDirty}>
              {pending ? "..." : t("enregistrer")}
            </Button>
          )}
          {canMarkHeld && (
            <Button onClick={() => save("held")} disabled={pending}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />Marquer comme tenue
            </Button>
          )}
          {isManager && status === "scheduled" && (
            <Button
              variant="outline"
              className="hover:text-destructive"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: t("annuler_reunion"),
                  description: t("employe_sera_notifie_annulation"),
                  confirmLabel: t("annuler_reunion"),
                  variant: "destructive",
                });
                if (!ok) return;
                save("cancelled");
              }}
              disabled={pending}
            >
              {tc("cancel")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

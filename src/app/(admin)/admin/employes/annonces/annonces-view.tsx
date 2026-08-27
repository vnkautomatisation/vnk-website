"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Plus, Send, Edit, Trash2, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { upsertAnnouncementAction, publishAnnouncementAction, deleteAnnouncementAction } from "@/app/actions/hr-communications";
import { MarkdownEditor } from "@/components/admin/markdown-editor";

type Ann = {
  id: number; title: string; body: string; category: string;
  pinned: boolean; publishedAt: string | null; expiresAt: string | null;
  audienceType: string; audienceTeamId: number | null; audienceRoleId: number | null;
  author: { fullName: string | null; email: string } | null;
  _count?: { reads: number };
};

export function AnnouncementsAdminView({ announcements, teams, roles }: {
  announcements: Ann[];
  teams: Array<{ id: number; name: string }>;
  roles: Array<{ id: number; name: string }>;
}) {
  const t = useTranslations("admin.announcements");
  const tc = useTranslations("common");
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; existing: Ann | null }>({ open: false, existing: null });
  const [confirmDel, setConfirmDel] = useState<Ann | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-[#0F2D52]" />{t("annonces_internes")}</h1>
          <p className="text-sm text-muted-foreground">{t("communications_direction_rh")}</p>
        </div>
        <Button onClick={() => setDialog({ open: true, existing: null })}><Plus className="h-4 w-4 mr-1.5" />{t("nouvelle_annonce")}</Button>
      </div>

      {announcements.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("aucune_annonce")}</Card>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <Card key={a.id} className={`p-4 ${a.pinned ? "border-amber-200 bg-amber-50/30" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && <Pin className="h-3 w-3 text-amber-500" />}
                    <h3 className="font-bold text-sm">{a.title}</h3>
                    <Badge variant="outline" className="text-[10px] capitalize">{a.category}</Badge>
                    <Badge variant="outline" className="text-[10px]">{a._count?.reads ?? 0} vue{(a._count?.reads ?? 0) > 1 ? "s" : ""}</Badge>
                    {!a.publishedAt && <Badge className="text-[10px] bg-slate-100 text-slate-700">{t("brouillon")}</Badge>}
                    {a.publishedAt && new Date(a.publishedAt) <= new Date() && <Badge className="text-[10px] bg-emerald-100 text-emerald-700">{t("publie")}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{a.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {a.author?.fullName || a.author?.email} · {t("audience")}: {a.audienceType === "all" ? t("tout_le_monde") : a.audienceType}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {!a.publishedAt && (
                    <Button size="sm" onClick={async () => {
                      const r = await publishAnnouncementAction({ id: a.id });
                      if (r.success) { toast.success(t("publie")); router.refresh(); }
                      else toast.error(r.error || "");
                    }}>
                      <Send className="h-3 w-3 mr-1" />Publier
                    </Button>
                  )}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ open: true, existing: a })} aria-label={tc("edit")}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDel(a)} aria-label={tc("delete")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnnouncementDialog
        open={dialog.open}
        existing={dialog.existing}
        teams={teams}
        roles={roles}
        onClose={() => setDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer ${confirmDel?.title} ?`}
        description={t("annonce_sera_retiree_definitivement_notifications")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          const r = await deleteAnnouncementAction({ id: confirmDel.id });
          if (r.success) { toast.success(t("supprimee")); router.refresh(); }
          else toast.error(r.error || "");
          setConfirmDel(null);
        }}
      />
    </div>
  );
}

function AnnouncementDialog({ open, existing, teams, roles, onClose, onSaved }: {
  open: boolean; existing: Ann | null;
  teams: Array<{ id: number; name: string }>;
  roles: Array<{ id: number; name: string }>;
  onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations("admin.announcements");
  const tc = useTranslations("common");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [category, setCategory] = useState(existing?.category ?? "general");
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [audienceType, setAudienceType] = useState(existing?.audienceType ?? "all");
  const [audienceTeamId, setAudienceTeamId] = useState(existing?.audienceTeamId?.toString() ?? "");
  const [audienceRoleId, setAudienceRoleId] = useState(existing?.audienceRoleId?.toString() ?? "");
  const [publishNow, setPublishNow] = useState(true);
  const [expiresAt, setExpiresAt] = useState(existing?.expiresAt?.split("T")[0] ?? "");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(existing?.title ?? "");
      setBody(existing?.body ?? "");
      setCategory(existing?.category ?? "general");
      setPinned(existing?.pinned ?? false);
      setAudienceType(existing?.audienceType ?? "all");
      setAudienceTeamId(existing?.audienceTeamId?.toString() ?? "");
      setAudienceRoleId(existing?.audienceRoleId?.toString() ?? "");
      setPublishNow(true);
      setExpiresAt(existing?.expiresAt?.split("T")[0] ?? "");
    }
  }, [open, existing]);

  const submit = async () => {
    if (!title.trim() || !body.trim()) { toast.error(t("titre_corps_requis")); return; }
    setPending(true);
    const r = await upsertAnnouncementAction({
      id: existing?.id,
      title: title.trim(),
      body: body.trim(),
      category: category as "general" | "safety" | "hr" | "tech" | "celebration",
      pinned,
      publishedAt: publishNow ? new Date().toISOString() : null,
      expiresAt: expiresAt || null,
      audienceType: audienceType as "all" | "team" | "role",
      audienceTeamId: audienceTeamId ? Number(audienceTeamId) : null,
      audienceRoleId: audienceRoleId ? Number(audienceRoleId) : null,
    });
    setPending(false);
    if (r.success) { toast.success(t("enregistre")); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader><DialogTitle className="text-base text-white flex items-center gap-2"><Megaphone className="h-4 w-4" />{existing ? t("modifier_annonce") : t("nouvelle_annonce")}</DialogTitle></DialogHeader>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("titre")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("categorie")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">{t("general")}</SelectItem>
                  <SelectItem value="safety">{t("securite")}</SelectItem>
                  <SelectItem value="hr">RH</SelectItem>
                  <SelectItem value="tech">{t("technique")}</SelectItem>
                  <SelectItem value="celebration">{t("celebration")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-6">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 rounded border-input" />
              <Pin className="h-3.5 w-3.5 text-amber-500" />{t("annonces_view_epinglee")}</label>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("expire")}</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("corps")}</Label>
            <MarkdownEditor value={body} onChange={setBody} placeholder={t("contenu_annonce_markdown_supporte")} helpText={t("markdown_supporte_aide")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("audience")}</Label>
              <Select value={audienceType} onValueChange={setAudienceType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("tout_monde")}</SelectItem>
                  <SelectItem value="team">{t("equipe")}</SelectItem>
                  <SelectItem value="role">{t("role")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {audienceType === "team" && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">{t("equipe")}</Label>
                <Select value={audienceTeamId} onValueChange={setAudienceTeamId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {audienceType === "role" && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider font-semibold">{t("role")}</Label>
                <Select value={audienceRoleId} onValueChange={setAudienceRoleId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          {!existing && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} className="h-4 w-4 rounded border-input" />
              {t("publier_immediatement_sinon_brouillon")}
            </label>
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : t("enregistrer")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

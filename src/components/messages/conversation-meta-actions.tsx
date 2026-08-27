"use client";
// Dropdown actions sur une conversation : pin, archive, snooze, labels, export
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Pin, PinOff, Archive, ArchiveRestore, BellOff, Tag, Download, MoreVertical, Bell, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// L'etiquette est stockee en francais : seul l'affichage suit la locale.
const SUGGESTED_LABELS = ["Urgent", "À facturer", "Suivi", "Important", "Litige", "Prospect"];
const SUGGESTED_LABELS_EN: Record<string, string> = {
  "Urgent": "Urgent",
  "À facturer": "To invoice",
  "Suivi": "Follow-up",
  "Important": "Important",
  "Litige": "Dispute",
  "Prospect": "Prospect",
};

const SNOOZE_PRESETS: { label: string; hours: number }[] = [
  { label: "1 heure", hours: 1 },
  { label: "Demain matin", hours: -1 },
  { label: "1 semaine", hours: 24 * 7 },
];

function tomorrow9am(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function ConversationMetaActions({
  clientId,
  pinned,
  archived,
  snoozedUntil,
  labels,
  onChange,
  onExportCsv,
  onExportPdf,
}: {
  clientId: number;
  pinned: boolean;
  archived: boolean;
  snoozedUntil: string | null;
  labels: string[];
  onChange: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
}) {
  const t = useTranslations("admin.messages");
  const isEn = useLocale().startsWith("en");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [localLabels, setLocalLabels] = useState<string[]>(labels);

  const patch = async (body: object, msg: string) => {
    const res = await fetch(`/api/clients/${clientId}/chat-meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { toast.success(msg); onChange(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || t("erreur")); }
  };

  const togglePin = () => patch({ chatPinned: !pinned }, pinned ? t("desepinglee") : t("conversation_epinglee"));
  const toggleArchive = () => patch({ chatArchive: !archived }, archived ? t("desarchivee") : t("conversation_archivee"));
  const snooze = (preset: typeof SNOOZE_PRESETS[number]) => {
    const d = preset.hours === -1 ? tomorrow9am() : new Date(Date.now() + preset.hours * 3600 * 1000);
    patch({ chatSnoozedUntil: d.toISOString() }, `Snooze jusqu'au ${d.toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`);
  };
  const unsnooze = () => patch({ chatSnoozedUntil: null }, t("snooze_annule"));

  const addLabel = (label: string) => {
    const clean = label.trim();
    if (!clean || localLabels.includes(clean) || localLabels.length >= 10) return;
    setLocalLabels([...localLabels, clean]);
    setLabelInput("");
  };
  const removeLabel = (label: string) => setLocalLabels(localLabels.filter((l) => l !== label));
  const saveLabels = async () => {
    await patch({ chatLabels: localLabels }, t("etiquettes_enregistrees"));
    setLabelsOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label={t("actions_conversation")}
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={togglePin}>
            {pinned ? <PinOff className="h-3.5 w-3.5 mr-2" /> : <Pin className="h-3.5 w-3.5 mr-2" />}
            {pinned ? t("desepingler") : t("epingler_haut")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleArchive}>
            {archived ? <ArchiveRestore className="h-3.5 w-3.5 mr-2" /> : <Archive className="h-3.5 w-3.5 mr-2" />}
            {archived ? t("desarchiver") : t("archiver")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLabelsOpen(true)}>
            <Tag className="h-3.5 w-3.5 mr-2" />Étiquettes ({labels.length})
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("snooze")}</DropdownMenuLabel>
          {SNOOZE_PRESETS.map((p) => (
            <DropdownMenuItem key={p.label} onSelect={() => snooze(p)}>
              <BellOff className="h-3.5 w-3.5 mr-2" />{p.label}
            </DropdownMenuItem>
          ))}
          {snoozedUntil && (
            <DropdownMenuItem onSelect={unsnooze}>
              <Bell className="h-3.5 w-3.5 mr-2" />Annuler snooze
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onExportCsv}>
            <Download className="h-3.5 w-3.5 mr-2" />Exporter CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportPdf}>
            <FileText className="h-3.5 w-3.5 mr-2" />Exporter PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={labelsOpen} onOpenChange={(o) => { setLabelsOpen(o); if (o) setLocalLabels(labels); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-4 text-white">
            <DialogTitle className="text-white text-base">{t("etiquettes")}</DialogTitle>
          </div>
          <div className="p-4 space-y-3">
            {localLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {localLabels.map((l) => (
                  <Badge key={l} variant="secondary" className="cursor-pointer" onClick={() => removeLabel(l)}>
                    {l}
                    <span className="ml-1 text-muted-foreground hover:text-destructive">×</span>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <Input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(labelInput); } }}
                placeholder={t("nouvelle_etiquette")}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => addLabel(labelInput)} disabled={!labelInput.trim()}>{t("ajouter")}</Button>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{t("suggestions")}</p>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_LABELS.filter((s) => !localLabels.includes(s)).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addLabel(s)}
                    className={cn("text-[10px] px-2 py-0.5 rounded-full border hover:bg-muted")}
                  >
                    + {isEn ? SUGGESTED_LABELS_EN[s] ?? s : s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="px-4 py-3 border-t bg-card sm:gap-2">
            <Button variant="outline" onClick={() => setLabelsOpen(false)}>{t("annuler")}</Button>
            <Button onClick={saveLabels} className="bg-[#0F2D52] hover:bg-[#1a3a66]">{t("enregistrer")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

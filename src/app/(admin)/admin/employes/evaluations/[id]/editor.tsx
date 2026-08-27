"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award, Send, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updatePerformanceReviewAction } from "@/app/actions/hr-performance";

type Review = {
  id: number; status: string; rating: number | null;
  strengths: string | null; improvements: string | null;
  objectivesNext: string | null;
  managerComments: string | null; employeeComments: string | null;
  periodStart: string; periodEnd: string;
  submittedAt: string | null; acknowledgedAt: string | null;
  admin: { id: number; fullName: string | null; email: string };
  reviewer: { id: number; fullName: string | null; email: string };
};

export function EvaluationEditor({ review, isReviewer, isEmployee }: { review: Review; isReviewer: boolean; isEmployee: boolean }) {
  const t = useTranslations("admin.hr_nav");
  const router = useRouter();
  const [rating, setRating] = useState(review.rating?.toString() ?? "");
  const [strengths, setStrengths] = useState(review.strengths ?? "");
  const [improvements, setImprovements] = useState(review.improvements ?? "");
  const [objectives, setObjectives] = useState(review.objectivesNext ?? "");
  const [managerComments, setManagerComments] = useState(review.managerComments ?? "");
  const [employeeComments, setEmployeeComments] = useState(review.employeeComments ?? "");
  const [pending, setPending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);


  useEffect(() => {
    setRating(review.rating?.toString() ?? "");
    setStrengths(review.strengths ?? "");
    setImprovements(review.improvements ?? "");
    setObjectives(review.objectivesNext ?? "");
    setManagerComments(review.managerComments ?? "");
    setEmployeeComments(review.employeeComments ?? "");
    setIsDirty(false);
  }, [review]);


  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const locked = review.status === "closed";
  const canEditManager = isReviewer && !locked;
  const canEditEmployee = isEmployee && (review.status === "submitted" || review.status === "reviewed");

  const save = async (statusOverride?: "submitted" | "acknowledged" | "closed") => {
    setPending(true);
    const r = await updatePerformanceReviewAction({
      id: review.id,
      rating: rating ? Number(rating) : null,
      strengths: strengths || null,
      improvements: improvements || null,
      objectivesNext: objectives || null,
      managerComments: managerComments || null,
      employeeComments: employeeComments || null,
      status: statusOverride,
    });
    setPending(false);
    if (r.success) {
      toast.success(statusOverride === "submitted" ? t("soumise_employe") : statusOverride === "acknowledged" ? t("reconnue") : t("enregistre"));
      setIsDirty(false);
      router.refresh();
    } else toast.error(r.error || "");
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-[#0F2D52]" />Évaluation : {review.admin.fullName || review.admin.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(review.periodStart).toLocaleDateString("fr-CA")} → {new Date(review.periodEnd).toLocaleDateString("fr-CA")}
            {" · "}évalué par {review.reviewer.fullName || review.reviewer.email}
          </p>
        </div>
        <Badge className="text-[10px]">{review.status}</Badge>
      </div>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("note_globale_1_10")}</Label>
            <Input type="number" min="1" max="10" value={rating} onChange={(e) => { setRating(e.target.value); setIsDirty(true); }} disabled={!canEditManager} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">{t("forces_reussites")}</Label>
          <textarea value={strengths} onChange={(e) => { setStrengths(e.target.value); setIsDirty(true); }} disabled={!canEditManager} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y disabled:opacity-70" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">{t("axes_apos_amelioration")}</Label>
          <textarea value={improvements} onChange={(e) => { setImprovements(e.target.value); setIsDirty(true); }} disabled={!canEditManager} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y disabled:opacity-70" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">{t("objectifs_prochaine_periode")}</Label>
          <textarea value={objectives} onChange={(e) => { setObjectives(e.target.value); setIsDirty(true); }} disabled={!canEditManager} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y disabled:opacity-70" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">{t("commentaires_manager")}</Label>
          <textarea value={managerComments} onChange={(e) => { setManagerComments(e.target.value); setIsDirty(true); }} disabled={!canEditManager} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y disabled:opacity-70" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">{t("commentaires_apos_employe")}</Label>
          <textarea value={employeeComments} onChange={(e) => { setEmployeeComments(e.target.value); setIsDirty(true); }} disabled={!canEditEmployee} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y disabled:opacity-70" placeholder={t("disponible_apres_soumission")} />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          {(canEditManager || canEditEmployee) && (
            <Button variant="outline" onClick={() => save()} disabled={pending}>
              {pending ? "..." : t("enregistrer")}
            </Button>
          )}
          {canEditManager && review.status === "draft" && (
            <Button onClick={() => save("submitted")} disabled={pending}>
              <Send className="h-4 w-4 mr-1.5" />{t("editor_soumettre_a_l_employe")}</Button>
          )}
          {canEditEmployee && (review.status === "submitted" || review.status === "reviewed") && (
            <Button onClick={() => save("acknowledged")} disabled={pending}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />{t("editor_j_ai_pris_connaissance")}</Button>
          )}
          {isReviewer && review.status === "acknowledged" && (
            <Button onClick={() => save("closed")} disabled={pending} variant="outline">
              <Lock className="h-4 w-4 mr-1.5" />{t("editor_cloturer")}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

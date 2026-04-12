"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Wrench,
  Code,
  Monitor,
  Tablet,
  Globe,
  Cog,
  MessageSquare,
  Settings,
  ArrowLeft,
  ArrowRight,
  Send,
  Loader2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────
type ServiceOption = {
  value: string;
  label: string;
  icon: React.ElementType;
};

type UrgencyLevel = "normal" | "urgent" | "critical";

// ── Service options ─────────────────────────────────────
const SERVICE_OPTIONS: ServiceOption[] = [
  { value: "plc-support", label: "Support PLC", icon: Wrench },
  { value: "plc-programming", label: "Programmation PLC", icon: Code },
  { value: "scada", label: "SCADA", icon: Monitor },
  { value: "hmi", label: "Interface HMI", icon: Tablet },
  { value: "web-development", label: "Developpement Web", icon: Globe },
  { value: "automation", label: "Automatisation", icon: Cog },
  { value: "consulting", label: "Consultation", icon: MessageSquare },
  { value: "maintenance", label: "Maintenance", icon: Settings },
];

const URGENCY_CONFIG: Record<
  UrgencyLevel,
  { label: string; className: string; badgeVariant: "secondary" | "warning" | "destructive" }
> = {
  normal: {
    label: "Normale",
    className: "border-border hover:border-[#0F2D52] hover:bg-[#0F2D52]/5",
    badgeVariant: "secondary",
  },
  urgent: {
    label: "Urgente",
    className: "border-amber-300 hover:border-amber-400 hover:bg-amber-50",
    badgeVariant: "warning",
  },
  critical: {
    label: "Critique",
    className: "border-red-300 hover:border-red-400 hover:bg-red-50",
    badgeVariant: "destructive",
  },
};

// ── Component ───────────────────────────────────────────
export function NewRequestModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [serviceType, setServiceType] = useState("");
  const [description, setDescription] = useState("");
  const [plcBrand, setPlcBrand] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [budget, setBudget] = useState("");

  // ── Reset ──────────────────────────────────────────
  function reset() {
    setStep(1);
    setServiceType("");
    setDescription("");
    setPlcBrand("");
    setUrgency("normal");
    setBudget("");
    setSubmitting(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  // ── Validation ─────────────────────────────────────
  const canGoStep2 = serviceType !== "";
  const canGoStep3 = description.trim().length > 0;

  // ── Submit ─────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/project-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          description: description.trim(),
          urgencyLevel: urgency,
          plcBrand: plcBrand.trim() || undefined,
          budget: budget.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      toast.success("Demande envoyee avec succes");
      handleOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Service label helper ───────────────────────────
  const selectedService = SERVICE_OPTIONS.find((s) => s.value === serviceType);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle demande</DialogTitle>
          <DialogDescription>
            Decrivez votre besoin en 3 etapes
          </DialogDescription>
        </DialogHeader>

        {/* ── Step indicators ─────────────────────────── */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2.5 rounded-full transition-all duration-300",
                s === step
                  ? "w-8 bg-[#0F2D52]"
                  : s < step
                    ? "w-2.5 bg-[#0F2D52]/40"
                    : "w-2.5 bg-muted-foreground/20"
              )}
            />
          ))}
        </div>

        {/* ── Step 1: Service type ────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              Type de service
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SERVICE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = serviceType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setServiceType(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all cursor-pointer text-center",
                      selected
                        ? "ring-2 ring-[#0F2D52] bg-[#0F2D52]/5 border-[#0F2D52]"
                        : "border-border hover:border-[#0F2D52]/40 hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                        selected
                          ? "bg-[#0F2D52] text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium leading-tight",
                        selected ? "text-[#0F2D52]" : "text-muted-foreground"
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 2: Details ─────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="req-desc">
                Description <span className="text-destructive">*</span>
              </label>
              <textarea
                id="req-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Decrivez votre besoin..."
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="req-plc">
                Marque PLC <span className="text-muted-foreground text-xs">(optionnel)</span>
              </label>
              <input
                id="req-plc"
                type="text"
                value={plcBrand}
                onChange={(e) => setPlcBrand(e.target.value)}
                placeholder="Ex: Siemens S7-1500"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Urgence</label>
              <div className="flex gap-2">
                {(Object.entries(URGENCY_CONFIG) as [UrgencyLevel, (typeof URGENCY_CONFIG)[UrgencyLevel]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUrgency(key)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all cursor-pointer",
                        urgency === key
                          ? key === "normal"
                            ? "ring-2 ring-[#0F2D52] bg-[#0F2D52]/5 border-[#0F2D52] text-[#0F2D52]"
                            : key === "urgent"
                              ? "ring-2 ring-amber-400 bg-amber-50 border-amber-400 text-amber-700"
                              : "ring-2 ring-red-400 bg-red-50 border-red-400 text-red-700"
                          : config.className
                      )}
                    >
                      {config.label}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="req-budget">
                Budget estime <span className="text-muted-foreground text-xs">(optionnel)</span>
              </label>
              <input
                id="req-budget"
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Ex: 5000 $ - 10000 $"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Recap ───────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              Recapitulatif
            </p>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Service</span>
                <span className="text-sm font-semibold">
                  {selectedService?.label ?? serviceType}
                </span>
              </div>

              <div className="border-t" />

              <div>
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="text-sm mt-1">{description}</p>
              </div>

              {plcBrand.trim() && (
                <>
                  <div className="border-t" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Marque PLC</span>
                    <span className="text-sm font-medium">{plcBrand}</span>
                  </div>
                </>
              )}

              <div className="border-t" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Urgence</span>
                <Badge variant={URGENCY_CONFIG[urgency].badgeVariant}>
                  {URGENCY_CONFIG[urgency].label}
                </Badge>
              </div>

              {budget.trim() && (
                <>
                  <div className="border-t" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Budget estime</span>
                    <span className="text-sm font-medium">{budget}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Navigation ──────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className={cn(step === 1 && "invisible")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Precedent
          </Button>

          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 ? !canGoStep2 : !canGoStep3}
            >
              Suivant
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Envoyer la demande
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

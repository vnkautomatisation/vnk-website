"use client";
// ═══════════════════════════════════════════════════════════
// Canvas de signature VNK — 3 modes : Dessiner, Initiales, Importer
// Look papier signature, stroke lisse, haute resolution adaptative
// ═══════════════════════════════════════════════════════════
import { useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Pen, Eraser, Check, Type, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type SignMode = "draw" | "type" | "upload";

export function SignatureCanvas({
  onSave,
  height = 220,
  disabled = false,
  legalText,
}: {
  onSave: (dataUrl: string) => void | Promise<void>;
  height?: number;
  disabled?: boolean;
  legalText?: string;
}) {
  const tc = useTranslations("common");
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<SignMode>("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initials, setInitials] = useState("");
  const [uploadedImg, setUploadedImg] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: height });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Midpoint smoothing : on garde les 2 derniers points pour calculer la courbe
  const p0Ref = useRef<{ x: number; y: number } | null>(null);
  const p1Ref = useRef<{ x: number; y: number } | null>(null);

  // ── Taille adaptative au container ─────────────────
  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const update = () => {
      const w = wrapRef.current?.clientWidth ?? 0;
      if (w > 0) setSize({ w, h: height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [height]);

  // ── Init canvas haute resolution ───────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Super-sampling 8x : haute resolution + downscale CSS = bilinear filtering du browser = anti-aliasing premium
    const dpr = Math.max(8, (window.devicePixelRatio || 1) * 4);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.strokeStyle = "#0F2D52";
    // Re-render contenu si on avait des initiales
    if (mode === "type" && initials) renderInitials(initials);
    if (mode === "upload" && uploadedImg) renderImage(uploadedImg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // ── Tracage avec courbes bezier (smooth) ───────────
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || mode !== "draw") return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    // Point de depart : petit dot pour marquer le debut du trace
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle as string;
    ctx.fill();
    p0Ref.current = pos;
    p1Ref.current = pos;
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    const p0 = p0Ref.current;
    const p1 = p1Ref.current;
    if (!ctx || !p0 || !p1) return;
    const p2 = getPos(e);
    // Midpoint smoothing : courbe de mid(p0,p1) a mid(p1,p2) avec p1 comme controle
    const c1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const c2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.quadraticCurveTo(p1.x, p1.y, c2.x, c2.y);
    ctx.stroke();
    p0Ref.current = p1;
    p1Ref.current = p2;
    setHasContent(true);
  };

  const stopDrawing = () => {
    // Termine le trace en allant jusqu'au dernier point
    const ctx = canvasRef.current?.getContext("2d");
    const p0 = p0Ref.current;
    const p1 = p1Ref.current;
    if (ctx && p0 && p1 && (p0.x !== p1.x || p0.y !== p1.y)) {
      const c1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    setIsDrawing(false);
    p0Ref.current = null;
    p1Ref.current = null;
  };

  // ── Clear ───────────────────────────────────────────
  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    setInitials("");
    setUploadedImg(null);
  };

  // ── Render initials ──────────────────────────────────
  const renderInitials = useCallback((text: string) => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text.trim()) { setHasContent(false); return; }
    // Taille adaptative selon longueur
    const fontSize = text.length <= 3 ? 72 : text.length <= 4 ? 60 : 52;
    ctx.save();
    ctx.font = `italic 700 ${fontSize}px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive`;
    ctx.fillStyle = "#0F2D52";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), size.w / 2, size.h / 2);
    ctx.restore();
    setHasContent(true);
  }, [size]);

  // ── Render uploaded image ────────────────────────────
  const renderImage = useCallback((src: string) => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(size.w / img.width, size.h / img.height) * 0.85;
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (size.w - w) / 2;
      const y = (size.h - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      setHasContent(true);
    };
    img.src = src;
  }, [size]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setUploadedImg(src);
      renderImage(src);
    };
    reader.readAsDataURL(file);
  };

  // ── Save ────────────────────────────────────────────
  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await onSave(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  // ── Mode tabs ───────────────────────────────────────
  const modes: { key: SignMode; label: string; icon: typeof Pen }[] = [
    { key: "draw", label: "Dessiner", icon: Pen },
    { key: "type", label: "Initiales", icon: Type },
    { key: "upload", label: "Importer", icon: Upload },
  ];

  const switchMode = (m: SignMode) => {
    clear();
    setMode(m);
  };

  const defaultLegal = legalText ?? tc("conditions_de_ce_document");

  return (
    <div className="space-y-4">
      {/* Mode tabs — pill VNK */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => switchMode(m.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all",
                active
                  ? "bg-white shadow-md text-[#0F2D52] ring-1 ring-[#0F2D52]/10"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
              )}
            >
              <Icon className="h-4 w-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Canvas area — papier signature avec ligne guide */}
      <div
        ref={wrapRef}
        className="relative rounded-xl bg-gradient-to-b from-white to-slate-50/40 border border-slate-200 shadow-[inset_0_2px_8px_rgba(15,45,82,0.04),0_1px_0_rgba(255,255,255,0.8)] overflow-hidden"
        style={{ height: size.h }}
      >
        {/* Ligne guide papier (X _____ ) */}
        <div className="absolute left-6 right-6 bottom-12 flex items-center gap-3 pointer-events-none">
          <span className="text-slate-300 text-xl font-serif select-none">×</span>
          <div className="flex-1 border-b border-slate-200" />
        </div>

        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={cn(
            "block touch-none relative z-10",
            mode === "draw" ? "cursor-crosshair" : "cursor-default"
          )}
          style={{ imageRendering: "auto", WebkitFontSmoothing: "antialiased" } as React.CSSProperties}
          aria-label={tc("zone_de_signature")}
        />

        {/* Placeholder elegant (en dehors du canvas pour eviter rendu pixel) */}
        {!hasContent && mode === "draw" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="text-2xl sm:text-3xl text-slate-300 italic font-light tracking-wide select-none"
              style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
            >{tc("signature_canvas_votre_signature")}</span>
            <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <Pen className="h-3 w-3" />{tc("signature_canvas_tracez_avec_la_souris_ou_votre_doigt")}</span>
          </div>
        )}
        {!hasContent && mode === "upload" && !uploadedImg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <Upload className="h-7 w-7 text-slate-300 mb-2" />
            <span className="text-sm text-slate-400">{tc("importez_votre_signature")}</span>
            <span className="text-[11px] text-slate-400 mt-0.5">PNG, JPG ou WebP</span>
          </div>
        )}
        {!hasContent && mode === "type" && !initials && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-slate-400">{tc("signature_canvas_tapez_vos_initiales_ci_dessous")}</span>
          </div>
        )}
      </div>

      {/* Type initials input */}
      {mode === "type" && (
        <input
          type="text"
          value={initials}
          onChange={(e) => {
            const val = e.target.value.slice(0, 5);
            setInitials(val);
            renderInitials(val);
          }}
          placeholder="Ex : YV"
          maxLength={5}
          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-center text-xl font-bold tracking-[0.4em] uppercase text-[#0F2D52] focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none transition-all"
          disabled={disabled}
        />
      )}

      {/* Upload button */}
      {mode === "upload" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="w-full h-11"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {uploadedImg ? tc("changer_image") : tc("choisir_fichier")}
          </Button>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2 items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={!hasContent || disabled}
          className="h-10"
        >
          <Eraser className="h-4 w-4 mr-1.5" />
          Effacer
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!hasContent || saving || disabled}
          className="ml-auto h-10 px-5 bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md disabled:opacity-40"
        >
          <Check className="h-4 w-4 mr-1.5" />
          {saving ? "Enregistrement…" : "Signer"}
        </Button>
      </div>

      <p className="text-[11px] text-slate-500 text-center leading-relaxed px-2">
        En signant, vous confirmez avoir lu et accepté {defaultLegal}.
        <br className="hidden sm:inline" />{tc("signature_canvas_votre_adresse_ip_est_enregistree_comme_preuve")}</p>
    </div>
  );
}

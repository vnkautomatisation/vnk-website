"use client";
// ═══════════════════════════════════════════════════════════
// Canvas de signature VNK — 3 modes : Dessiner, Initiales, Importer
// ═══════════════════════════════════════════════════════════
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Pen, Eraser, Check, Type, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type SignMode = "draw" | "type" | "upload";

export function SignatureCanvas({
  onSave,
  width = 500,
  height = 200,
  disabled = false,
  legalText,
}: {
  onSave: (dataUrl: string) => void | Promise<void>;
  width?: number;
  height?: number;
  disabled?: boolean;
  /** Texte legal sous le canvas. Par defaut: "conditions du document" */
  legalText?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<SignMode>("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initials, setInitials] = useState("");
  const [uploadedImg, setUploadedImg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Init canvas ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Force minimum 2x resolution pour eviter la pixelisation
    const dpr = Math.max(2, window.devicePixelRatio || 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = "100%";
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F2D52";
  }, [width, height]);

  // ── Draw mode ───────────────────────────────────────
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
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasContent(true);
  };

  const stopDrawing = () => setIsDrawing(false);

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

  // ── Render initials on canvas ────────────────────────
  const renderInitials = useCallback((text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text.trim()) { setHasContent(false); return; }
    ctx.save();
    ctx.scale(1 / dpr, 1 / dpr);
    ctx.font = `italic ${48 * dpr}px "Brush Script MT", "Segoe Script", "Dancing Script", cursive`;
    ctx.fillStyle = "#0F2D52";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), (width * dpr) / 2, (height * dpr) / 2);
    ctx.restore();
    setHasContent(true);
  }, [width, height]);

  // ── Render uploaded image on canvas ──────────────────
  const renderImage = useCallback((src: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Fit image in canvas maintaining aspect ratio
      const scale = Math.min((width * dpr) / img.width, (height * dpr) / img.height) * 0.8;
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (width * dpr - w) / 2;
      const y = (height * dpr - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      setHasContent(true);
    };
    img.src = src;
  }, [width, height]);

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

  const defaultLegal = legalText ?? "les conditions de ce document";

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex bg-muted/50 rounded-lg p-1 gap-1">
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => switchMode(m.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all",
                mode === m.key
                  ? "bg-white shadow-sm text-[#0F2D52]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Canvas area */}
      <div className="relative rounded-xl border-2 border-dashed border-border bg-white overflow-hidden">
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
            "block touch-none",
            mode === "draw" ? "cursor-crosshair" : "cursor-default"
          )}
          aria-label="Zone de signature"
        />

        {/* Placeholder texts */}
        {!hasContent && mode === "draw" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-muted-foreground/60">
            <Pen className="h-4 w-4 mr-2" />
            Signez ici avec la souris ou votre doigt
          </div>
        )}
        {mode === "upload" && !uploadedImg && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-muted-foreground/60">
            <Upload className="h-4 w-4 mr-2" />
            Importez une image de votre signature
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
          placeholder="Tapez vos initiales (ex: YV)"
          maxLength={5}
          className="w-full h-11 px-4 rounded-lg border bg-background text-center text-lg font-semibold tracking-widest focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none"
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
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {uploadedImg ? "Changer l'image" : "Choisir un fichier"}
          </Button>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={!hasContent || disabled}>
          <Eraser className="h-4 w-4 mr-1" />
          Effacer
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!hasContent || saving || disabled}
          className="ml-auto bg-[#0F2D52] hover:bg-[#1a3a66]"
        >
          <Check className="h-4 w-4 mr-1" />
          {saving ? "Enregistrement..." : "Signer"}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        En signant, vous confirmez avoir lu et accepte {defaultLegal}.
        Votre adresse IP est enregistree comme preuve legale.
      </p>
    </div>
  );
}

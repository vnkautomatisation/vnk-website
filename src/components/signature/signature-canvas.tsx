"use client";
// ═══════════════════════════════════════════════════════════
// Canvas de signature interne VNK
// Remplace Dropbox Sign : le client/admin dessine dans un canvas,
// on stocke le résultat en base64 dans contract.client_signature_data
// ou contract.admin_signature_data.
// ═══════════════════════════════════════════════════════════
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Pen, Eraser, Check } from "lucide-react";

export function SignatureCanvas({
  onSave,
  width = 500,
  height = 200,
  disabled = false,
}: {
  onSave: (dataUrl: string) => void | Promise<void>;
  width?: number;
  height?: number;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // HiDPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F2D52"; // VNK navy
  }, [width, height]);

  // Get position relative to canvas
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await onSave(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg border-2 border-dashed border-border bg-muted/20">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair touch-none block"
          aria-label="Zone de signature"
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-muted-foreground">
            <Pen className="h-4 w-4 mr-2" />
            Signez ici avec la souris ou votre doigt
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={!hasDrawn || disabled}>
          <Eraser className="h-4 w-4" />
          Effacer
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!hasDrawn || saving || disabled} className="ml-auto">
          <Check className="h-4 w-4" />
          {saving ? "Enregistrement…" : "Signer"}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        En signant, vous confirmez avoir lu et accepté les conditions du contrat.
        Votre adresse IP est enregistrée comme preuve légale.
      </p>
    </div>
  );
}

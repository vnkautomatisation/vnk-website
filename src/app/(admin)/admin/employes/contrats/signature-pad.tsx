"use client";
// Canvas de signature minimaliste — pas de dépendance externe.
// Renvoie la signature en data URL PNG via onChange dès qu'elle est non vide.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Resize canvas à la largeur du conteneur
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = 160 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `160px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#0F2D52";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    lastPoint.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !lastPoint.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    if (!hasInk) {
      setHasInk(true);
      // Émettre data URL au premier trait
      onChange(canvas.toDataURL("image/png"));
    }
  };
  const end = () => {
    if (drawing && hasInk) {
      // Émettre la version finale
      onChange(canvasRef.current!.toDataURL("image/png"));
    }
    setDrawing(false);
    lastPoint.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none cursor-crosshair rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground italic">
            Signez ici à la souris ou au doigt
          </span>
        )}
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground">
          {hasInk ? "Signature capturée — vous pouvez recommencer si nécessaire" : "En attente de signature"}
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={clear}>
          <Eraser className="h-3 w-3 mr-1" />Effacer
        </Button>
      </div>
    </div>
  );
}

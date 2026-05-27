"use client";
// Canvas de signature minimaliste — pas de dépendance externe.
// Renvoie la signature en data URL PNG via onChange dès qu'elle est non vide.
//
// Mode controle (optionnel) : si on passe `value` (data URL ou null),
// le composant restaure le trait au mount/remount. Ca evite que la signature
// disparaisse quand le composant est demonte/remonte (ex: switch d'onglets
// dans HandbookSignatureMobile).
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export function SignaturePad({
  onChange,
  value,
}: {
  onChange: (dataUrl: string | null) => void;
  value?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [ready, setReady] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  // Marqueur : data URL deja emis par CE composant. Sert a ignorer les
  // re-renders du parent qui repassent la meme valeur (evite boucle redraw).
  const lastEmittedRef = useRef<string | null>(null);

  // Resize canvas à la largeur du conteneur
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = 160 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `160px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#0F2D52";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      setReady(true);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Sync : `value` (parent) → canvas
  // - value=null && canvas a de l'encre → clear
  // - value=dataURL && canvas vide → redraw (restauration apres remount)
  // - value === lastEmittedRef → no-op (vient de nous, deja a l'ecran)
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Source = nous-meme : ignorer
    if (value && value === lastEmittedRef.current) return;

    if (!value) {
      // Clear demande par le parent
      if (!hasInk) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#0F2D52";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      setHasInk(false);
      lastEmittedRef.current = null;
      return;
    }
    // Restaurer le trait depuis la data URL
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.strokeStyle = "#0F2D52";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      setHasInk(true);
      lastEmittedRef.current = value;
    };
    img.src = value;
  }, [value, ready, hasInk]);

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
      const url = canvas.toDataURL("image/png");
      lastEmittedRef.current = url;
      onChange(url);
    }
  };
  const end = () => {
    if (drawing && hasInk) {
      // Émettre la version finale
      const url = canvasRef.current!.toDataURL("image/png");
      lastEmittedRef.current = url;
      onChange(url);
    }
    setDrawing(false);
    lastPoint.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#0F2D52";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasInk(false);
    lastEmittedRef.current = null;
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

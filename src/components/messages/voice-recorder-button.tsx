"use client";
// Bouton micro avec MediaRecorder API — cree un blob audio/webm encode base64
import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type VoiceAttachment = {
  kind: "audio";
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  durationSec: number;
};

export function VoiceRecorderButton({
  onRecorded,
  disabled,
  maxSec = 120,
  className,
}: {
  onRecorded: (att: VoiceAttachment) => void;
  disabled?: boolean;
  maxSec?: number;
  className?: string;
}) {
  const t = useTranslations("admin.messages");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [processing, setProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    intervalRef.current = null;
    stopTimeoutRef.current = null;
    setElapsed(0);
    setRecording(false);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = mr;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        cleanup();
        if (blob.size === 0) {
          toast.error(t("enregistrement_vide"));
          return;
        }
        setProcessing(true);
        const reader = new FileReader();
        reader.onloadend = () => {
          setProcessing(false);
          const dataUrl = reader.result as string;
          onRecorded({
            kind: "audio",
            name: `voice-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
            mimeType: blob.type,
            size: blob.size,
            dataUrl,
            durationSec,
          });
        };
        reader.onerror = () => {
          setProcessing(false);
          toast.error(t("lecture_fichier_audio_impossible"));
        };
        reader.readAsDataURL(blob);
      };

      mr.start();
      setRecording(true);

      intervalRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);

      stopTimeoutRef.current = setTimeout(() => {
        toast.info(`Limite ${maxSec}s atteinte`);
        stopRecording();
      }, maxSec * 1000);
    } catch (err) {
      cleanup();
      const msg = err instanceof Error ? err.message : t("acces_micro_refuse");
      toast.error(msg.includes("denied") || msg.includes("Permission") ? t("acces_microphone_refuse") : t("impossible_acceder_micro"));
    }
  }, [disabled, recording, maxSec, onRecorded, cleanup, stopRecording]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (recording) {
    return (
      <button
        type="button"
        onClick={stopRecording}
        className={cn("flex items-center gap-1.5 h-9 px-3 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors animate-pulse", className)}
        aria-label={t("arreter_enregistrement")}
      >
        <Square className="h-4 w-4 fill-current" />
        <span className="text-xs font-mono tabular-nums">{fmt(elapsed)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled || processing}
      className={cn("h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50", className)}
      aria-label={t("enregistrer_message_vocal")}
    >
      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}

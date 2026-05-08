"use client";
import { useState, useCallback, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
};

type State = ConfirmOptions & { resolve: (v: boolean) => void };

/**
 * Promise-based confirmation hook utilisant le ConfirmDialog themise.
 *
 * Usage:
 *   const { confirm, ConfirmModal } = useConfirm();
 *   const ok = await confirm({ title, description });
 *   if (!ok) return;
 *
 *   return <>{...}{ConfirmModal}</>;
 */
export function useConfirm(): { confirm: (opts: ConfirmOptions) => Promise<boolean>; ConfirmModal: ReactNode } {
  const [state, setState] = useState<State | null>(null);
  const [pending, setPending] = useState(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (!state) return;
    setPending(true);
    state.resolve(true);
    setTimeout(() => {
      setState(null);
      setPending(false);
    }, 100);
  };

  const handleCancel = () => {
    if (!state) return;
    state.resolve(false);
    setState(null);
  };

  const ConfirmModal: ReactNode = state ? (
    <ConfirmDialog
      open={true}
      onOpenChange={(o) => { if (!o && !pending) handleCancel(); }}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel ?? "Confirmer"}
      cancelLabel={state.cancelLabel ?? "Annuler"}
      variant={state.variant ?? "default"}
      loading={pending}
      onConfirm={handleConfirm}
    />
  ) : null;

  return { confirm, ConfirmModal };
}

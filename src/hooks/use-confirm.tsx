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

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (!state) return;
    const resolveFn = state.resolve;
    setState(null);
    resolveFn(true);
  };

  const handleCancel = () => {
    if (!state) return;
    const resolveFn = state.resolve;
    setState(null);
    resolveFn(false);
  };

  const ConfirmModal: ReactNode = state ? (
    <ConfirmDialog
      open={true}
      onOpenChange={(o) => { if (!o) handleCancel(); }}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel ?? "Confirmer"}
      cancelLabel={state.cancelLabel}
      variant={state.variant ?? "default"}
      onConfirm={handleConfirm}
    />
  ) : null;

  return { confirm, ConfirmModal };
}

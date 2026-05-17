"use client";
// Remplace les prompt() et confirm() natifs (bloquants, non-stylables, inaccessibles, brisés mobile).
// API : await promptDialog({...}) ou await confirmDialog({...})
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type CommonOpts = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};
type PromptOpts = CommonOpts & {
  kind?: "prompt";
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  required?: boolean;
};
type ConfirmOpts = CommonOpts & {
  kind: "confirm";
};

type DialogState =
  | (PromptOpts & { kind: "prompt"; resolve: (v: string | null) => void })
  | (ConfirmOpts & { resolve: (v: boolean) => void })
  | null;

let currentState: DialogState = null;
const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }

export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    currentState = { ...opts, kind: "prompt", resolve };
    notify();
  });
}

export function confirmDialog(opts: Omit<ConfirmOpts, "kind">): Promise<boolean> {
  return new Promise((resolve) => {
    currentState = { ...opts, kind: "confirm", resolve };
    notify();
  });
}

export function PromptDialogHost() {
  const [, force] = useState(0);
  const [value, setValue] = useState("");

  useEffect(() => {
    const listener = () => {
      if (currentState?.kind !== "confirm") {
        setValue((currentState as PromptOpts | null)?.defaultValue ?? "");
      }
      force((n) => n + 1);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const close = (result: string | boolean | null) => {
    const state = currentState;
    if (!state) return;
    if (state.kind === "confirm") (state.resolve as (v: boolean) => void)(result === true);
    else (state.resolve as (v: string | null) => void)(typeof result === "string" ? result : null);
    currentState = null;
    setValue("");
    force((n) => n + 1);
  };

  const state = currentState;
  if (!state) return null;

  const isConfirm = state.kind === "confirm";
  const promptState = state.kind === "prompt" ? state : null;
  const canConfirm = isConfirm || !promptState?.required || value.trim().length > 0;
  const headerCls = state.variant === "destructive"
    ? "bg-gradient-to-br from-red-700 to-red-900"
    : "bg-gradient-to-br from-[#0F2D52] to-[#15406d]";

  return (
    <Dialog open onOpenChange={(o) => !o && close(isConfirm ? false : null)}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className={`px-5 py-4 text-white ${headerCls}`}>
          <DialogHeader>
            <DialogTitle className="text-base text-white">{state.title}</DialogTitle>
            {state.description && (
              <DialogDescription className="text-white/80 text-xs">{state.description}</DialogDescription>
            )}
          </DialogHeader>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (canConfirm) close(isConfirm ? true : value); }}
          className="p-5 space-y-3"
        >
          {promptState && (
            <div className="space-y-1.5">
              {promptState.label && (
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  {promptState.label}
                </Label>
              )}
              {promptState.multiline ? (
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={promptState.placeholder}
                  rows={4}
                  autoFocus
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30"
                />
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={promptState.placeholder}
                  autoFocus
                />
              )}
            </div>
          )}
          <DialogFooter className="-mx-5 -mb-5 px-5 py-3 border-t bg-muted/30 gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => close(isConfirm ? false : null)}>
              {state.cancelLabel || "Annuler"}
            </Button>
            <Button
              type="submit"
              variant={state.variant === "destructive" ? "destructive" : "default"}
              disabled={!canConfirm}
              autoFocus={isConfirm}
            >
              {state.confirmLabel || (isConfirm ? "Confirmer" : "OK")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

export type EntityType = "client" | "mandate" | "quote" | "invoice" | "contract";
export type ClientTab = "info" | "mandates" | "quotes" | "invoices" | "contracts";

type ActivePanel = { type: EntityType; id: number; clientTab?: ClientTab } | null;

type OpenOptions = { clientTab?: ClientTab };

type EntityPanelsContextValue = {
  active: ActivePanel;
  open: (type: EntityType, id: number, options?: OpenOptions) => void;
  close: () => void;
};

const Context = createContext<EntityPanelsContextValue | null>(null);

/**
 * Hook centralise pour ouvrir n'importe quel panneau detail (client/mandat/devis/facture/contrat)
 * depuis n'importe ou dans l'admin.
 *
 * Usage:
 *   const { open } = useEntityPanels();
 *   <button onClick={() => open("mandate", 42)}>Voir</button>
 *   <button onClick={() => open("client", 7, { clientTab: "quotes" })}>Voir devis</button>
 */
export function useEntityPanels(): EntityPanelsContextValue {
  const ctx = useContext(Context);
  if (!ctx) {
    return {
      active: null,
      open: () => { console.warn("useEntityPanels: aucun Provider trouve dans l'arbre"); },
      close: () => {},
    };
  }
  return ctx;
}

export function EntityPanelsProvider({ children, panels }: { children: ReactNode; panels: ReactNode }) {
  const [active, setActive] = useState<ActivePanel>(null);
  return (
    <Context.Provider value={{
      active,
      open: (type, id, options) => setActive({ type, id, clientTab: options?.clientTab }),
      close: () => setActive(null),
    }}>
      {children}
      {panels}
    </Context.Provider>
  );
}

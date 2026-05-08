"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

export type EntityType = "client" | "mandate" | "quote" | "invoice" | "contract";

type ActivePanel = { type: EntityType; id: number } | null;

type EntityPanelsContextValue = {
  active: ActivePanel;
  open: (type: EntityType, id: number) => void;
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
 *
 * Le Provider est wrappe dans le admin layout, il rend les 5 panneaux et controle leur visibilite.
 * Un seul panneau peut etre ouvert a la fois (cliquer sur une entite liee dans un panel ferme l'actuel
 * et ouvre le nouveau).
 */
export function useEntityPanels(): EntityPanelsContextValue {
  const ctx = useContext(Context);
  if (!ctx) {
    // Soft fallback: si pas dans Provider, ne fait rien
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
      open: (type, id) => setActive({ type, id }),
      close: () => setActive(null),
    }}>
      {children}
      {panels}
    </Context.Provider>
  );
}

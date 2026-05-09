"use client";
import { ClientDetailPanel } from "@/components/admin/client-detail-panel";
import { MandateDetailPanel } from "@/components/admin/mandate-detail-panel";
import { QuoteDetailPanel } from "@/components/admin/quote-detail-panel";
import { InvoiceDetailPanel } from "@/components/admin/invoice-detail-panel";
import { ContractDetailPanel } from "@/components/admin/contract-detail-panel";
import { RequestDetailPanel } from "@/components/admin/request-detail-panel";
import { useEntityPanels, EntityPanelsProvider } from "@/hooks/use-entity-panels";

/**
 * Hote qui rend les 5 panneaux detail entites en tirant leur etat du contexte.
 * Doit etre rendu une seule fois dans l'arbre admin (typiquement dans le layout).
 *
 * Combine avec EntityPanelsProvider pour exposer la fonction `open(type, id)` partout.
 */
function PanelsHost() {
  const { active, close } = useEntityPanels();

  return (
    <>
      <ClientDetailPanel
        clientId={active?.type === "client" ? active.id : null}
        open={active?.type === "client"}
        onOpenChange={(o) => { if (!o) close(); }}
        initialTab={active?.type === "client" ? active.clientTab : undefined}
      />
      <MandateDetailPanel
        mandateId={active?.type === "mandate" ? active.id : null}
        open={active?.type === "mandate"}
        onOpenChange={(o) => { if (!o) close(); }}
      />
      <QuoteDetailPanel
        quoteId={active?.type === "quote" ? active.id : null}
        open={active?.type === "quote"}
        onOpenChange={(o) => { if (!o) close(); }}
      />
      <InvoiceDetailPanel
        invoiceId={active?.type === "invoice" ? active.id : null}
        open={active?.type === "invoice"}
        onOpenChange={(o) => { if (!o) close(); }}
      />
      <ContractDetailPanel
        contractId={active?.type === "contract" ? active.id : null}
        open={active?.type === "contract"}
        onOpenChange={(o) => { if (!o) close(); }}
      />
      <RequestDetailPanel
        requestId={active?.type === "request" ? active.id : null}
        open={active?.type === "request"}
        onOpenChange={(o) => { if (!o) close(); }}
      />
    </>
  );
}

/**
 * Wrapper a placer dans le layout admin pour activer les panneaux globaux.
 *
 * Usage:
 *   <EntityPanelsRoot>
 *     {children}
 *   </EntityPanelsRoot>
 */
export function EntityPanelsRoot({ children }: { children: React.ReactNode }) {
  return (
    <EntityPanelsProvider panels={<PanelsHost />}>
      {children}
    </EntityPanelsProvider>
  );
}

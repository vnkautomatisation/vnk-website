"use client";
// Vue Catalogues — sous-onglets : Services · Codes promo · Étiquettes ·
// Sources · Industries · Catégories dépenses · Statuts workflow · Devises ·
// Modes de paiement · Modes de contact.
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutGrid, ChevronLeft, Plus, MoreHorizontal, Edit, Trash2,
  Tag, Globe, Factory, Receipt, Workflow, Coins, CreditCard, Phone,
  Briefcase, Ticket, Power, ArrowUp, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ServiceDialog } from "./service-dialog";
import { PromoDialog } from "./promo-dialog";
import { CatalogItemDialog } from "./catalog-item-dialog";
import { deleteServiceAction, deletePromoAction, updateServiceAction, updatePromoAction } from "@/app/actions/services";
import { deleteCatalogItemAction, updateCatalogItemAction, reorderCatalogItemsAction, type CatalogType } from "@/app/actions/catalogs";

export type ServiceRow = {
  id: number; key: string; name: string; description: string | null;
  basePrice: string; priceUnit: string; currency: string;
  category: string | null; isActive: boolean; sortOrder: number;
};
export type PromoRow = {
  id: number; code: string; description: string | null;
  discountType: string; value: string;
  maxUses: number | null; currentUses: number;
  validFrom: string | null; validUntil: string | null;
  isActive: boolean; createdAt: string;
};
export type CatalogItemRow = {
  id: number; type: string; key: string; name: string;
  description: string | null; color: string | null; icon: string | null;
  metadata: Record<string, unknown> | null;
  isSystem: boolean; isActive: boolean; sortOrder: number;
};

type Tab =
  | "services" | "promos"
  | "client_tag" | "client_source" | "industry"
  | "expense_category" | "workflow_status" | "currency"
  | "payment_method" | "contact_method";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: "services", label: "Services offerts", icon: Briefcase, color: "#0F2D52" },
  { key: "promos", label: "Codes promo", icon: Ticket, color: "#E5A50A" },
  { key: "client_tag", label: "Étiquettes clients", icon: Tag, color: "#26A269" },
  { key: "client_source", label: "Sources clients", icon: Globe, color: "#1A5FB4" },
  { key: "industry", label: "Industries", icon: Factory, color: "#613583" },
  { key: "expense_category", label: "Catégories dépenses", icon: Receipt, color: "#C01C28" },
  { key: "workflow_status", label: "Statuts workflow", icon: Workflow, color: "#0F2D52" },
  { key: "currency", label: "Devises", icon: Coins, color: "#26A269" },
  { key: "payment_method", label: "Modes de paiement", icon: CreditCard, color: "#635bff" },
  { key: "contact_method", label: "Modes de contact", icon: Phone, color: "#1A5FB4" },
];

export function CatalogsView({
  services, promos, catalogItems,
}: {
  services: ServiceRow[];
  promos: PromoRow[];
  catalogItems: CatalogItemRow[];
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("services");

  // Dialogs
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; service: ServiceRow | null }>({ open: false, service: null });
  const [promoDialog, setPromoDialog] = useState<{ open: boolean; promo: PromoRow | null }>({ open: false, promo: null });
  const [catalogDialog, setCatalogDialog] = useState<{ open: boolean; item: CatalogItemRow | null; type: string }>({ open: false, item: null, type: "" });
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "service" | "promo" | "catalog"; id: number; label: string } | null>(null);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { kind, id, label } = confirmDelete;
    let result: { success: boolean; error?: string };
    if (kind === "service") result = await deleteServiceAction({ id });
    else if (kind === "promo") result = await deletePromoAction({ id });
    else result = await deleteCatalogItemAction({ id });
    if (result.success) {
      toast.success(`${label} supprimé`);
      router.refresh();
    } else {
      toast.error(result.error || "Erreur");
    }
    setConfirmDelete(null);
  };

  const toggleServiceActive = async (s: ServiceRow) => {
    const result = await updateServiceAction({ id: s.id, isActive: !s.isActive });
    if (result.success) { toast.success(s.isActive ? "Service désactivé" : "Service activé"); router.refresh(); }
    else toast.error(result.error || "Erreur");
  };
  const togglePromoActive = async (p: PromoRow) => {
    const result = await updatePromoAction({
      id: p.id, code: p.code,
      description: p.description, discountType: p.discountType as "percent" | "fixed",
      value: Number(p.value),
      maxUses: p.maxUses, validFrom: p.validFrom, validUntil: p.validUntil,
      isActive: !p.isActive,
    });
    if (result.success) { toast.success(p.isActive ? "Code désactivé" : "Code activé"); router.refresh(); }
    else toast.error(result.error || "Erreur");
  };
  const toggleCatalogActive = async (item: CatalogItemRow) => {
    const result = await updateCatalogItemAction({ id: item.id, isActive: !item.isActive });
    if (result.success) { toast.success(item.isActive ? "Désactivé" : "Activé"); router.refresh(); }
    else toast.error(result.error || "Erreur");
  };

  // Permute deux items adjacents dans la liste du type courant
  const moveItem = async (item: CatalogItemRow, direction: "up" | "down") => {
    const sameType = catalogItems.filter((i) => i.type === item.type).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sameType.findIndex((i) => i.id === item.id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sameType.length) return;

    const newOrder = [...sameType];
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];

    const result = await reorderCatalogItemsAction({
      type: item.type as CatalogType,
      orderedIds: newOrder.map((i) => i.id),
    });
    if (result.success) router.refresh();
    else toast.error(result.error || "Erreur");
  };

  const currentMeta = TABS.find((t) => t.key === tab)!;
  const itemsForCurrentType = tab !== "services" && tab !== "promos"
    ? catalogItems.filter((i) => i.type === tab)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-amber-500 shrink-0">
          <LayoutGrid className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Catalogues</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Services offerts, codes promo et listes de référence utilisées dans tout le portail
          </p>
        </div>
      </div>

      {/* Sous-tabs scrollable */}
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            const count = t.key === "services"
              ? services.length
              : t.key === "promos"
              ? promos.length
              : catalogItems.filter((i) => i.type === t.key).length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors whitespace-nowrap",
                  active ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                <Badge variant="secondary" className="text-[10px] ml-1">{count}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* SERVICES */}
      {tab === "services" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{services.filter((s) => s.isActive).length} actif{services.filter((s) => s.isActive).length > 1 ? "s" : ""} sur {services.length}</p>
            <Button onClick={() => setServiceDialog({ open: true, service: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />Nouveau service
            </Button>
          </div>
          <Card>
            <div className="divide-y">
              {services.map((s) => (
                <div key={s.id} className={cn("flex items-center gap-4 p-4 hover:bg-muted/40", !s.isActive && "opacity-60")}>
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52] text-white flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{s.name}</p>
                      {!s.isActive && <Badge className="text-[10px] bg-gray-500 hover:bg-gray-500">{tc("disabled")}</Badge>}
                      {s.category && <Badge variant="outline" className="text-[10px]">{s.category}</Badge>}
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>}
                  </div>
                  <div className="hidden md:block text-right shrink-0">
                    <p className="font-semibold text-sm">{Number(s.basePrice).toLocaleString("fr-CA", { style: "currency", currency: s.currency })}</p>
                    <p className="text-[10px] text-muted-foreground">par {s.priceUnit === "hour" ? "heure" : s.priceUnit === "day" ? "jour" : s.priceUnit === "fixed" ? "forfait" : s.priceUnit === "month" ? "mois" : "année"}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setServiceDialog({ open: true, service: s })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleServiceActive(s)}><Power className="h-4 w-4 mr-2" />{s.isActive ? "Désactiver" : "Activer"}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "service", id: s.id, label: s.name })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {services.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Aucun service. Cliquez sur « Nouveau service ».</p>}
            </div>
          </Card>
        </div>
      )}

      {/* CODES PROMO */}
      {tab === "promos" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{promos.filter((p) => p.isActive).length} actif{promos.filter((p) => p.isActive).length > 1 ? "s" : ""} sur {promos.length}</p>
            <Button onClick={() => setPromoDialog({ open: true, promo: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />Nouveau code promo
            </Button>
          </div>
          <Card>
            <div className="divide-y">
              {promos.map((p) => {
                const expired = p.validUntil ? new Date(p.validUntil) < new Date() : false;
                return (
                  <div key={p.id} className={cn("flex items-center gap-4 p-4 hover:bg-muted/40", (!p.isActive || expired) && "opacity-60")}>
                    <div className="h-9 w-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Ticket className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono font-bold text-sm">{p.code}</p>
                        {!p.isActive && <Badge className="text-[10px] bg-gray-500 hover:bg-gray-500">{tc("disabled")}</Badge>}
                        {expired && <Badge className="text-[10px] bg-red-500 hover:bg-red-500">Expiré</Badge>}
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>}
                    </div>
                    <div className="hidden md:block text-right shrink-0">
                      <p className="font-semibold text-sm">
                        {p.discountType === "percent" ? `-${Number(p.value)}%` : `-${Number(p.value).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.maxUses ? `${p.currentUses}/${p.maxUses}` : `${p.currentUses} utilisations`}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPromoDialog({ open: true, promo: p })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePromoActive(p)}><Power className="h-4 w-4 mr-2" />{p.isActive ? "Désactiver" : "Activer"}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "promo", id: p.id, label: p.code })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              {promos.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Aucun code promo.</p>}
            </div>
          </Card>
        </div>
      )}

      {/* CATALOGUES GÉNÉRIQUES */}
      {tab !== "services" && tab !== "promos" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {itemsForCurrentType.filter((i) => i.isActive).length} actif{itemsForCurrentType.filter((i) => i.isActive).length > 1 ? "s" : ""} sur {itemsForCurrentType.length}
            </p>
            <Button onClick={() => setCatalogDialog({ open: true, item: null, type: tab })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />Nouveau {currentMeta.label.toLowerCase().slice(0, -1)}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemsForCurrentType.map((item) => (
              <Card key={item.id} className={cn("vnk-card-hover", !item.isActive && "opacity-60")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: item.color ?? "#0F2D52" }}>
                      <currentMeta.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{item.name}</p>
                        {item.isSystem && <Badge variant="secondary" className="text-[9px]">Système</Badge>}
                        {!item.isActive && <Badge className="text-[9px] bg-gray-500 hover:bg-gray-500">Off</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{item.key}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setCatalogDialog({ open: true, item, type: item.type })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveItem(item, "up")}><ArrowUp className="h-4 w-4 mr-2" />Monter</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveItem(item, "down")}><ArrowDown className="h-4 w-4 mr-2" />Descendre</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleCatalogActive(item)}><Power className="h-4 w-4 mr-2" />{item.isActive ? "Désactiver" : "Activer"}</DropdownMenuItem>
                        {!item.isSystem && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "catalog", id: item.id, label: item.name })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>}
                </CardContent>
              </Card>
            ))}
            {itemsForCurrentType.length === 0 && (
              <p className="col-span-full p-8 text-center text-sm text-muted-foreground">Aucun élément dans ce catalogue.</p>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ServiceDialog
        open={serviceDialog.open}
        onOpenChange={(open) => setServiceDialog({ open, service: open ? serviceDialog.service : null })}
        service={serviceDialog.service}
        onSaved={() => router.refresh()}
      />
      <PromoDialog
        open={promoDialog.open}
        onOpenChange={(open) => setPromoDialog({ open, promo: open ? promoDialog.promo : null })}
        promo={promoDialog.promo}
        onSaved={() => router.refresh()}
      />
      <CatalogItemDialog
        open={catalogDialog.open}
        onOpenChange={(open) => setCatalogDialog({ open, item: open ? catalogDialog.item : null, type: catalogDialog.type })}
        item={catalogDialog.item}
        type={catalogDialog.type}
        typeLabel={TABS.find((t) => t.key === catalogDialog.type)?.label ?? ""}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Supprimer ${confirmDelete?.label} ?`}
        description="Cette action est irréversible."
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

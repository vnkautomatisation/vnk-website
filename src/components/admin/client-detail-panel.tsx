"use client";
// Client Detail Panel — slide-out right
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/admin/status-badge";
import { EditModal } from "@/components/admin/edit-modal";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { SignatureDialog } from "@/components/signature/signature-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirm } from "@/hooks/use-confirm";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useGooglePlaces, parseAddressComponents } from "@/hooks/use-google-places";
import { initials, formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Plus,
  MessageSquare,
  Briefcase,
  Archive,
  FileText,
  Receipt,
  FileSignature,
  MoreHorizontal,
  CreditCard,
  CheckCircle2,
  PenTool,
  Send,
  ExternalLink,
  Download,
  Pencil,
  Calendar,
  Globe,
  Clock,
  DollarSign,
  RotateCcw,
  AlertCircle,
  ShieldCheck,
  Users,
  Activity,
} from "lucide-react";

type ClientFull = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  sector: string | null;
  technologies: string | null;
  internalNotes: string | null;
  createdAt: Date;
  lastLogin: Date | null;
  // Identite etendue
  position?: string | null;
  birthdate?: Date | null;
  locale?: string | null;
  timezone?: string | null;
  mobilePhone?: string | null;
  workPhone?: string | null;
  billingAddress?: Record<string, string> | null;
  shippingAddress?: Record<string, string> | null;
  // Business
  taxNumberTps?: string | null;
  taxNumberTvq?: string | null;
  taxExempt?: boolean;
  industry?: string | null;
  businessSize?: string | null;
  employeeCount?: number | null;
  annualRevenue?: string | null;
  // Acquisition
  leadSource?: string | null;
  // Finance
  creditTerms?: string | null;
  discountTier?: string | null;
  currencyPreference?: string | null;
  preferredPaymentMethod?: string | null;
  totalSpentTtc?: any;
  openBalanceTtc?: any;
  // Compliance
  termsAcceptedVersion?: string | null;
  termsAcceptedAt?: Date | null;
  termsAcceptedIp?: string | null;
  privacyAcceptedAt?: Date | null;
  marketingConsent?: boolean;
  marketingConsentAt?: Date | null;
  identityVerifiedAt?: Date | null;
  identityVerifiedBy?: string | null;
  // Status
  isActive?: boolean;
  archived?: boolean;
  lastSeenAt?: Date | null;
  // Relations
  mandates: Array<{ id: number; title: string; status: string; progress: number }>;
  quotes: Array<{ id: number; quoteNumber: string; title: string; status: string; amountTtc: any; expiryDate: Date | null }>;
  invoices: Array<{ id: number; invoiceNumber: string; status: string; amountTtc: any; dueDate: Date | null }>;
  contracts: Array<{
    id: number;
    contractNumber: string;
    title: string;
    status: string;
    amountTtc: any;
    adminSignatureData: string | null;
    clientSignatureData: string | null;
    signedAt: Date | string | null;
  }>;
  payments?: Array<{ id: number; amount: any; status: string; paymentMethod: string | null; paidAt: Date | null; createdAt: Date; stripePaymentIntentId: string | null; invoiceId: number | null }>;
  refunds?: Array<{ id: number; amount: any; status: string; reason: string; processedAt: Date | null; createdAt: Date; stripeRefundId: string | null; invoiceId: number | null }>;
  disputes?: Array<{ id: number; title: string; status: string; type: string; priority: string; amountDisputed: any; openedAt: Date; resolvedAt: Date | null }>;
  documents?: Array<{ id: number; title: string; fileType: string | null; fileSize: number | null; category: string | null; isRead: boolean; createdAt: Date }>;
  teamMembers?: Array<{ id: number; email: string; fullName: string; role: string; invitedAt: Date; acceptedAt: Date | null; lastLogin: Date | null }>;
  _count?: { messages: number; appointments: number };
};

export function ClientDetailPanel({
  clientId,
  open,
  onOpenChange,
  initialTab,
}: {
  clientId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "info" | "mandates" | "quotes" | "invoices" | "contracts";
}) {
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [client, setClient] = useState<ClientFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? "info");

  // Synchronise l'onglet quand on (re)ouvre le panel sur un autre client/section
  useEffect(() => {
    if (open) setActiveTab(initialTab ?? "info");
  }, [open, clientId, initialTab]);
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    title: string;
    documentNumber?: string;
    downloadName?: string;
    entityType?: "quote" | "invoice" | "contract";
    entityId?: number;
    status?: string;
    isAdminSigned?: boolean;
  } | null>(null);

  // Signature dialog (canvas pro VNK, partage avec portail client)
  const [signingContract, setSigningContract] = useState<{ id: number; number: string; title: string; amount: number | null } | null>(null);

  // Edition complete du client
  const [editOpen, setEditOpen] = useState(false);
  const [edFullName, setEdFullName] = useState("");
  const [edPhone, setEdPhone] = useState("");
  const [edCompany, setEdCompany] = useState("");
  const [edSector, setEdSector] = useState("");
  const [edAddress, setEdAddress] = useState("");
  const [edCity, setEdCity] = useState("");
  const [edProvince, setEdProvince] = useState("");
  const [edPostal, setEdPostal] = useState("");
  const [edCountry, setEdCountry] = useState("CA");
  const [edTech, setEdTech] = useState("");
  const [edNotes, setEdNotes] = useState("");

  const openEdit = () => {
    if (!client) return;
    setEdFullName(client.fullName);
    setEdPhone(client.phone ?? "");
    setEdCompany(client.companyName ?? "");
    setEdSector(client.sector ?? "");
    setEdAddress(client.address ?? "");
    setEdCity(client.city ?? "");
    setEdProvince(client.province ?? "QC");
    setEdPostal(client.postalCode ?? "");
    setEdCountry(client.country ?? "CA");
    setEdTech(client.technologies ?? "");
    setEdNotes(client.internalNotes ?? "");
    setEditOpen(true);
  };

  const handleSaveClient = async (): Promise<{ success: boolean; error?: string }> => {
    if (!client || !edFullName.trim()) return { success: false, error: "Nom requis" };
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: edFullName.trim(),
          phone: edPhone.trim() || null,
          companyName: edCompany.trim() || null,
          sector: edSector.trim() || null,
          address: edAddress.trim() || null,
          city: edCity.trim() || null,
          province: edProvince.trim() || null,
          postalCode: edPostal.trim() || null,
          country: edCountry.trim() || "CA",
          technologies: edTech.trim() || null,
          internalNotes: edNotes.trim(),
        }),
      });
      if (res.ok) { await refresh(); return { success: true }; }
      const d = await res.json();
      return { success: false, error: d.error || "Erreur" };
    } catch { return { success: false, error: "Erreur réseau" }; }
  };

  // Marquer payee avec methode
  const [paidDialog, setPaidDialog] = useState<{ id: number; num: string } | null>(null);
  const [paidMethod, setPaidMethod] = useState<string>("");
  const [paidNote, setPaidNote] = useState("");

  const PAYMENT_METHODS = [
    { value: "interac", label: "Virement Interac" },
    { value: "bank_transfer", label: "Virement bancaire" },
    { value: "card", label: "Carte (Stripe)" },
    { value: "check", label: "Chèque" },
    { value: "cash", label: "Espèces" },
    { value: "other", label: "Autre" },
  ];

  const submitMarkPaid = async () => {
    if (!paidDialog || !paidMethod) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${paidDialog.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: paidMethod }),
      });
      if (res.ok) {
        toast.success(`Facture ${paidDialog.num} marquée payée`);
        setPaidDialog(null);
        setPaidMethod("");
        setPaidNote("");
        await refresh();
      } else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!clientId || !open) return;
    let cancelled = false;
    setLoading(true);
    setClient(null); // Reset pour eviter d'afficher les donnees du client precedent
    fetch(`/api/clients/${clientId}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          // Session admin expiree — redirect vers login
          toast.error("Session expirée, reconnexion requise");
          router.push("/admin/login");
          throw new Error("UNAUTHORIZED");
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.client) {
          toast.error("Client introuvable");
          return;
        }
        setClient(data.client);
      })
      .catch((err) => {
        if (cancelled || err.message === "UNAUTHORIZED") return;
        console.error("Erreur chargement client:", err);
        toast.error("Erreur chargement client");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId, open]);

  const refresh = async () => {
    if (!clientId) return;
    const res = await fetch(`/api/clients/${clientId}`, { cache: "no-store" });
    const data = await res.json();
    setClient(data.client);
    router.refresh();
  };

  const acceptQuote = async (id: number, num: string) => {
    setPdfPreview(null); // ferme PDF pour eviter conflit z-index avec confirm
    const ok = await confirm({
      title: "Accepter ce devis ?",
      description: `Le devis ${num} sera marqué comme accepté et un contrat sera généré automatiquement.`,
      confirmLabel: "Accepter",
      variant: "default",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${id}/accept`, { method: "POST" });
      if (res.ok) { toast.success("Devis accepté"); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  const markPaid = (id: number, num: string) => {
    // Ouvre le dialog de selection de methode (PDF doit etre ferme avant pour eviter z-index)
    setPdfPreview(null);
    setPaidMethod("");
    setPaidNote("");
    setPaidDialog({ id, num });
  };

  const sendToClient = async (entityType: "quote" | "invoice" | "contract", entityNumber: string, entityId: number, title: string) => {
    if (!client) return;
    setPdfPreview(null); // ferme PDF avant confirm pour eviter z-index
    const labelMap = {
      quote: { fr: "devis", url: "devis", category: "devis" },
      invoice: { fr: "facture", url: "factures", category: "factures" },
      contract: { fr: "contrat", url: "contrats", category: "contrats" },
    };
    const meta = labelMap[entityType];
    const ok = await confirm({
      title: `Envoyer au client ?`,
      description: `Le ${meta.fr} ${entityNumber} sera ajouté dans la catégorie "${meta.category}" du portail client + notification + message chat avec lien.`,
      confirmLabel: "Envoyer",
      variant: "default",
    });
    if (!ok) return;
    setBusy(true);
    try {
      // 1) Creer une entree Document dans la bonne categorie pour le portail client
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          title: `${title} (${entityNumber})`,
          description: `${meta.fr.charAt(0).toUpperCase() + meta.fr.slice(1)} ${entityNumber}`,
          fileType: "pdf",
          fileUrl: `/api/${entityType === "quote" ? "quotes" : entityType === "invoice" ? "invoices" : "contracts"}/${entityId}/pdf`,
          category: meta.category,
        }),
      });
      if (!docRes.ok) {
        const d = await docRes.json();
        toast.error(d.error || "Erreur création document");
        return;
      }
      // 2) Message chat pour notifier
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          content: `Nouveau ${meta.fr} disponible : ${entityNumber}. Consultez-le dans votre portail (/portail/${meta.url}).`,
          channel: "chat",
          attachmentData: { entityType, entityId, entityNumber },
        }),
      });
      toast.success(`Document ajouté au portail + notification envoyée à ${client.fullName}`);
      await refresh();
    } finally { setBusy(false); }
  };

  const signContract = (id: number) => {
    if (!client) return;
    const ct = client.contracts.find((c) => c.id === id);
    if (!ct) return;
    setPdfPreview(null); // ferme PDF pour eviter conflit z-index
    setSigningContract({
      id: ct.id,
      number: ct.contractNumber,
      title: ct.title || `Contrat ${ct.contractNumber}`,
      amount: ct.amountTtc != null ? Number(ct.amountTtc) : null,
    });
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-xl p-0 overflow-hidden flex flex-col [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/15 [&>button]:rounded-md [&>button]:p-1.5 [&>button]:top-5 [&>button]:right-5 [&>button]:transition-colors"
        onPointerDownOutside={(e) => {
          // Empeche la fermeture du panel quand on clique sur les modales empilees
          if (pdfPreview || paidDialog || signingContract) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (pdfPreview || paidDialog || signingContract) e.preventDefault();
        }}
      >
        {/* Title/Description toujours presents pour a11y Radix — le titre visible vit dans SheetHeader */}
        <SheetTitle className="sr-only">
          {client?.fullName ?? "Détail client"}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {client ? `Informations détaillées pour ${client.fullName}` : "Chargement..."}
        </SheetDescription>

        {loading || !client ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Chargement…
          </div>
        ) : (
          <>
            {/* Header gradient navy */}
            <SheetHeader className="bg-gradient-to-br from-[#0F2D52] to-[#1e4a7e] text-white p-6 space-y-4 shrink-0">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-white/20">
                  <AvatarFallback className="bg-white/10 text-white text-lg font-bold backdrop-blur">
                    {initials(client.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">{client.fullName}</h2>
                  <p className="text-sm text-white/70">
                    {client.companyName}
                    {client.city && ` · ${client.city}`}
                  </p>
                </div>
              </div>

              {/* Quick stats colorees */}
              <div className="grid grid-cols-4 gap-2">
                <StatBox icon={Briefcase} label="Mandats" value={client.mandates.length} />
                <StatBox icon={FileText} label="Devis" value={client.quotes.length} />
                <StatBox icon={Receipt} label="Factures" value={client.invoices.length} />
                <StatBox icon={FileSignature} label="Contrats" value={client.contracts.length} />
              </div>

              {/* Sticky actions — toujours visibles */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Link href={`/admin/mandates?newFor=${client.id}`}>
                    <Plus className="h-3 w-3" />Mandat
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Link href={`/admin/quotes?newFor=${client.id}`}>
                    <Plus className="h-3 w-3" />Devis
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Link href={`/admin/invoices?newFor=${client.id}`}>
                    <Plus className="h-3 w-3" />Facture
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Link href={`/admin/messages?clientId=${client.id}`}>
                    <MessageSquare className="h-3 w-3" />Message
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = `/api/clients/${client.id}/export-zip`;
                    a.click();
                    toast.success("Préparation du dossier ZIP…");
                  }}
                  title="Télécharger l'intégralité du dossier client"
                >
                  <Archive className="h-3 w-3" />Dossier ZIP
                </Button>
              </div>
            </SheetHeader>

            {/* Tabs scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <ClientTabs
                client={client}
                busy={busy}
                router={router}
                openEdit={openEdit}
                openEntity={openEntity}
                acceptQuote={acceptQuote}
                markPaid={markPaid}
                setPdfPreview={setPdfPreview}
              />
            </div>
          </>
        )}
        {ConfirmModal}
      </SheetContent>
    </Sheet>

    {/* Edit complet du client — Dialog VNK navy */}
    {client && (
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100 [&>button]:hover:bg-white/15 [&>button]:rounded-md [&>button]:p-1.5 [&>button]:right-5 [&>button]:top-5">
          {/* Header navy avec avatar + info */}
          <DialogHeader className="bg-gradient-to-br from-[#0F2D52] to-[#1e4a7e] text-white p-6 space-y-2 shrink-0">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 ring-2 ring-white/20">
                <AvatarFallback className="bg-white/10 text-white font-bold backdrop-blur">
                  {initials(client.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="text-white text-lg">Modifier le client</DialogTitle>
                <DialogDescription className="text-white/70 truncate">{client.email}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body — sections groupees */}
          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
            {/* Section: Identite */}
            <FormSection title="Identité" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom complet *</Label>
                <Input value={edFullName} onChange={(e) => setEdFullName(e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Téléphone</Label>
                  <Input value={edPhone} onChange={(e) => setEdPhone(e.target.value)} placeholder="418-000-0000" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Entreprise</Label>
                  <Input value={edCompany} onChange={(e) => setEdCompany(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Secteur</Label>
                <Input value={edSector} onChange={(e) => setEdSector(e.target.value)} placeholder="Manufacturier, agroalimentaire, énergie..." />
              </div>
            </FormSection>

            {/* Section: Adresse — adaptative selon pays */}
            <FormSection title="Adresse" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}>
              <AddressFields
                country={edCountry} onCountryChange={(c) => { setEdCountry(c); /* reset province si pays sans province */ const meta = COUNTRY_FORMATS[c]; if (!meta?.hasRegion) setEdProvince(""); }}
                address={edAddress} onAddressChange={setEdAddress}
                city={edCity} onCityChange={setEdCity}
                province={edProvince} onProvinceChange={setEdProvince}
                postal={edPostal} onPostalChange={setEdPostal}
              />
            </FormSection>

            {/* Section: Technique & notes */}
            <FormSection title="Technique & notes" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Technologies</Label>
                <TechPicker value={edTech} onChange={setEdTech} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Notes internes
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-700 font-semibold normal-case tracking-normal">Admin uniquement</span>
                </Label>
                <Textarea value={edNotes} onChange={(e) => setEdNotes(e.target.value)} rows={3} placeholder="Notes privées, jamais visibles par le client..." className="bg-amber-50/30" />
              </div>
            </FormSection>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 bg-muted/30 border-t">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await handleSaveClient();
                  if (result.success) {
                    toast.success("Client mis à jour");
                    setEditOpen(false);
                  } else {
                    toast.error(result.error || "Erreur");
                  }
                } finally { setBusy(false); }
              }}
              disabled={busy || !edFullName.trim()}
            >
              {busy ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Dialog Marquer payée — choix méthode */}
    <Dialog
      open={!!paidDialog}
      onOpenChange={(o) => { if (!o) { setPaidDialog(null); setPaidMethod(""); setPaidNote(""); } }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marquer comme payée</DialogTitle>
          <DialogDescription>
            Facture {paidDialog?.num} — sélectionnez la méthode de paiement utilisée.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Methode</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaidMethod(m.value)}
                  className={`px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    paidMethod === m.value
                      ? "border-[#0F2D52] bg-[#0F2D52]/5 text-[#0F2D52] font-medium"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paid-note" className="text-xs uppercase tracking-wider text-muted-foreground">Note (optionnel)</Label>
            <Textarea
              id="paid-note"
              value={paidNote}
              onChange={(e) => setPaidNote(e.target.value)}
              rows={2}
              placeholder="N° de transaction, référence..."
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { setPaidDialog(null); setPaidMethod(""); setPaidNote(""); }} disabled={busy}>
            Annuler
          </Button>
          <Button
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={submitMarkPaid}
            disabled={!paidMethod || busy}
          >
            <CreditCard className="h-4 w-4 mr-1.5" />
            {busy ? "Enregistrement..." : "Confirmer le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {pdfPreview && (
      <PdfViewerModal
        open={true}
        onClose={() => setPdfPreview(null)}
        pdfUrl={pdfPreview.url}
        title={pdfPreview.title}
        documentNumber={pdfPreview.documentNumber}
        downloadName={pdfPreview.downloadName}
        actions={(() => {
          const t = pdfPreview.entityType;
          const id = pdfPreview.entityId;
          const num = pdfPreview.documentNumber ?? "";
          const status = pdfPreview.status;
          if (!t || !id) return undefined;

          const buttons: React.ReactNode[] = [];

          // Action principale selon type+statut
          if (t === "quote" && status === "pending") {
            buttons.push(
              <Button key="accept" size="sm" variant="outline" disabled={busy}
                className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                onClick={async () => { await acceptQuote(id, num); }}>
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Marquer accepté
              </Button>
            );
          }
          if (t === "invoice" && (status === "unpaid" || status === "overdue")) {
            buttons.push(
              <Button key="paid" size="sm" variant="outline" disabled={busy}
                className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                onClick={async () => { await markPaid(id, num); }}>
                <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Marquer payée
              </Button>
            );
          }
          if (t === "contract" && status === "pending" && !pdfPreview.isAdminSigned) {
            buttons.push(
              <Button key="sign" size="sm" variant="outline" disabled={busy}
                className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                onClick={async () => { await signContract(id); }}>
                <PenTool className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Signer admin
              </Button>
            );
          }

          // Envoyer au client (sauf si finalise)
          const finalStatus = (t === "quote" && status === "accepted") ||
                              (t === "invoice" && status === "paid") ||
                              (t === "contract" && status === "signed");
          if (!finalStatus) {
            buttons.push(
              <Button key="send" size="sm" variant="outline" disabled={busy}
                className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                onClick={async () => { await sendToClient(t, num, id, pdfPreview.title); }}>
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Envoyer au client
              </Button>
            );
          }

          // Telecharger toujours en derniere action
          buttons.push(
            <Button key="dl" size="sm"
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
              onClick={() => {
                const a = document.createElement("a");
                a.href = pdfPreview.url;
                a.download = `${pdfPreview.downloadName ?? num ?? "document"}.pdf`;
                a.target = "_blank";
                a.click();
              }}>
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Télécharger
            </Button>
          );

          return <>{buttons}</>;
        })()}
      />
    )}

    {signingContract && (
      <SignatureDialog
        contractId={signingContract.id}
        contractNumber={signingContract.number}
        contractTitle={signingContract.title}
        contractAmount={signingContract.amount ?? undefined}
        open={true}
        onOpenChange={(o) => {
          if (!o) {
            setSigningContract(null);
            refresh();
          }
        }}
      />
    )}
    </>
  );
}

// ── Catalogue de technologies (aligne avec services VNK) ─────────
const TECH_CATALOG: { category: string; items: string[] }[] = [
  {
    category: "PLC / Automates",
    items: [
      "Siemens S7-1500", "Siemens S7-1200", "Siemens S7-300/400",
      "Rockwell ControlLogix", "Rockwell CompactLogix", "Allen-Bradley MicroLogix",
      "Schneider Modicon M580", "Schneider Modicon M340",
      "B&R X20", "Omron", "Mitsubishi", "Beckhoff TwinCAT",
    ],
  },
  {
    category: "HMI / SCADA",
    items: ["TIA Portal / WinCC", "FactoryTalk View", "EcoStruxure / Vijeo", "MappView (B&R)", "AVEVA / Wonderware", "Ignition"],
  },
  {
    category: "Robotique",
    items: ["FANUC", "ABB", "KUKA", "Yaskawa"],
  },
  {
    category: "Réseaux & Protocoles",
    items: ["Profinet", "EtherNet/IP", "Modbus TCP", "OPC UA", "Profibus"],
  },
  {
    category: "Accès distant",
    items: ["Secomea SiteManager", "TeamViewer", "AnyDesk", "VPN"],
  },
];

function TechPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");

  const selected = value.split(",").map((s) => s.trim()).filter(Boolean);
  const allCatalog = new Set(TECH_CATALOG.flatMap((c) => c.items));
  const customItems = selected.filter((s) => !allCatalog.has(s));

  const toggle = (item: string) => {
    const set = new Set(selected);
    if (set.has(item)) set.delete(item); else set.add(item);
    onChange(Array.from(set).join(", "));
  };

  const remove = (item: string) => {
    onChange(selected.filter((s) => s !== item).join(", "));
  };

  const addCustom = () => {
    const v = customInput.trim();
    if (!v || selected.includes(v)) { setCustomInput(""); return; }
    onChange([...selected, v].join(", "));
    setCustomInput("");
  };

  // Filtrage selon la recherche
  const filteredCatalog = TECH_CATALOG.map((cat) => ({
    ...cat,
    items: cat.items.filter((i) => i.toLowerCase().includes(search.toLowerCase())),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-2">
      {/* Chips selectionnes + bouton ajouter */}
      <div className="flex flex-wrap gap-1.5 min-h-[34px] items-center p-2 rounded-md border bg-background">
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground italic">Aucune technologie sélectionnée</span>
        )}
        {selected.map((item) => {
          const isCustom = !allCatalog.has(item);
          return (
            <span
              key={item}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${
                isCustom
                  ? "bg-amber-50 border border-amber-300 text-amber-900"
                  : "bg-[#0F2D52] text-white"
              }`}
            >
              {item}
              <button
                type="button"
                onClick={() => remove(item)}
                className={`rounded-full h-3.5 w-3.5 flex items-center justify-center ${isCustom ? "hover:bg-amber-200" : "hover:bg-white/20"}`}
                aria-label={`Retirer ${item}`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </span>
          );
        })}

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Ajouter
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[320px] max-w-[calc(100vw-2rem)] p-0 flex flex-col overflow-hidden"
            style={{ maxHeight: "min(80vh, var(--radix-popover-content-available-height, 80vh))" }}
            align="start"
            collisionPadding={8}
          >
            <div className="p-2 border-b shrink-0">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-2">
              {filteredCatalog.length === 0 && search && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun resultat pour &quot;{search}&quot;</p>
              )}
              {filteredCatalog.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">{cat.category}</p>
                  <div className="flex flex-wrap gap-1">
                    {cat.items.map((item) => {
                      const isOn = selected.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggle(item)}
                          className={`px-2 py-0.5 rounded-full border text-[10px] transition-colors ${
                            isOn
                              ? "border-[#0F2D52] bg-[#0F2D52] text-white"
                              : "border-input hover:bg-muted"
                          }`}
                        >
                          {isOn && (
                            <svg className="inline -ml-0.5 mr-1" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {/* Custom add */}
            <div className="p-2 border-t bg-muted/30 shrink-0">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">Custom</p>
              <div className="flex gap-1.5">
                <Input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                  placeholder="Techno spécifique..."
                  className="h-8 text-xs flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!customInput.trim()} className="h-8 px-2 text-xs">
                  Ajouter
                </Button>
              </div>
              {customItems.length > 0 && (
                <p className="text-[9px] text-muted-foreground mt-1.5">{customItems.length} custom: {customItems.join(", ")}</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ── Formats d'adresses par pays ─────────────────────────────────
type CountryFormat = {
  name: string;
  hasRegion: boolean;
  regionLabel?: string;
  regionOptions?: { code: string; name: string }[];
  postalLabel: string;
  postalPlaceholder: string;
  cityLabel?: string;
  /** Ordre d'affichage : 'city-region-postal' (CA/US/MX) | 'postal-city' (FR/BE/DE) | 'city-postal' (UK) */
  layout: "city-region-postal" | "postal-city" | "city-postal";
};

const CA_PROVINCES = [
  { code: "QC", name: "Québec" }, { code: "ON", name: "Ontario" }, { code: "BC", name: "Colombie-Britannique" },
  { code: "AB", name: "Alberta" }, { code: "MB", name: "Manitoba" }, { code: "SK", name: "Saskatchewan" },
  { code: "NS", name: "Nouvelle-Écosse" }, { code: "NB", name: "Nouveau-Brunswick" }, { code: "NL", name: "Terre-Neuve-et-Labrador" },
  { code: "PE", name: "Île-du-Prince-Édouard" }, { code: "YT", name: "Yukon" }, { code: "NT", name: "Territoires du Nord-Ouest" }, { code: "NU", name: "Nunavut" },
];

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" }, { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

const MX_ESTADOS = [
  { code: "AGU", name: "Aguascalientes" }, { code: "BCN", name: "Baja California" }, { code: "BCS", name: "Baja California Sur" },
  { code: "CAM", name: "Campeche" }, { code: "CHP", name: "Chiapas" }, { code: "CHH", name: "Chihuahua" }, { code: "CMX", name: "Ciudad de Mexico" },
  { code: "COA", name: "Coahuila" }, { code: "COL", name: "Colima" }, { code: "DUR", name: "Durango" }, { code: "GUA", name: "Guanajuato" },
  { code: "GRO", name: "Guerrero" }, { code: "HID", name: "Hidalgo" }, { code: "JAL", name: "Jalisco" }, { code: "MEX", name: "Estado de Mexico" },
  { code: "MIC", name: "Michoacan" }, { code: "MOR", name: "Morelos" }, { code: "NAY", name: "Nayarit" }, { code: "NLE", name: "Nuevo Leon" },
  { code: "OAX", name: "Oaxaca" }, { code: "PUE", name: "Puebla" }, { code: "QUE", name: "Queretaro" }, { code: "ROO", name: "Quintana Roo" },
  { code: "SLP", name: "San Luis Potosi" }, { code: "SIN", name: "Sinaloa" }, { code: "SON", name: "Sonora" }, { code: "TAB", name: "Tabasco" },
  { code: "TAM", name: "Tamaulipas" }, { code: "TLA", name: "Tlaxcala" }, { code: "VER", name: "Veracruz" }, { code: "YUC", name: "Yucatan" }, { code: "ZAC", name: "Zacatecas" },
];

const BR_ESTADOS = [
  { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" }, { code: "AP", name: "Amapa" }, { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceara" }, { code: "DF", name: "Distrito Federal" }, { code: "ES", name: "Espirito Santo" },
  { code: "GO", name: "Goias" }, { code: "MA", name: "Maranhao" }, { code: "MT", name: "Mato Grosso" }, { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" }, { code: "PA", name: "Para" }, { code: "PB", name: "Paraiba" }, { code: "PR", name: "Parana" },
  { code: "PE", name: "Pernambuco" }, { code: "PI", name: "Piaui" }, { code: "RJ", name: "Rio de Janeiro" }, { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" }, { code: "RO", name: "Rondonia" }, { code: "RR", name: "Roraima" }, { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "Sao Paulo" }, { code: "SE", name: "Sergipe" }, { code: "TO", name: "Tocantins" },
];

const CH_CANTONS = [
  { code: "ZH", name: "Zurich" }, { code: "BE", name: "Berne" }, { code: "LU", name: "Lucerne" }, { code: "UR", name: "Uri" },
  { code: "SZ", name: "Schwytz" }, { code: "OW", name: "Obwald" }, { code: "NW", name: "Nidwald" }, { code: "GL", name: "Glaris" },
  { code: "ZG", name: "Zoug" }, { code: "FR", name: "Fribourg" }, { code: "SO", name: "Soleure" }, { code: "BS", name: "Bale-Ville" },
  { code: "BL", name: "Bale-Campagne" }, { code: "SH", name: "Schaffhouse" }, { code: "AR", name: "Appenzell Rhodes-Exterieures" },
  { code: "AI", name: "Appenzell Rhodes-Interieures" }, { code: "SG", name: "Saint-Gall" }, { code: "GR", name: "Grisons" },
  { code: "AG", name: "Argovie" }, { code: "TG", name: "Thurgovie" }, { code: "TI", name: "Tessin" }, { code: "VD", name: "Vaud" },
  { code: "VS", name: "Valais" }, { code: "NE", name: "Neuchatel" }, { code: "GE", name: "Geneve" }, { code: "JU", name: "Jura" },
];

const IT_REGIONI = [
  { code: "ABR", name: "Abruzzes" }, { code: "BAS", name: "Basilicate" }, { code: "CAL", name: "Calabre" }, { code: "CAM", name: "Campanie" },
  { code: "EMR", name: "Emilie-Romagne" }, { code: "FVG", name: "Frioul-Venetie julienne" }, { code: "LAZ", name: "Latium" }, { code: "LIG", name: "Ligurie" },
  { code: "LOM", name: "Lombardie" }, { code: "MAR", name: "Marches" }, { code: "MOL", name: "Molise" }, { code: "PIE", name: "Piemont" },
  { code: "PUG", name: "Pouilles" }, { code: "SAR", name: "Sardaigne" }, { code: "SIC", name: "Sicile" }, { code: "TOS", name: "Toscane" },
  { code: "TAA", name: "Trentin-Haut-Adige" }, { code: "UMB", name: "Ombrie" }, { code: "VDA", name: "Vallee d'Aoste" }, { code: "VEN", name: "Venetie" },
];

const ES_COMUNIDADES = [
  { code: "AN", name: "Andalousie" }, { code: "AR", name: "Aragon" }, { code: "AS", name: "Asturies" }, { code: "IB", name: "Iles Baleares" },
  { code: "PV", name: "Pays basque" }, { code: "CN", name: "Iles Canaries" }, { code: "CB", name: "Cantabrie" }, { code: "CL", name: "Castille-et-Leon" },
  { code: "CM", name: "Castille-La Manche" }, { code: "CT", name: "Catalogne" }, { code: "EX", name: "Estremadure" }, { code: "GA", name: "Galice" },
  { code: "RI", name: "La Rioja" }, { code: "MD", name: "Madrid" }, { code: "MC", name: "Murcie" }, { code: "NC", name: "Navarre" }, { code: "VC", name: "Valence" },
  { code: "CE", name: "Ceuta" }, { code: "ML", name: "Melilla" },
];

const COUNTRY_FORMATS: Record<string, CountryFormat> = {
  CA: { name: "Canada", hasRegion: true, regionLabel: "Province", regionOptions: CA_PROVINCES, postalLabel: "Code postal", postalPlaceholder: "G6V 3P8", layout: "city-region-postal" },
  US: { name: "Etats-Unis", hasRegion: true, regionLabel: "Etat", regionOptions: US_STATES, postalLabel: "ZIP code", postalPlaceholder: "12345", layout: "city-region-postal" },
  FR: { name: "France", hasRegion: false, postalLabel: "Code postal", postalPlaceholder: "75001", layout: "postal-city" },
  BE: { name: "Belgique", hasRegion: false, postalLabel: "Code postal", postalPlaceholder: "1000", layout: "postal-city" },
  CH: { name: "Suisse", hasRegion: true, regionLabel: "Canton (optionnel)", regionOptions: CH_CANTONS, postalLabel: "NPA", postalPlaceholder: "1200", layout: "postal-city" },
  LU: { name: "Luxembourg", hasRegion: false, postalLabel: "Code postal", postalPlaceholder: "L-1234", layout: "postal-city" },
  GB: { name: "Royaume-Uni", hasRegion: true, regionLabel: "County (optionnel)", postalLabel: "Postcode", postalPlaceholder: "SW1A 1AA", layout: "city-postal" },
  DE: { name: "Allemagne", hasRegion: false, postalLabel: "PLZ", postalPlaceholder: "10115", layout: "postal-city" },
  ES: { name: "Espagne", hasRegion: true, regionLabel: "Communaute autonome (optionnel)", regionOptions: ES_COMUNIDADES, postalLabel: "Codigo postal", postalPlaceholder: "28001", layout: "postal-city" },
  IT: { name: "Italie", hasRegion: true, regionLabel: "Regione", regionOptions: IT_REGIONI, postalLabel: "CAP", postalPlaceholder: "00100", layout: "postal-city" },
  MX: { name: "Mexique", hasRegion: true, regionLabel: "Estado", regionOptions: MX_ESTADOS, postalLabel: "Codigo postal", postalPlaceholder: "01000", layout: "city-region-postal" },
  BR: { name: "Bresil", hasRegion: true, regionLabel: "Estado", regionOptions: BR_ESTADOS, postalLabel: "CEP", postalPlaceholder: "01310-100", layout: "city-region-postal" },
  OTHER: { name: "Autre", hasRegion: true, regionLabel: "Region (optionnel)", postalLabel: "Code postal", postalPlaceholder: "", layout: "city-region-postal" },
};

function AddressFields({
  country, onCountryChange,
  address, onAddressChange,
  city, onCityChange,
  province, onProvinceChange,
  postal, onPostalChange,
}: {
  country: string; onCountryChange: (v: string) => void;
  address: string; onAddressChange: (v: string) => void;
  city: string; onCityChange: (v: string) => void;
  province: string; onProvinceChange: (v: string) => void;
  postal: string; onPostalChange: (v: string) => void;
}) {
  const meta = COUNTRY_FORMATS[country] ?? COUNTRY_FORMATS.OTHER;
  const places = useGooglePlaces();
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Brancher Google Autocomplete sur l'input "Rue" quand l'API est chargee
  useEffect(() => {
    if (!places.loaded || !addressInputRef.current || !window.google?.maps?.places) return;
    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      types: ["address"],
      fields: ["address_components", "formatted_address"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.address_components) return;
      const parsed = parseAddressComponents(place.address_components);
      onAddressChange(parsed.street);
      onCityChange(parsed.city);
      onProvinceChange(parsed.province);
      onPostalChange(parsed.postal);
      if (parsed.country && COUNTRY_FORMATS[parsed.country]) {
        onCountryChange(parsed.country);
      }
    });
    return () => { listener.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.loaded]);
  const cityField = (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{meta.cityLabel ?? "Ville"}</Label>
      <Input value={city} onChange={(e) => onCityChange(e.target.value)} />
    </div>
  );
  const postalField = (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{meta.postalLabel}</Label>
      <Input value={postal} onChange={(e) => onPostalChange(e.target.value)} placeholder={meta.postalPlaceholder} />
    </div>
  );
  const regionField = meta.hasRegion ? (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{meta.regionLabel}</Label>
      {meta.regionOptions && meta.regionOptions.length > 0 ? (
        <Select value={province} onValueChange={onProvinceChange}>
          <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
          <SelectContent>
            {meta.regionOptions.map((p) => (
              <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input value={province} onChange={(e) => onProvinceChange(e.target.value)} />
      )}
    </div>
  ) : null;

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pays</Label>
        <Select value={country} onValueChange={onCountryChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(COUNTRY_FORMATS).map(([code, c]) => (
              <SelectItem key={code} value={code}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          Rue / Adresse
          {places.loaded && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-blue-100 text-blue-700 font-semibold normal-case tracking-normal">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Suggestions Google
            </span>
          )}
        </Label>
        <Input
          ref={addressInputRef}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder={places.loaded ? "Commence a taper, suggestions auto..." : "123 rue Industrielle"}
          autoComplete="off"
        />
      </div>
      {meta.layout === "postal-city" && (
        // FR/BE/DE/CH/etc — code postal puis ville sur meme ligne, region en dessous si applicable
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">{postalField}</div>
            <div className="col-span-2">{cityField}</div>
          </div>
          {regionField && <div>{regionField}</div>}
        </>
      )}
      {meta.layout === "city-postal" && (
        // UK — ville puis postcode, county en dessous
        <>
          <div className="grid grid-cols-2 gap-3">
            {cityField}
            {postalField}
          </div>
          {regionField && <div>{regionField}</div>}
        </>
      )}
      {meta.layout === "city-region-postal" && (
        // CA/US/MX/BR — ville, region, code postal sur 3 colonnes
        <div className="grid grid-cols-3 gap-3">
          {cityField}
          {regionField ?? <div />}
          {postalField}
        </div>
      )}
    </>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b">
        <span className="h-7 w-7 rounded-lg bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center">
          {icon}
        </span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F2D52]">{title}</h3>
      </div>
      <div className="space-y-3 pt-1">
        {children}
      </div>
    </div>
  );
}

// ─── ClientTabs : 9 onglets thematiques ──────────────────
type AuditEvent = {
  id: string; source: string; type: string; label: string;
  ipAddress: string | null; createdAt: string;
};

function ClientTabs({
  client, busy, router, openEdit, openEntity, acceptQuote, markPaid, setPdfPreview,
}: {
  client: ClientFull;
  busy: boolean;
  router: ReturnType<typeof useRouter>;
  openEdit: () => void;
  openEntity: (type: "client" | "mandate" | "quote" | "invoice" | "contract" | "appointment", id: number) => void;
  acceptQuote: (id: number, num: string) => void;
  markPaid: (id: number, num: string) => void;
  setPdfPreview: (p: { url: string; title: string; documentNumber?: string; downloadName?: string; entityType?: "quote" | "invoice" | "contract"; entityId?: number; status?: string; isAdminSigned?: boolean }) => void;
}) {
  const [tab, setTab] = useState("identite");
  const [activity, setActivity] = useState<AuditEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Fetch activity events lazily quand on ouvre l'onglet
  useEffect(() => {
    if (tab !== "activite") return;
    if (activity.length > 0) return;
    setActivityLoading(true);
    fetch(`/api/audit-trail?clientId=${client.id}&limit=100`)
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((d) => setActivity(d.events ?? []))
      .finally(() => setActivityLoading(false));
  }, [tab, client.id, activity.length]);

  const totalSpent = Number(client.totalSpentTtc ?? 0);
  const openBalance = Number(client.openBalanceTtc ?? 0);
  const totalInvoicesAmount = client.invoices.reduce((s, i) => s + Number(i.amountTtc ?? 0), 0);
  const unpaidAmount = client.invoices
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amountTtc ?? 0), 0);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="grid w-full grid-cols-3 sm:grid-cols-9 h-auto gap-1 bg-muted p-1">
        <TabsTrigger value="identite" className="text-[11px] px-2 py-1.5">Identité</TabsTrigger>
        <TabsTrigger value="contact" className="text-[11px] px-2 py-1.5">Contact</TabsTrigger>
        <TabsTrigger value="business" className="text-[11px] px-2 py-1.5">Business</TabsTrigger>
        <TabsTrigger value="finance" className="text-[11px] px-2 py-1.5">Finance</TabsTrigger>
        <TabsTrigger value="activite" className="text-[11px] px-2 py-1.5">Activité</TabsTrigger>
        <TabsTrigger value="documents" className="text-[11px] px-2 py-1.5">Documents</TabsTrigger>
        <TabsTrigger value="comm" className="text-[11px] px-2 py-1.5">Comm.</TabsTrigger>
        <TabsTrigger value="legal" className="text-[11px] px-2 py-1.5">Légal</TabsTrigger>
        <TabsTrigger value="equipe" className="text-[11px] px-2 py-1.5">Équipe</TabsTrigger>
      </TabsList>

      {/* 1. Identité */}
      <TabsContent value="identite" className="space-y-3 mt-4">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Modifier
          </Button>
        </div>
        <InfoRow icon={Mail} label="Courriel" value={client.email} />
        <InfoRow icon={Briefcase} label="Poste" value={client.position ?? "—"} />
        <InfoRow icon={Calendar} label="Date de naissance" value={client.birthdate ? formatDate(new Date(client.birthdate)) : "—"} />
        <InfoRow icon={Globe} label="Langue" value={client.locale ?? "fr-CA"} />
        <InfoRow icon={Clock} label="Fuseau horaire" value={client.timezone ?? "America/Montreal"} />
        <InfoRow icon={Calendar} label="Compte créé" value={formatDate(new Date(client.createdAt))} />
        <InfoRow icon={Clock} label="Dernière connexion" value={client.lastLogin ? formatDate(new Date(client.lastLogin)) : "Jamais"} />
        {client.internalNotes && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Notes internes (admin)</p>
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs whitespace-pre-wrap">
              {client.internalNotes}
            </div>
          </div>
        )}
      </TabsContent>

      {/* 2. Contact */}
      <TabsContent value="contact" className="space-y-3 mt-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Contacts</p>
        <InfoRow icon={Mail} label="Courriel principal" value={client.email} />
        <InfoRow icon={Phone} label="Téléphone principal" value={client.phone ?? "—"} />
        <InfoRow icon={Phone} label="Mobile" value={client.mobilePhone ?? "—"} />
        <InfoRow icon={Phone} label="Bureau" value={client.workPhone ?? "—"} />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pt-3">Adresse</p>
        <InfoRow
          icon={MapPin}
          label="Adresse"
          value={[client.address, client.city, client.province, client.postalCode, client.country].filter(Boolean).join(", ") || "—"}
        />
        {client.billingAddress && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Adresse facturation</p>
            <pre className="text-xs bg-muted/40 p-2 rounded">{JSON.stringify(client.billingAddress, null, 2)}</pre>
          </div>
        )}
      </TabsContent>

      {/* 3. Business */}
      <TabsContent value="business" className="space-y-3 mt-4">
        <InfoRow icon={Building2} label="Entreprise" value={client.companyName ?? "—"} />
        <InfoRow icon={Briefcase} label="Secteur" value={client.sector ?? client.industry ?? "—"} />
        <InfoRow icon={Users} label="Taille" value={client.businessSize ?? "—"} />
        <InfoRow icon={Users} label="Employés" value={client.employeeCount != null ? String(client.employeeCount) : "—"} />
        <InfoRow icon={DollarSign} label="Revenu annuel" value={client.annualRevenue ?? "—"} />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pt-3">Taxes</p>
        <InfoRow icon={Receipt} label="N° TPS" value={client.taxNumberTps ?? "—"} />
        <InfoRow icon={Receipt} label="N° TVQ" value={client.taxNumberTvq ?? "—"} />
        <InfoRow icon={CheckCircle2} label="Exempt de taxes" value={client.taxExempt ? "Oui" : "Non"} />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pt-3">Acquisition</p>
        <InfoRow icon={Users} label="Source" value={client.leadSource ?? "—"} />
        {client.technologies && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Technologies</p>
            <div className="flex flex-wrap gap-1">
              {client.technologies.split(",").map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{t.trim()}</Badge>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      {/* 4. Finance */}
      <TabsContent value="finance" className="space-y-3 mt-4">
        <div className="grid grid-cols-3 gap-2">
          <FinanceBox label="Total dépensé" value={formatCurrency(totalSpent || totalInvoicesAmount)} accent="text-emerald-600" />
          <FinanceBox label="Solde ouvert" value={formatCurrency(openBalance || unpaidAmount)} accent={openBalance > 0 || unpaidAmount > 0 ? "text-amber-600" : "text-muted-foreground"} />
          <FinanceBox label="LTV" value={formatCurrency(totalSpent || totalInvoicesAmount)} accent="text-[#0F2D52]" />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <InfoRow icon={CreditCard} label="Mode paiement préféré" value={client.preferredPaymentMethod ?? "—"} />
          <InfoRow icon={Calendar} label="Conditions paiement" value={client.creditTerms ?? "net_30"} />
          <InfoRow icon={DollarSign} label="Devise" value={client.currencyPreference ?? "CAD"} />
          <InfoRow icon={Receipt} label="Tier remise" value={client.discountTier ?? "Standard"} />
        </div>

        {client.mandates.length > 0 && (
          <div className="pt-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Mandats ({client.mandates.length})</p>
            {client.mandates.slice(0, 5).map((m) => (
              <button key={m.id} type="button" onClick={() => openEntity("mandate", m.id)}
                className="w-full text-left p-2 rounded-lg border bg-card hover:border-primary mb-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{m.title}</span>
                  <StatusBadge status={m.status} />
                </div>
              </button>
            ))}
          </div>
        )}

        {client.quotes.length > 0 && (
          <div className="pt-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Devis ({client.quotes.length})</p>
            {client.quotes.slice(0, 5).map((q) => (
              <EntityRow key={q.id} ref1={q.quoteNumber} title={q.title}
                amount={Number(q.amountTtc)} status={q.status}
                onClick={() => openEntity("quote", q.id)}
                actions={[
                  ...(q.status === "pending" ? [{ label: "Marquer accepté", icon: <CheckCircle2 className="h-3.5 w-3.5" />, onClick: () => acceptQuote(q.id, q.quoteNumber) }] : []),
                  { label: "Voir PDF", icon: <ExternalLink className="h-3.5 w-3.5" />, onClick: () => setPdfPreview({ url: `/api/quotes/${q.id}/pdf`, title: q.title, documentNumber: q.quoteNumber, downloadName: `devis-${q.quoteNumber}`, entityType: "quote", entityId: q.id, status: q.status }) },
                ]}
                busy={busy} />
            ))}
          </div>
        )}

        {client.invoices.length > 0 && (
          <div className="pt-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Factures ({client.invoices.length})</p>
            {client.invoices.slice(0, 5).map((i) => (
              <EntityRow key={i.id} ref1={i.invoiceNumber}
                secondary={i.dueDate ? `Échéance ${formatDate(i.dueDate)}` : undefined}
                amount={Number(i.amountTtc)} status={i.status} alert={i.status === "overdue"}
                onClick={() => openEntity("invoice", i.id)}
                actions={[
                  ...(i.status === "unpaid" || i.status === "overdue" ? [{ label: "Marquer payée", icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => markPaid(i.id, i.invoiceNumber) }] : []),
                  { label: "Voir PDF", icon: <ExternalLink className="h-3.5 w-3.5" />, onClick: () => setPdfPreview({ url: `/api/invoices/${i.id}/pdf`, title: `Facture ${i.invoiceNumber}`, documentNumber: i.invoiceNumber, downloadName: `facture-${i.invoiceNumber}`, entityType: "invoice", entityId: i.id, status: i.status }) },
                ]}
                busy={busy} />
            ))}
          </div>
        )}

        {(client.payments?.length ?? 0) > 0 && (
          <div className="pt-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Paiements ({client.payments!.length})</p>
            {client.payments!.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-xs mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <CreditCard className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">{formatCurrency(Number(p.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">{p.paymentMethod ?? "—"} · {p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}

        {(client.refunds?.length ?? 0) > 0 && (
          <div className="pt-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Remboursements ({client.refunds!.length})</p>
            {client.refunds!.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-xs mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <RotateCcw className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">-{formatCurrency(Number(r.amount))}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.reason} · {r.processedAt ? formatDate(r.processedAt) : formatDate(r.createdAt)}</p>
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}

        {(client.disputes?.length ?? 0) > 0 && (
          <div className="pt-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Litiges ({client.disputes!.length})</p>
            {client.disputes!.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-xs mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className={cn("h-3.5 w-3.5 shrink-0", d.priority === "urgent" || d.priority === "high" ? "text-red-600" : "text-amber-600")} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground">{d.type} · {d.amountDisputed ? formatCurrency(Number(d.amountDisputed)) : "—"}</p>
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* 5. Activité (timeline event-sourcing) */}
      <TabsContent value="activite" className="space-y-2 mt-4">
        {activityLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun événement enregistré pour ce client</p>
        ) : (
          <div className="space-y-1">
            {activity.map((e) => (
              <div key={e.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/40 text-xs">
                <div className="h-6 w-6 rounded-full bg-[#0F2D52]/10 flex items-center justify-center shrink-0 text-[9px] uppercase font-bold text-[#0F2D52]">
                  {e.source.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{e.label}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="font-mono uppercase">{e.source}.{e.type}</span>
                    {e.ipAddress && <span className="font-mono">{e.ipAddress}</span>}
                    <span>{new Date(e.createdAt).toLocaleString("fr-CA")}</span>
                  </p>
                </div>
              </div>
            ))}
            <Button variant="link" size="sm" onClick={() => router.push(`/admin/audit-trail?clientId=${client.id}`)} className="w-full">
              Voir l&apos;audit trail complet →
            </Button>
          </div>
        )}
      </TabsContent>

      {/* 6. Documents */}
      <TabsContent value="documents" className="space-y-2 mt-4">
        {(client.documents?.length ?? 0) === 0 ? (
          <EmptyState text="Aucun document" actionLabel="Téléverser" actionHref={`/admin/documents?newFor=${client.id}`} />
        ) : (
          <>
            {client.documents!.slice(0, 30).map((d) => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-xs mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.category ?? "—"} · {d.fileSize ? `${(d.fileSize / 1024).toFixed(1)} Ko` : ""} · {formatDate(d.createdAt)}
                    </p>
                  </div>
                </div>
                {!d.isRead && <Badge variant="destructive" className="text-[9px]">Non lu</Badge>}
              </div>
            ))}
            <Button variant="link" size="sm" onClick={() => router.push(`/admin/documents`)} className="w-full">
              Voir tous les documents →
            </Button>
          </>
        )}
      </TabsContent>

      {/* 7. Communications */}
      <TabsContent value="comm" className="space-y-3 mt-4">
        <div className="grid grid-cols-2 gap-2">
          <FinanceBox label="Messages" value={String(client._count?.messages ?? 0)} accent="text-blue-600" />
          <FinanceBox label="Rendez-vous" value={String(client._count?.appointments ?? 0)} accent="text-violet-600" />
        </div>
        <Button variant="outline" className="w-full" onClick={() => router.push(`/admin/messages?clientId=${client.id}`)}>
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Ouvrir la conversation
        </Button>
        <Button variant="outline" className="w-full" onClick={() => router.push(`/admin/calendar?clientId=${client.id}`)}>
          <Calendar className="h-3.5 w-3.5 mr-1.5" />Voir les rendez-vous
        </Button>
      </TabsContent>

      {/* 8. Légal / Compliance */}
      <TabsContent value="legal" className="space-y-3 mt-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Consentements</p>
        <InfoRow icon={CheckCircle2} label="Conditions générales" value={client.termsAcceptedAt ? `${formatDate(new Date(client.termsAcceptedAt))} (v${client.termsAcceptedVersion ?? "?"})` : "Non accepté"} />
        <InfoRow icon={CheckCircle2} label="Politique vie privée" value={client.privacyAcceptedAt ? formatDate(new Date(client.privacyAcceptedAt)) : "Non accepté"} />
        <InfoRow icon={CheckCircle2} label="Marketing" value={client.marketingConsent ? `Oui (${client.marketingConsentAt ? formatDate(new Date(client.marketingConsentAt)) : "—"})` : "Refusé"} />
        {client.termsAcceptedIp && <InfoRow icon={Globe} label="IP acceptation" value={client.termsAcceptedIp} />}

        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pt-3">Vérification identité</p>
        <InfoRow icon={CheckCircle2} label="Vérifié le" value={client.identityVerifiedAt ? formatDate(new Date(client.identityVerifiedAt)) : "Non vérifié"} />
        {client.identityVerifiedBy && <InfoRow icon={ShieldCheck} label="Vérifié par" value={client.identityVerifiedBy} />}

        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pt-3">Signatures</p>
        {client.contracts.filter((c) => c.adminSignatureData || c.clientSignatureData).length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune signature électronique enregistrée</p>
        ) : (
          client.contracts
            .filter((c) => c.adminSignatureData || c.clientSignatureData)
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-xs">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.contractNumber} — {c.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.adminSignatureData && c.clientSignatureData ? "Signé par les deux parties" :
                     c.adminSignatureData ? "Admin signé" : "Client signé"}
                    {c.signedAt && ` · ${formatDate(new Date(c.signedAt))}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => openEntity("contract", c.id)}>
                  Voir
                </Button>
              </div>
            ))
        )}
      </TabsContent>

      {/* 9. Équipe */}
      <TabsContent value="equipe" className="space-y-2 mt-4">
        {(client.teamMembers?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun membre d&apos;équipe — ce client est seul utilisateur</p>
        ) : (
          client.teamMembers!.map((m) => (
            <div key={m.id} className="p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.fullName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                </div>
                <Badge variant={m.role === "owner" ? "default" : "secondary"} className="text-[10px] capitalize">{m.role}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {m.acceptedAt ? `Membre depuis ${formatDate(m.acceptedAt)}` : `Invité ${formatDate(m.invitedAt)}`}
                {m.lastLogin && ` · Dernière connexion ${formatDate(m.lastLogin)}`}
              </p>
            </div>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}

function FinanceBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border bg-card p-2 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={cn("text-sm font-bold mt-0.5 tabular-nums", accent ?? "")}>{value}</p>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur border border-white/10 p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-white/60 font-semibold">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xl font-bold mt-0.5 text-white">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ text, actionLabel, actionHref }: { text: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div className="text-center py-10 px-6 rounded-lg border-2 border-dashed">
      <p className="text-sm text-muted-foreground">{text}</p>
      {actionLabel && actionHref && (
        <Button size="sm" variant="outline" className="mt-3" asChild>
          <Link href={actionHref}><Plus className="h-3 w-3" />{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

function EntityRow({
  ref1,
  title,
  secondary,
  amount,
  status,
  actions,
  alert,
  busy,
  onClick,
}: {
  ref1: string;
  title?: string;
  secondary?: string;
  amount?: number;
  status?: string;
  actions?: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
  alert?: boolean;
  busy?: boolean;
  /** Si fourni, le contenu (sauf actions menu) est cliquable et appelle onClick */
  onClick?: () => void;
}) {
  const innerContent = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] text-muted-foreground font-mono">{ref1}</p>
        {title && <p className="text-sm font-medium truncate mt-0.5">{title}</p>}
        {secondary && <p className="text-[11px] text-muted-foreground mt-0.5">{secondary}</p>}
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        {status && <StatusBadge status={status} />}
        {amount !== undefined && <p className="text-sm font-bold">{formatCurrency(amount)}</p>}
      </div>
    </>
  );
  return (
    <div className={`p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow flex items-start justify-between gap-2 ${alert ? "border-red-300" : ""} ${onClick ? "hover:border-primary cursor-pointer" : ""}`}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="contents bg-transparent border-0 p-0 m-0 cursor-pointer text-left"
        >
          {innerContent}
        </button>
      ) : (
        innerContent
      )}
      {actions && actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button disabled={busy} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors disabled:opacity-50">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {actions.map((a, i) => (
              <DropdownMenuItem key={i} onClick={a.onClick} disabled={busy}>
                <span className="mr-2">{a.icon}</span>{a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

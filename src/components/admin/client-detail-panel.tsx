"use client";
// Client Detail Panel — slide-out right
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
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
import { AddressFields, TechPicker, COUNTRY_FORMATS } from "@/components/admin/client-form-fields";
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
  RotateCcw,
  AlertCircle,
  ShieldCheck,
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
  const t = useTranslations("admin.clients");
  const tc = useTranslations("common");
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [client, setClient] = useState<ClientFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? "info");


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


  const [signingContract, setSigningContract] = useState<{ id: number; number: string; title: string; amount: number | null } | null>(null);


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
    if (!client || !edFullName.trim()) return { success: false, error: t("nom_requis") };
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
      return { success: false, error: d.error || t("erreur") };
    } catch { return { success: false, error: t("erreur_reseau") }; }
  };


  const [paidDialog, setPaidDialog] = useState<{ id: number; num: string } | null>(null);
  const [paidMethod, setPaidMethod] = useState<string>("");
  const [paidNote, setPaidNote] = useState("");

  const PAYMENT_METHODS = [
    { value: "interac", label: t("virement_interac") },
    { value: "bank_transfer", label: t("virement_bancaire") },
    { value: "card", label: t("carte_stripe") },
    { value: "check", label: t("cheque") },
    { value: "cash", label: t("especes") },
    { value: "other", label: t("autre") },
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
      } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
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

          toast.error(t("session_expiree_reconnexion_requise"));
          router.push("/admin/login");
          throw new Error("UNAUTHORIZED");
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.client) {
          toast.error(t("client_introuvable"));
          return;
        }
        setClient(data.client);
      })
      .catch((err) => {
        if (cancelled || err.message === "UNAUTHORIZED") return;
        console.error("Erreur chargement client:", err);
        toast.error(t("erreur_chargement_client"));
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
      title: t("accepter_devis"),
      description: `Le devis ${num} sera marqué comme accepté et un contrat sera généré automatiquement.`,
      confirmLabel: t("accepter"),
      variant: "default",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${id}/accept`, { method: "POST" });
      if (res.ok) { toast.success(t("devis_accepte")); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setBusy(false); }
  };

  const markPaid = (id: number, num: string) => {

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
      confirmLabel: t("envoyer"),
      variant: "default",
    });
    if (!ok) return;
    setBusy(true);
    try {

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
        toast.error(d.error || t("erreur_creation_document"));
        return;
      }

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

          if (pdfPreview || paidDialog || signingContract) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (pdfPreview || paidDialog || signingContract) e.preventDefault();
        }}
      >

        <SheetTitle className="sr-only">
          {client?.fullName ?? t("detail_client")}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {client ? `Informations détaillées pour ${client.fullName}` : t("chargement")}
        </SheetDescription>

        {loading || !client ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            {tc("loading")}
          </div>
        ) : (
          <>

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


              <div className="grid grid-cols-4 gap-2">
                <StatBox icon={Briefcase} label={t("mandats")} value={client.mandates.length} />
                <StatBox icon={FileText} label={t("devis")} value={client.quotes.length} />
                <StatBox icon={Receipt} label={t("factures")} value={client.invoices.length} />
                <StatBox icon={FileSignature} label={t("contrats")} value={client.contracts.length} />
              </div>


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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                      title={t("telecharger_integralite_dossier_client")}
                    >
                      <Archive className="h-3 w-3" />Dossier ZIP
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = `/api/clients/${client.id}/export-zip?lang=fr`;
                        a.click();
                        toast.success(t("preparation_dossier_zip_fr"));
                      }}
                    >
                      {t("francais")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = `/api/clients/${client.id}/export-zip?lang=en`;
                        a.click();
                        toast.success(t("generating_zip"));
                      }}
                    >
                      {t("english")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetHeader>


            <div className="flex-1 overflow-y-scroll px-6 pt-0 pb-6 [scrollbar-gutter:stable]">
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


    {client && (
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100 [&>button]:hover:bg-white/15 [&>button]:rounded-md [&>button]:p-1.5 [&>button]:right-5 [&>button]:top-5">

          <DialogHeader className="bg-gradient-to-br from-[#0F2D52] to-[#1e4a7e] text-white p-6 space-y-2 shrink-0">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 ring-2 ring-white/20">
                <AvatarFallback className="bg-white/10 text-white font-bold backdrop-blur">
                  {initials(client.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="text-white text-lg">{t("modifier_client")}</DialogTitle>
                <DialogDescription className="text-white/70 truncate">{client.email}</DialogDescription>
              </div>
            </div>
          </DialogHeader>


          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">

            <FormSection title={t("identite")} icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("nom_complet")}</Label>
                <Input value={edFullName} onChange={(e) => setEdFullName(e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("telephone")}</Label>
                  <Input value={edPhone} onChange={(e) => setEdPhone(e.target.value)} placeholder="418-000-0000" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("entreprise")}</Label>
                  <Input value={edCompany} onChange={(e) => setEdCompany(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("secteur")}</Label>
                <Input value={edSector} onChange={(e) => setEdSector(e.target.value)} placeholder={t("manufacturier_agroalimentaire_energie")} />
              </div>
            </FormSection>


            <FormSection title={t("adresse")} icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}>
              <AddressFields
                country={edCountry} onCountryChange={(c) => { setEdCountry(c); /* reset province si pays sans province */ const meta = COUNTRY_FORMATS[c]; if (!meta?.hasRegion) setEdProvince(""); }}
                address={edAddress} onAddressChange={setEdAddress}
                city={edCity} onCityChange={setEdCity}
                province={edProvince} onProvinceChange={setEdProvince}
                postal={edPostal} onPostalChange={setEdPostal}
              />
            </FormSection>


            <FormSection title={t("technique_notes")} icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("technologies")}</Label>
                <TechPicker value={edTech} onChange={setEdTech} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("notes_internes")}
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-700 font-semibold normal-case tracking-normal">{t("admin_uniquement")}</span>
                </Label>
                <Textarea value={edNotes} onChange={(e) => setEdNotes(e.target.value)} rows={3} placeholder={t("notes_privees_jamais_visibles_client")} className="bg-amber-50/30" />
              </div>
            </FormSection>
          </div>


          <div className="flex items-center justify-end gap-2 px-6 py-4 bg-muted/30 border-t">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              {tc("cancel")}
            </Button>
            <Button
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await handleSaveClient();
                  if (result.success) {
                    toast.success(t("client_mis_jour"));
                    setEditOpen(false);
                  } else {
                    toast.error(result.error || t("erreur"));
                  }
                } finally { setBusy(false); }
              }}
              disabled={busy || !edFullName.trim()}
            >
              {busy ? t("enregistrement") : t("enregistrer")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}


    <Dialog
      open={!!paidDialog}
      onOpenChange={(o) => { if (!o) { setPaidDialog(null); setPaidMethod(""); setPaidNote(""); } }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("marquer_comme_payee")}</DialogTitle>
          <DialogDescription>
            Facture {paidDialog?.num} — sélectionnez la méthode de paiement utilisée.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("methode")}</Label>
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
            <Label htmlFor="paid-note" className="text-xs uppercase tracking-wider text-muted-foreground">{t("note_optionnel")}</Label>
            <Textarea
              id="paid-note"
              value={paidNote}
              onChange={(e) => setPaidNote(e.target.value)}
              rows={2}
              placeholder={t("n_transaction_reference")}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { setPaidDialog(null); setPaidMethod(""); setPaidNote(""); }} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={submitMarkPaid}
            disabled={!paidMethod || busy}
          >
            <CreditCard className="h-4 w-4 mr-1.5" />
            {busy ? t("enregistrement") : t("confirmer_paiement")}
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
          const entity = pdfPreview.entityType;
          const id = pdfPreview.entityId;
          const num = pdfPreview.documentNumber ?? "";
          const status = pdfPreview.status;
          if (!entity || !id) return undefined;

          const buttons: React.ReactNode[] = [];


          if (entity === "quote" && status === "pending") {
            buttons.push(
              <Button key="accept" size="sm" variant="outline" disabled={busy}
                className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                onClick={async () => { await acceptQuote(id, num); }}>
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />{t("client_detail_panel_marquer_accepte")}</Button>
            );
          }
          if (entity === "invoice" && (status === "unpaid" || status === "overdue")) {
            buttons.push(
              <Button key="paid" size="sm" variant="outline" disabled={busy}
                className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                onClick={async () => { await markPaid(id, num); }}>
                <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />{t("client_detail_panel_marquer_payee")}</Button>
            );
          }
          if (entity === "contract" && status === "pending" && !pdfPreview.isAdminSigned) {
            buttons.push(
              <Button key="sign" size="sm" variant="outline" disabled={busy}
                className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                onClick={async () => { await signContract(id); }}>
                <PenTool className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Signer admin
              </Button>
            );
          }


          const finalStatus = (entity === "quote" && status === "accepted") ||
                              (entity === "invoice" && status === "paid") ||
                              (entity === "contract" && status === "signed");
          if (!finalStatus) {
            buttons.push(
              <Button key="send" size="sm" variant="outline" disabled={busy}
                className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm"
                onClick={async () => { await sendToClient(entity, num, id, pdfPreview.title); }}>
                <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Envoyer au client
              </Button>
            );
          }


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
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />{tc("download")}
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
  const t = useTranslations("admin.clients");
  const tc = useTranslations("common");
  const [tab, setTab] = useState("identite");
  const [activity, setActivity] = useState<AuditEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);


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


  const hasLegalData =
    !!client.termsAcceptedAt ||
    !!client.privacyAcceptedAt ||
    !!client.identityVerifiedAt ||
    client.contracts.some((c) => c.adminSignatureData || c.clientSignatureData);
  const hasTeamMembers = (client.teamMembers?.length ?? 0) > 0;
  const tabsCount = 4 + (hasLegalData ? 1 : 0) + (hasTeamMembers ? 1 : 0);

  return (
    <Tabs value={tab} onValueChange={setTab}>

      <div className="sticky top-0 z-20 -mx-6 px-6 pt-4 pb-2 bg-background border-b border-border/40">
        <TabsList className={cn(
          "h-auto gap-1 bg-muted p-1 w-full flex overflow-x-auto sm:grid sm:overflow-visible shadow-sm",
          tabsCount === 4 ? "sm:grid-cols-4" : tabsCount === 5 ? "sm:grid-cols-5" : "sm:grid-cols-6",
        )}>
          <TabsTrigger value="identite" className="text-[11px] px-3 py-1.5 shrink-0 whitespace-nowrap sm:shrink">{t("identite")}</TabsTrigger>
          <TabsTrigger value="finance" className="text-[11px] px-3 py-1.5 shrink-0 whitespace-nowrap sm:shrink">{t("finance")}</TabsTrigger>
          <TabsTrigger value="activite" className="text-[11px] px-3 py-1.5 shrink-0 whitespace-nowrap sm:shrink">{t("activite")}</TabsTrigger>
          <TabsTrigger value="documents" className="text-[11px] px-3 py-1.5 shrink-0 whitespace-nowrap sm:shrink">{t("documents")}</TabsTrigger>
          {hasLegalData && <TabsTrigger value="legal" className="text-[11px] px-3 py-1.5 shrink-0 whitespace-nowrap sm:shrink">{t("legal")}</TabsTrigger>}
          {hasTeamMembers && <TabsTrigger value="equipe" className="text-[11px] px-3 py-1.5 shrink-0 whitespace-nowrap sm:shrink">{t("equipe")}</TabsTrigger>}
        </TabsList>
      </div>


      <TabsContent value="identite" className="space-y-3 mt-4">
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => router.push(`/admin/messages?clientId=${client.id}`)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Conversation
          </Button>
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />{tc("edit")}
          </Button>
        </div>
        <InfoRow icon={Mail} label={t("courriel")} value={client.email} />
        {client.phone && <InfoRow icon={Phone} label={t("telephone")} value={client.phone} />}
        {(client.address || client.city || client.province || client.postalCode) && (
          <InfoRow
            icon={MapPin}
            label={t("adresse")}
            value={[client.address, client.city, client.province, client.postalCode, client.country].filter(Boolean).join(", ")}
          />
        )}
        {client.companyName && <InfoRow icon={Building2} label={t("entreprise")} value={client.companyName} />}
        {client.sector && <InfoRow icon={Briefcase} label={t("secteur")} value={client.sector} />}
        <InfoRow icon={Calendar} label={t("compte_cree")} value={formatDate(new Date(client.createdAt))} />
        <InfoRow icon={Clock} label={t("derniere_connexion")} value={client.lastLogin ? formatDate(new Date(client.lastLogin)) : "Jamais"} />

        {client.technologies && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("technologies")}</p>
            <div className="flex flex-wrap gap-1">
              {client.technologies.split(",").map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{t.trim()}</Badge>
              ))}
            </div>
          </div>
        )}

        {client.internalNotes && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t("notes_internes")}</p>
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs whitespace-pre-wrap">
              {client.internalNotes}
            </div>
          </div>
        )}
      </TabsContent>


      <TabsContent value="finance" className="space-y-3 mt-0">

        <div className="sticky top-[3.6rem] z-10 -mx-6 px-6 pt-3 pb-3 bg-background border-b border-border/40 mb-3">
          <div className="grid grid-cols-3 gap-2">
            <FinanceBox label={t("total_depense")} value={formatCurrency(totalSpent || totalInvoicesAmount)} accent="text-emerald-600" />
            <FinanceBox label={t("solde_ouvert")} value={formatCurrency(openBalance || unpaidAmount)} accent={openBalance > 0 || unpaidAmount > 0 ? "text-amber-600" : "text-muted-foreground"} />
            <FinanceBox label="LTV" value={formatCurrency(totalSpent || totalInvoicesAmount)} accent="text-[#0F2D52]" />
          </div>
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
                  ...(q.status === "pending" ? [{ label: t("marquer_accepte"), icon: <CheckCircle2 className="h-3.5 w-3.5" />, onClick: () => acceptQuote(q.id, q.quoteNumber) }] : []),
                  { label: t("voir_pdf"), icon: <ExternalLink className="h-3.5 w-3.5" />, onClick: () => setPdfPreview({ url: `/api/quotes/${q.id}/pdf`, title: q.title, documentNumber: q.quoteNumber, downloadName: `devis-${q.quoteNumber}`, entityType: "quote", entityId: q.id, status: q.status }) },
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
                  ...(i.status === "unpaid" || i.status === "overdue" ? [{ label: t("marquer_payee"), icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => markPaid(i.id, i.invoiceNumber) }] : []),
                  { label: t("voir_pdf"), icon: <ExternalLink className="h-3.5 w-3.5" />, onClick: () => setPdfPreview({ url: `/api/invoices/${i.id}/pdf`, title: `Facture ${i.invoiceNumber}`, documentNumber: i.invoiceNumber, downloadName: `facture-${i.invoiceNumber}`, entityType: "invoice", entityId: i.id, status: i.status }) },
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


      <TabsContent value="activite" className="space-y-2 mt-4">
        {activityLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">{tc("loading")}</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("aucun_evenement_enregistre_client")}</p>
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
              {t("voir_apos_audit_trail_complet")}
            </Button>
          </div>
        )}
      </TabsContent>


      <TabsContent value="documents" className="space-y-2 mt-4">
        {(client.documents?.length ?? 0) === 0 ? (
          <EmptyState text={t("aucun_document")} actionLabel={t("televerser")} actionHref={`/admin/documents?newFor=${client.id}`} />
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
                {!d.isRead && <Badge variant="destructive" className="text-[9px]">{t("non_lu")}</Badge>}
              </div>
            ))}
            <Button variant="link" size="sm" onClick={() => router.push(`/admin/documents`)} className="w-full">
              {t("voir_tous_documents")}
            </Button>
          </>
        )}
      </TabsContent>


      <TabsContent value="legal" className="space-y-3 mt-4">
        {(client.termsAcceptedAt || client.privacyAcceptedAt || client.marketingConsent) && (
          <>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t("consentements")}</p>
            {client.termsAcceptedAt && (
              <InfoRow icon={CheckCircle2} label={t("conditions_generales")} value={`${formatDate(new Date(client.termsAcceptedAt))}${client.termsAcceptedVersion ? ` (v${client.termsAcceptedVersion})` : ""}`} />
            )}
            {client.privacyAcceptedAt && (
              <InfoRow icon={CheckCircle2} label={t("politique_vie_privee")} value={formatDate(new Date(client.privacyAcceptedAt))} />
            )}
            {client.marketingConsent && (
              <InfoRow icon={CheckCircle2} label={t("marketing")} value={`Oui${client.marketingConsentAt ? ` (${formatDate(new Date(client.marketingConsentAt))})` : ""}`} />
            )}
            {client.termsAcceptedIp && <InfoRow icon={Globe} label={t("ip_acceptation")} value={client.termsAcceptedIp} />}
          </>
        )}

        {client.identityVerifiedAt && (
          <>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pt-3">{t("verification_identite")}</p>
            <InfoRow icon={CheckCircle2} label={t("verifie")} value={formatDate(new Date(client.identityVerifiedAt))} />
            {client.identityVerifiedBy && <InfoRow icon={ShieldCheck} label={t("verifie_2")} value={client.identityVerifiedBy} />}
          </>
        )}

        {client.contracts.some((c) => c.adminSignatureData || c.clientSignatureData) && (
          <>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pt-3">{t("signatures")}</p>
            {client.contracts
              .filter((c) => c.adminSignatureData || c.clientSignatureData)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-xs">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.contractNumber} — {c.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.adminSignatureData && c.clientSignatureData ? t("signe_deux_parties") :
                       c.adminSignatureData ? t("admin_signe") : t("client_signe")}
                      {c.signedAt && ` · ${formatDate(new Date(c.signedAt))}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => setPdfPreview({
                    url: `/api/contracts/${c.id}/pdf`,
                    title: c.title,
                    documentNumber: c.contractNumber,
                    downloadName: `contrat-${c.contractNumber}`,
                    entityType: "contract",
                    entityId: c.id,
                    status: c.status,
                    isAdminSigned: !!c.adminSignatureData,
                  })}>
                    {t("voir_pdf")}
                  </Button>
                </div>
              ))}
          </>
        )}
      </TabsContent>


      <TabsContent value="equipe" className="space-y-2 mt-4">
        {(client.teamMembers?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("aucun_membre_apos_equipe_client")}</p>
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

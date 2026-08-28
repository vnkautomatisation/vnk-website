"use client";
// Composants de formulaire client partages entre clients-view et client-detail-panel
// — TechPicker (catalogue de technologies VNK)
// — AddressFields (13 pays avec layouts adaptes + Google Places autocomplete)
// — FormSection (section de formulaire VNK navy)
// — SectorPicker (dropdown de secteurs predefinis + custom)
import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGooglePlaces, parseAddressComponents } from "@/hooks/use-google-places";

// ── Catalogue de technologies (aligne avec services VNK) ─────────
export const TECH_CATALOG: { category: string; items: string[] }[] = [
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

// ── Catalogue de secteurs (aligne avec marches VNK) ──────────────
export const SECTOR_OPTIONS = [
  "Manufacturier",
  "Agroalimentaire",
  "Pharmaceutique",
  "Énergie / Services publics",
  "Métallurgie",
  "Automobile",
  "Bois et papier",
  "Plastique / Caoutchouc",
  "Mines",
  "Eau / Traitement",
  "Logistique / Entreposage",
  "Autre",
];

// Le secteur et la categorie restent stockes en francais : seul l'affichage suit la locale.
export const SECTOR_EN: Record<string, string> = {
  "Manufacturier": "Manufacturing",
  "Agroalimentaire": "Food and beverage",
  "Pharmaceutique": "Pharmaceutical",
  "Énergie / Services publics": "Energy / Utilities",
  "Métallurgie": "Metals",
  "Automobile": "Automotive",
  "Bois et papier": "Wood and paper",
  "Plastique / Caoutchouc": "Plastics / Rubber",
  "Mines": "Mining",
  "Eau / Traitement": "Water / Treatment",
  "Logistique / Entreposage": "Logistics / Warehousing",
  "Autre": "Other",
};

const TECH_CATEGORY_EN: Record<string, string> = {
  "PLC / Automates": "PLC / Controllers",
  "HMI / SCADA": "HMI / SCADA",
  "Robotique": "Robotics",
  "Réseaux & Protocoles": "Networks & protocols",
  "Accès distant": "Remote access",
};

export function TechPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("admin.clients");
  const tc = useTranslations("common");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");

  const isEn = useLocale().startsWith("en");
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

  const filteredCatalog = TECH_CATALOG.map((cat) => ({
    ...cat,
    items: cat.items.filter((i) => i.toLowerCase().includes(search.toLowerCase())),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[34px] items-center p-2 rounded-md border bg-background">
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground italic">{t("aucune_technologie_selectionnee")}</span>
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
              {tc("add")}
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
                placeholder={t("rechercher")}
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-2">
              {filteredCatalog.length === 0 && search && (
                <p className="text-xs text-muted-foreground text-center py-4">{t("aucun_resultat_pour", { query: search })}</p>
              )}
              {filteredCatalog.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold px-1">{isEn ? TECH_CATEGORY_EN[cat.category] ?? cat.category : cat.category}</p>
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
            <div className="p-2 border-t bg-muted/30 shrink-0">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">{t("custom")}</p>
              <div className="flex gap-1.5">
                <Input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                  placeholder={t("techno_specifique")}
                  className="h-8 text-xs flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!customInput.trim()} className="h-8 px-2 text-xs">
                  {tc("add")}
                </Button>
              </div>
              {customItems.length > 0 && (
                <p className="text-[9px] text-muted-foreground mt-1.5">{customItems.length} custom : {customItems.join(", ")}</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ── SectorPicker ─────────────────────────────────────────────────
export function SectorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("admin.clients");
  const isEn = useLocale().startsWith("en");
  const isCustom = value && !SECTOR_OPTIONS.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="space-y-2">
      <Select
        value={isCustom ? "__custom__" : value}
        onValueChange={(v) => {
          if (v === "__custom__") {
            setShowCustom(true);
            onChange("");
          } else {
            setShowCustom(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger><SelectValue placeholder={t("choisir_secteur")} /></SelectTrigger>
        <SelectContent>
          {SECTOR_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>{isEn ? SECTOR_EN[s] ?? s : s}</SelectItem>
          ))}
          <SelectItem value="__custom__">{t("personnalise")}</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("secteur_personnalise")} />
      )}
    </div>
  );
}

// ── Formats d'adresses par pays ──────────────────────────────────
type CountryFormat = {
  name: string;
  hasRegion: boolean;
  regionLabel?: string;
  nameEn?: string;
  regionLabelEn?: string;
  postalLabelEn?: string;
  regionOptions?: { code: string; name: string; en?: string }[];
  postalLabel: string;
  postalPlaceholder: string;
  cityLabel?: string;
  layout: "city-region-postal" | "postal-city" | "city-postal";
};

const CA_PROVINCES = [
  { code: "QC", name: "Québec", en: "Quebec" }, { code: "ON", name: "Ontario" }, { code: "BC", name: "Colombie-Britannique", en: "British Columbia" },
  { code: "AB", name: "Alberta" }, { code: "MB", name: "Manitoba" }, { code: "SK", name: "Saskatchewan" },
  { code: "NS", name: "Nouvelle-Écosse", en: "Nova Scotia" }, { code: "NB", name: "Nouveau-Brunswick", en: "New Brunswick" }, { code: "NL", name: "Terre-Neuve-et-Labrador", en: "Newfoundland and Labrador" },
  { code: "PE", name: "Île-du-Prince-Édouard", en: "Prince Edward Island" }, { code: "YT", name: "Yukon" }, { code: "NT", name: "Territoires du Nord-Ouest", en: "Northwest Territories" }, { code: "NU", name: "Nunavut" },
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
  { code: "CAM", name: "Campeche" }, { code: "CHP", name: "Chiapas" }, { code: "CHH", name: "Chihuahua" }, { code: "CMX", name: "Ciudad de México", en: "Mexico City" },
  { code: "COA", name: "Coahuila" }, { code: "COL", name: "Colima" }, { code: "DUR", name: "Durango" }, { code: "GUA", name: "Guanajuato" },
  { code: "GRO", name: "Guerrero" }, { code: "HID", name: "Hidalgo" }, { code: "JAL", name: "Jalisco" }, { code: "MEX", name: "Estado de México", en: "State of Mexico" },
  { code: "MIC", name: "Michoacán" }, { code: "MOR", name: "Morelos" }, { code: "NAY", name: "Nayarit" }, { code: "NLE", name: "Nuevo León" },
  { code: "OAX", name: "Oaxaca" }, { code: "PUE", name: "Puebla" }, { code: "QUE", name: "Querétaro" }, { code: "ROO", name: "Quintana Roo" },
  { code: "SLP", name: "San Luis Potosí" }, { code: "SIN", name: "Sinaloa" }, { code: "SON", name: "Sonora" }, { code: "TAB", name: "Tabasco" },
  { code: "TAM", name: "Tamaulipas" }, { code: "TLA", name: "Tlaxcala" }, { code: "VER", name: "Veracruz" }, { code: "YUC", name: "Yucatán" }, { code: "ZAC", name: "Zacatecas" },
];

const BR_ESTADOS = [
  { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" }, { code: "AP", name: "Amapá" }, { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceará" }, { code: "DF", name: "Distrito Federal" }, { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" }, { code: "MA", name: "Maranhão" }, { code: "MT", name: "Mato Grosso" }, { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" }, { code: "PA", name: "Pará" }, { code: "PB", name: "Paraíba" }, { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" }, { code: "PI", name: "Piauí" }, { code: "RJ", name: "Rio de Janeiro" }, { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" }, { code: "RO", name: "Rondônia" }, { code: "RR", name: "Roraima" }, { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" }, { code: "SE", name: "Sergipe" }, { code: "TO", name: "Tocantins" },
];

const CH_CANTONS = [
  { code: "ZH", name: "Zurich" }, { code: "BE", name: "Berne", en: "Bern" }, { code: "LU", name: "Lucerne" }, { code: "UR", name: "Uri" },
  { code: "SZ", name: "Schwytz", en: "Schwyz" }, { code: "OW", name: "Obwald", en: "Obwalden" }, { code: "NW", name: "Nidwald", en: "Nidwalden" }, { code: "GL", name: "Glaris", en: "Glarus" },
  { code: "ZG", name: "Zoug", en: "Zug" }, { code: "FR", name: "Fribourg" }, { code: "SO", name: "Soleure", en: "Solothurn" }, { code: "BS", name: "Bâle-Ville", en: "Basel-City" },
  { code: "BL", name: "Bâle-Campagne", en: "Basel-Country" }, { code: "SH", name: "Schaffhouse", en: "Schaffhausen" }, { code: "AR", name: "Appenzell Rhodes-Extérieures", en: "Appenzell Outer Rhodes" },
  { code: "AI", name: "Appenzell Rhodes-Intérieures", en: "Appenzell Inner Rhodes" }, { code: "SG", name: "Saint-Gall", en: "St. Gallen" }, { code: "GR", name: "Grisons" },
  { code: "AG", name: "Argovie", en: "Aargau" }, { code: "TG", name: "Thurgovie", en: "Thurgau" }, { code: "TI", name: "Tessin", en: "Ticino" }, { code: "VD", name: "Vaud" },
  { code: "VS", name: "Valais" }, { code: "NE", name: "Neuchâtel", en: "Neuchatel" }, { code: "GE", name: "Genève", en: "Geneva" }, { code: "JU", name: "Jura" },
];

const IT_REGIONI = [
  { code: "ABR", name: "Abruzzes", en: "Abruzzo" }, { code: "BAS", name: "Basilicate", en: "Basilicata" }, { code: "CAL", name: "Calabre", en: "Calabria" }, { code: "CAM", name: "Campanie", en: "Campania" },
  { code: "EMR", name: "Émilie-Romagne", en: "Emilia-Romagna" }, { code: "FVG", name: "Frioul-Vénétie julienne", en: "Friuli-Venezia Giulia" }, { code: "LAZ", name: "Latium", en: "Lazio" }, { code: "LIG", name: "Ligurie", en: "Liguria" },
  { code: "LOM", name: "Lombardie", en: "Lombardy" }, { code: "MAR", name: "Marches", en: "Marche" }, { code: "MOL", name: "Molise" }, { code: "PIE", name: "Piémont", en: "Piedmont" },
  { code: "PUG", name: "Pouilles", en: "Apulia" }, { code: "SAR", name: "Sardaigne", en: "Sardinia" }, { code: "SIC", name: "Sicile", en: "Sicily" }, { code: "TOS", name: "Toscane", en: "Tuscany" },
  { code: "TAA", name: "Trentin-Haut-Adige", en: "Trentino-South Tyrol" }, { code: "UMB", name: "Ombrie", en: "Umbria" }, { code: "VDA", name: "Vallée d'Aoste", en: "Aosta Valley" }, { code: "VEN", name: "Vénétie", en: "Veneto" },
];

const ES_COMUNIDADES = [
  { code: "AN", name: "Andalousie", en: "Andalusia" }, { code: "AR", name: "Aragon" }, { code: "AS", name: "Asturies", en: "Asturias" }, { code: "IB", name: "Îles Baléares", en: "Balearic Islands" },
  { code: "PV", name: "Pays basque", en: "Basque Country" }, { code: "CN", name: "Îles Canaries", en: "Canary Islands" }, { code: "CB", name: "Cantabrie", en: "Cantabria" }, { code: "CL", name: "Castille-et-León", en: "Castile and Leon" },
  { code: "CM", name: "Castille-La Manche", en: "Castile-La Mancha" }, { code: "CT", name: "Catalogne", en: "Catalonia" }, { code: "EX", name: "Estrémadure", en: "Extremadura" }, { code: "GA", name: "Galice", en: "Galicia" },
  { code: "RI", name: "La Rioja" }, { code: "MD", name: "Madrid" }, { code: "MC", name: "Murcie", en: "Murcia" }, { code: "NC", name: "Navarre" }, { code: "VC", name: "Valence", en: "Valencia" },
  { code: "CE", name: "Ceuta" }, { code: "ML", name: "Melilla" },
];

export const COUNTRY_FORMATS: Record<string, CountryFormat> = {
  CA: { name: "Canada", hasRegion: true, regionLabel: "Province", regionOptions: CA_PROVINCES, postalLabel: "Code postal", postalPlaceholder: "G6V 3P8", nameEn: "Canada", regionLabelEn: "Province", postalLabelEn: "Postal code", layout: "city-region-postal" },
  US: { name: "États-Unis", hasRegion: true, regionLabel: "État", regionOptions: US_STATES, postalLabel: "ZIP code", postalPlaceholder: "12345", nameEn: "United States", regionLabelEn: "State", postalLabelEn: "ZIP code", layout: "city-region-postal" },
  FR: { name: "France", hasRegion: false, postalLabel: "Code postal", postalPlaceholder: "75001", nameEn: "France", postalLabelEn: "Postal code", layout: "postal-city" },
  BE: { name: "Belgique", hasRegion: false, postalLabel: "Code postal", postalPlaceholder: "1000", nameEn: "Belgium", postalLabelEn: "Postal code", layout: "postal-city" },
  CH: { name: "Suisse", hasRegion: true, regionLabel: "Canton (optionnel)", regionOptions: CH_CANTONS, postalLabel: "NPA", postalPlaceholder: "1200", nameEn: "Switzerland", regionLabelEn: "Canton (optional)", postalLabelEn: "Postal code", layout: "postal-city" },
  LU: { name: "Luxembourg", hasRegion: false, postalLabel: "Code postal", postalPlaceholder: "L-1234", nameEn: "Luxembourg", postalLabelEn: "Postal code", layout: "postal-city" },
  GB: { name: "Royaume-Uni", hasRegion: true, regionLabel: "County (optionnel)", postalLabel: "Postcode", postalPlaceholder: "SW1A 1AA", nameEn: "United Kingdom", regionLabelEn: "County (optional)", postalLabelEn: "Postcode", layout: "city-postal" },
  DE: { name: "Allemagne", hasRegion: false, postalLabel: "PLZ", postalPlaceholder: "10115", nameEn: "Germany", postalLabelEn: "Postal code", layout: "postal-city" },
  ES: { name: "Espagne", hasRegion: true, regionLabel: "Communauté autonome (optionnel)", regionOptions: ES_COMUNIDADES, postalLabel: "Código postal", postalPlaceholder: "28001", nameEn: "Spain", regionLabelEn: "Autonomous community (optional)", postalLabelEn: "Postal code", layout: "postal-city" },
  IT: { name: "Italie", hasRegion: true, regionLabel: "Regione", regionOptions: IT_REGIONI, postalLabel: "CAP", postalPlaceholder: "00100", nameEn: "Italy", regionLabelEn: "Region", postalLabelEn: "Postal code", layout: "postal-city" },
  MX: { name: "Mexique", hasRegion: true, regionLabel: "Estado", regionOptions: MX_ESTADOS, postalLabel: "Código postal", postalPlaceholder: "01000", nameEn: "Mexico", regionLabelEn: "State", postalLabelEn: "Postal code", layout: "city-region-postal" },
  BR: { name: "Brésil", hasRegion: true, regionLabel: "Estado", regionOptions: BR_ESTADOS, postalLabel: "CEP", postalPlaceholder: "01310-100", nameEn: "Brazil", regionLabelEn: "State", postalLabelEn: "Postal code", layout: "city-region-postal" },
  OTHER: { name: "Autre", hasRegion: true, regionLabel: "Région (optionnel)", postalLabel: "Code postal", postalPlaceholder: "", nameEn: "Other", regionLabelEn: "Region (optional)", postalLabelEn: "Postal code", layout: "city-region-postal" },
};

export function AddressFields({
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
  const t = useTranslations("admin.clients");
  const meta = COUNTRY_FORMATS[country] ?? COUNTRY_FORMATS.OTHER;
  const isEn = useLocale().startsWith("en");
  const places = useGooglePlaces();
  const addressInputRef = useRef<HTMLInputElement>(null);

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

  }, [places.loaded]);

  const cityField = (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{meta.cityLabel ?? "Ville"}</Label>
      <Input value={city} onChange={(e) => onCityChange(e.target.value)} />
    </div>
  );
  const postalField = (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{isEn ? meta.postalLabelEn ?? meta.postalLabel : meta.postalLabel}</Label>
      <Input value={postal} onChange={(e) => onPostalChange(e.target.value)} placeholder={meta.postalPlaceholder} />
    </div>
  );
  const regionField = meta.hasRegion ? (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{isEn ? meta.regionLabelEn ?? meta.regionLabel : meta.regionLabel}</Label>
      {meta.regionOptions && meta.regionOptions.length > 0 ? (
        <Select value={province} onValueChange={onProvinceChange}>
          <SelectTrigger><SelectValue placeholder={t("selectionner")} /></SelectTrigger>
          <SelectContent>
            {meta.regionOptions.map((p) => (
              <SelectItem key={p.code} value={p.code}>{p.code} — {isEn ? p.en ?? p.name : p.name}</SelectItem>
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
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("pays")}</Label>
        <Select value={country} onValueChange={onCountryChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(COUNTRY_FORMATS).map(([code, c]) => (
              <SelectItem key={code} value={code}>{isEn ? c.nameEn ?? c.name : c.name}</SelectItem>
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
              {t("suggestions_google")}
            </span>
          )}
        </Label>
        <Input
          ref={addressInputRef}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder={places.loaded ? t("commence_taper_suggestions_auto") : t("123_rue_industrielle")}
          autoComplete="off"
        />
      </div>
      {meta.layout === "postal-city" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">{postalField}</div>
            <div className="col-span-2">{cityField}</div>
          </div>
          {regionField && <div>{regionField}</div>}
        </>
      )}
      {meta.layout === "city-postal" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {cityField}
            {postalField}
          </div>
          {regionField && <div>{regionField}</div>}
        </>
      )}
      {meta.layout === "city-region-postal" && (
        <div className="grid grid-cols-3 gap-3">
          {cityField}
          {regionField ?? <div />}
          {postalField}
        </div>
      )}
    </>
  );
}

export function FormSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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

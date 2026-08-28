"use client";
// ─────────────────────────────────────────────────────────
// InteractiveDocumentView — Aperçu pro "PDF-like" du document
// à signer, avec :
//   - Variables {{...}} déjà résolues (passées via resolvedMarkdown)
//   - Cases à cocher `- [ ]` / `- [x]` rendues comme de VRAIES
//     checkboxes interactives (vs texte littéral [ ])
//   - Style pseudo-papier (police Inter, ombre, paddings,
//     headings navy, tables grille complète, blockquote bordée)
//
// L'employé ne pourra signer qu'une fois TOUTES les cases cochées.
// Le parent reçoit (states, allChecked, totalCount, checkedCount)
// via le callback onCheckboxChange.
//
// Implémentation : on pré-traite le markdown pour remplacer chaque
// pattern `- [ ]` / `- [x]` (et `[ ]` / `[x]` inline) par un marqueur
// `@@CHECKBOX:idx@@`, puis on rend via marked, puis on split le HTML
// sur ce marqueur pour intercaler de vrais <input type="checkbox">.
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useTranslations } from "next-intl";
import { marked } from "marked";
// Types deplaces dans interactive-document-view-types.ts pour permettre
// a Fast Refresh de hot-reload ce composant (les fichiers React ne
// doivent exporter QUE des composants).
import type {
  CheckboxStates,
  SignatureScope,
  SignatureAnchor,
} from "@/components/admin/interactive-document-view-types";

interface InteractiveDocumentViewProps {
  /** Markdown brut (avec {{vars}} non résolues) — fallback si pas de resolvedMarkdown. */
  bodyMarkdown: string;
  /** Markdown avec variables déjà résolues côté serveur. */
  resolvedMarkdown?: string;
  /** Callback à chaque changement de case. */
  onCheckboxChange?: (
    states: CheckboxStates,
    meta: { allChecked: boolean; totalCount: number; checkedCount: number },
  ) => void;
  /** États initiaux (post-signature). Si fourni en mode disabled, restitue les coches. */
  initialStates?: CheckboxStates;
  /** Désactive les interactions (mode lecture après signature). */
  disabled?: boolean;
  /** Classe additionnelle pour le wrapper. */
  className?: string;
  /**
   * Si fourni, on affiche un header VNK navy gradient en haut du papier
   * (comme le vrai PDF final). Si omis, pas de header (compat existante).
   */
  title?: string;
  /** Version optionnelle (ex. "1.2") affichée en pastille dans le header. */
  version?: string;
  /**
   * Filtre les ancres `[Signature ...]` rendues dans la section signatures
   * en bas du document. Defaut "both" pour preserver le comportement
   * historique. Synchronise avec le rendu PDF (cf. SignatureScope dans
   * pdf-html-renderer.ts).
   */
  signatureScope?: SignatureScope;
  /**
   * Mission 4 : mode "chapitre cahier". Quand fourni, le composant rend en pied
   * de document une case "J'ai lu et compris ce chapitre" + un champ initiales
   * obligatoire. Le parent recoit les changements via onChapterAckChange.
   */
  chapterMode?: {
    /** Numero du chapitre (1-indexed) affiche en label. */
    chapterIndex: number;
    /** Nombre total de chapitres dans le cahier. */
    totalChapters: number;
    /** Etat initial (controle externe). */
    state?: { read: boolean; initials: string };
    onChange?: (state: { read: boolean; initials: string }) => void;
  };
}

// ─── Patterns checkbox ────────────────────────────────────
// Match  "- [ ]"  "* [x]"  "- [X]"  en début de ligne (liste) OU "[ ]" / "[x]" inline.
// Important : on capture l'état initial pour préseeder le state.
const LIST_CHECKBOX_RE = /^(\s*[-*])\s+\[([ xX])\]\s+/gm;
const INLINE_CHECKBOX_RE = /\[([ xX])\]/g;
// Ancres signatures : "[Signature employé]", "[Signature employeur]",
// "[Signature RH]", etc. — ne doivent JAMAIS apparaître en texte brut
// dans l'aperçu. On les capture pour les rendre comme des blocs visuels.
const SIGNATURE_ANCHOR_RE = /\[Signature\s+([^\]]+)\]/gi;
// Titre/section "Signatures" en bas de doc — on le masque aussi (notre
// composant rend déjà un bloc Signatures séparé).
const SIGNATURES_SECTION_RE = /^#{1,3}\s+Signatures?\s*$/gim;

function preprocessMarkdown(md: string): {
  processed: string;
  initialChecks: Record<number, boolean>;
  signatures: SignatureAnchor[];
} {
  let idx = 0;
  const initialChecks: Record<number, boolean> = {};
  const signatures: SignatureAnchor[] = [];


  let out = md.replace(SIGNATURE_ANCHOR_RE, (_match, role: string) => {
    const cleaned = String(role).trim();
    signatures.push({
      label: `Signature ${cleaned}`,
      role: cleaned.toLowerCase(),
    });
    return ""; // retiré du flux texte
  });

  out = out.replace(SIGNATURES_SECTION_RE, "");


  out = out.replace(LIST_CHECKBOX_RE, (_match, bullet: string, mark: string) => {
    const checked = mark === "x" || mark === "X";
    initialChecks[idx] = checked;
    const marker = `@@CHECKBOX:${idx}@@`;
    idx += 1;
    return `${bullet} ${marker} `;
  });


  out = out.replace(INLINE_CHECKBOX_RE, (_match, mark: string) => {
    const checked = mark === "x" || mark === "X";
    initialChecks[idx] = checked;
    const marker = `@@CHECKBOX:${idx}@@`;
    idx += 1;
    return marker;
  });



  out = out.replace(/\n{3,}/g, "\n\n").replace(/\s+$/g, "");

  return { processed: out, initialChecks, signatures };
}

// Configuration marked : GFM-like, breaks=false, etc.
marked.setOptions({
  gfm: true,
  breaks: false,
});

function renderToHtml(md: string): string {
  try {
    return marked.parse(md, { async: false }) as string;
  } catch {
    return `<pre>${escapeHtml(md)}</pre>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Composant ────────────────────────────────────────────
export function InteractiveDocumentView({
  bodyMarkdown,
  resolvedMarkdown,
  onCheckboxChange,
  initialStates,
  disabled = false,
  className = "",
  title,
  version,
  signatureScope = "both",
  chapterMode,
}: InteractiveDocumentViewProps) {
  const t = useTranslations("admin.ui");
  const sourceMd = resolvedMarkdown ?? bodyMarkdown ?? "";


  const { segments, totalCount, defaultStates, signatures } = useMemo(() => {
    const { processed, initialChecks, signatures: sigs } =
      preprocessMarkdown(sourceMd);
    const rawHtml = renderToHtml(processed);


    const parts = rawHtml.split(/(@@CHECKBOX:\d+@@)/g);

    const total = Object.keys(initialChecks).length;



    const filteredSigs = sigs.filter((s) => {
      if (signatureScope === "none") return false;
      const role = s.role;
      const isEmployee = /employ[ée]e?/i.test(role);
      const isEmployer = /(employer|employeur)/i.test(role);
      if (signatureScope === "employee_only") return isEmployee;
      if (signatureScope === "employer_only") return isEmployer;

      return true;
    });

    return {
      segments: parts,
      totalCount: total,
      defaultStates: initialChecks,
      signatures: filteredSigs,
    };
  }, [sourceMd, signatureScope]);


  const [states, setStates] = useState<CheckboxStates>(() => ({
    ...defaultStates,
    ...(initialStates ?? {}),
  }));


  const lastSrcRef = useRef<string>(sourceMd);
  useEffect(() => {
    if (lastSrcRef.current !== sourceMd) {
      lastSrcRef.current = sourceMd;
      setStates({ ...defaultStates, ...(initialStates ?? {}) });
    }
  }, [sourceMd, defaultStates, initialStates]);


  useEffect(() => {
    if (!onCheckboxChange) return;
    const checkedCount = Object.values(states).filter(Boolean).length;
    const allChecked = totalCount === 0 ? true : checkedCount === totalCount;
    onCheckboxChange(states, { allChecked, totalCount, checkedCount });

  }, [states, totalCount]);

  const toggle = (idx: number) => {
    if (disabled) return;
    setStates((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };





  return (
    <div
      className={`interactive-doc-paper mx-auto max-w-[820px] bg-white text-slate-900 rounded-md shadow-[0_4px_24px_rgba(15,45,82,0.12)] border border-slate-200 overflow-hidden ${className}`}
      style={{
        fontFamily:
          'Inter, Segoe UI, system-ui, -apple-system, Helvetica Neue, Arial, sans-serif',
        lineHeight: 1.65,
        fontSize: "14px",
      }}
    >

      {title && (
        <div
          className="text-white relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #0F2D52 0%, #15406d 100%)",
            padding: "24px 32px",
          }}
        >
          <div
            className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1
                className="font-bold leading-tight"
                style={{
                  color: "#ffffff",
                  fontSize: "22px",
                  margin: 0,
                  padding: 0,
                  border: 0,
                }}
              >
                {title}
              </h1>
              <p className="mt-1.5 text-white/90 text-[13px] font-semibold tracking-wide">
                {t("vnk_automatisation_inc")}
              </p>
              <p className="text-white/60 text-[10px] uppercase tracking-[0.18em] mt-0.5">
                {t("value_network_knowledge")}
              </p>
            </div>
            {version && (
              <span className="shrink-0 inline-flex items-center rounded-full border border-white/30 bg-white/10 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-white">
                v{version}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className="space-y-1"
        style={{ padding: "40px 56px" }}
      >
        {segments.map((seg, i) => {
          const m = /^@@CHECKBOX:(\d+)@@$/.exec(seg);
          if (m) {
            const idx = Number(m[1]);
            const checked = !!states[idx];
            return (
              <label
                key={`cb-${idx}-${i}`}
                className={`inline-flex items-center gap-2 align-middle select-none ${
                  disabled ? "cursor-default" : "cursor-pointer"
                }`}
                onClick={(e) => {

                  e.stopPropagation();
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(idx)}
                  className="h-4 w-4 rounded border-slate-400 accent-[#0F2D52] focus:ring-2 focus:ring-[#0F2D52]/30 shrink-0"
                  aria-label={t("interactive_document_view_case_a_cocher_p0", { p0: idx + 1 })}
                />
              </label>
            );
          }
          if (!seg) return null;
          return (
            <Fragment key={`html-${i}`}>
              <span


                dangerouslySetInnerHTML={{ __html: seg }}
              />
            </Fragment>
          );
        })}

        {/* Blocs Signatures : remplacent les ancres `[Signature X]` qui
            apparaissaient comme du texte brut. On force au moins 2 blocs
            (employé + employeur) si le doc n'en contenait qu'un, pour
            harmoniser avec le PDF final. */}
        {signatures.length > 0 && (
          <div className="not-prose mt-10 pt-6 border-t border-slate-200">
            <h2
              style={{
                color: "#0F2D52",
                fontSize: "17px",
                fontWeight: 700,
                margin: "0 0 14px 0",
                paddingBottom: "4px",
                borderBottom: "1px solid #cbd5e1",
              }}
            >
              {t("signatures")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {signatures.map((sig, i) => (
                <div
                  key={`sig-${i}`}
                  className="border border-slate-300 rounded-md bg-slate-50/40 px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52] mb-2">
                    {sig.label}
                  </p>
                  <div className="h-16 border-b border-slate-400 border-dashed flex items-end justify-center pb-1 text-[11px] text-slate-400 italic">
                    {t("attente_signature")}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Date :{" "}
                    <span className="text-slate-700">________________</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}


        {chapterMode && (
          <ChapterAckBlock
            chapterIndex={chapterMode.chapterIndex}
            totalChapters={chapterMode.totalChapters}
            state={chapterMode.state}
            onChange={chapterMode.onChange}
            disabled={disabled}
          />
        )}


        <div className="mt-12 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-500 tracking-wide">
          {t("vnk_automatisation_inc_document_confidentiel")}
        </div>
      </div>


      <style jsx>{`
        .interactive-doc-paper :global(h1) {
          color: #0f2d52;
          font-size: 22px;
          font-weight: 700;
          margin: 1.6em 0 0.6em;
          padding-bottom: 6px;
          border-bottom: 2px solid #0f2d52;
        }
        .interactive-doc-paper :global(h2) {
          color: #0f2d52;
          font-size: 17px;
          font-weight: 700;
          margin: 1.4em 0 0.5em;
          padding-bottom: 4px;
          border-bottom: 1px solid #cbd5e1;
        }
        .interactive-doc-paper :global(h3) {
          color: #15406d;
          font-size: 15px;
          font-weight: 600;
          margin: 1.2em 0 0.4em;
        }
        .interactive-doc-paper :global(p) {
          margin: 0.7em 0;
          text-align: justify;
          color: #1e293b;
        }
        .interactive-doc-paper :global(ul),
        .interactive-doc-paper :global(ol) {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .interactive-doc-paper :global(li) {
          margin: 0.25em 0;
        }
        .interactive-doc-paper :global(strong) {
          color: #0f2d52;
          font-weight: 600;
        }
        .interactive-doc-paper :global(em) {
          color: #334155;
        }
        .interactive-doc-paper :global(blockquote) {
          border-left: 4px solid #0f2d52;
          padding: 0.4em 0 0.4em 1em;
          margin: 1em 0;
          background: #f8fafc;
          color: #334155;
          font-style: italic;
        }
        .interactive-doc-paper :global(code) {
          background: #f1f5f9;
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
          color: #0f2d52;
        }
        .interactive-doc-paper :global(pre) {
          background: #0f2d52;
          color: #f1f5f9;
          padding: 0.8em 1em;
          border-radius: 6px;
          overflow-x: auto;
        }
        .interactive-doc-paper :global(table) {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          font-size: 13px;
        }
        .interactive-doc-paper :global(th),
        .interactive-doc-paper :global(td) {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        .interactive-doc-paper :global(thead th) {
          background: #f1f5f9;
          color: #0f2d52;
          font-weight: 600;
        }
        .interactive-doc-paper :global(a) {
          color: #0f2d52;
          text-decoration: underline;
        }
        .interactive-doc-paper :global(hr) {
          border: 0;
          border-top: 1px solid #cbd5e1;
          margin: 1.5em 0;
        }
        .interactive-doc-paper :global(.var-resolved) {
          color: #0f2d52;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

// ─── ChapterAckBlock : case "J'ai lu" + champ initiales en pied de chapitre
function ChapterAckBlock({
  chapterIndex,
  totalChapters,
  state,
  onChange,
  disabled,
}: {
  chapterIndex: number;
  totalChapters: number;
  state?: { read: boolean; initials: string };
  onChange?: (state: { read: boolean; initials: string }) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.ui");
  const read = state?.read ?? false;
  const initials = state?.initials ?? "";
  const update = (next: { read: boolean; initials: string }) => {
    if (disabled) return;
    onChange?.(next);
  };
  return (
    <div
      className="mt-10 rounded-md border-2 bg-slate-50 px-5 py-4"
      style={{ borderColor: "#0F2D52" }}
    >
      <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52] mb-3">
        Chapitre {chapterIndex} / {totalChapters} - Accuse de reception
      </p>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={read}
          disabled={disabled}
          onChange={(e) => update({ read: e.target.checked, initials })}
          className="h-4 w-4 mt-0.5 rounded border-slate-400 accent-[#0F2D52] shrink-0"
          aria-label={t("interactive_document_view_confirmer_la_lecture_du_chapitre_p0", { p0: chapterIndex })}
        />
        <span className="text-sm text-slate-800">
          {t("j_apos_ai_lu_compris")}
        </span>
      </label>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[11px] text-slate-600 font-medium">{t("initiales")}</span>
        <input
          type="text"
          value={initials}
          disabled={disabled}
          maxLength={6}
          onChange={(e) =>
            update({ read, initials: e.target.value.toUpperCase().slice(0, 6) })
          }
          placeholder={t("ex_yv")}
          className="text-sm font-bold text-[#0F2D52] uppercase tracking-widest border-b-2 border-slate-400 bg-transparent px-2 py-0.5 w-24 focus:outline-none focus:border-[#0F2D52] disabled:opacity-50"
        />
        <span className="text-[10px] text-slate-400 italic">
          {t("min_2_caracteres")}
        </span>
      </div>
    </div>
  );
}

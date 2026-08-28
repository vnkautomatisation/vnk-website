// ─────────────────────────────────────────────────────────
// POST /api/admin/document-templates/import
//
// Importe un document brut (paste ou upload .txt / .pdf / .docx),
// le nettoie en Markdown structure, detecte les valeurs litterales
// remplacables par des variables {{...}} et propose un type de
// document + titre.
//
// Deux modes :
//   - multipart/form-data : champ "file" (10 Mo max, mime valide)
//   - application/json    : { text: string }
//
// Reponse : ImportResult (voir lib/document-templates/document-importer.ts)
// Auth : admin uniquement.
// ─────────────────────────────────────────────────────────
import "server-only";
import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import {
  importFromBuffer,
  importFromText,
  type ImportSourceFormat,
} from "@/lib/document-templates/document-importer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pdf-parse + mammoth = Node

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

const ALLOWED_MIMES: Record<string, ImportSourceFormat> = {
  "text/plain": "txt",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const ALLOWED_EXTENSIONS: Record<string, ImportSourceFormat> = {
  txt: "txt",
  pdf: "pdf",
  docx: "docx",
};

const TextPayload = z.object({
  text: z.string().min(1, "text requis").max(2_000_000, "text trop volumineux"),
});

function extensionOf(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : null;
}

function resolveFormat(file: File): ImportSourceFormat | null {
  if (file.type && ALLOWED_MIMES[file.type]) return ALLOWED_MIMES[file.type];
  const ext = extensionOf(file.name ?? "");
  if (ext && ALLOWED_EXTENSIONS[ext]) return ALLOWED_EXTENSIONS[ext];
  return null;
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }

  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ─── Mode JSON (paste) ───────────────────────────────
    if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => null);
      const parsed = TextPayload.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Payload invalide",
            details: parsed.error.flatten(),
          },
          { status: 400 },
        );
      }
      const result = await importFromText(parsed.data.text);
      return NextResponse.json(result);
    }

    // ─── Mode multipart (upload) ─────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Champ 'file' requis" },
          { status: 400 },
        );
      }
      if (file.size > MAX_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Fichier trop volumineux (max ${MAX_SIZE_BYTES / (1024 * 1024)} Mo)` },
          { status: 413 },
        );
      }
      const format = resolveFormat(file);
      if (!format) {
        return NextResponse.json(
          {
            error: t("format_non_supporte_utilisez_txt_pdf_ou"),
          },
          { status: 415 },
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await importFromBuffer(buffer, format);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: t("content_type_non_supporte_attendu_application_json") },
      { status: 415 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur lors de l'import";
    return NextResponse.json(
      { error: t("route_echec_de_l_analyse_p0", { p0: message }) },
      { status: 500 },
    );
  }
}

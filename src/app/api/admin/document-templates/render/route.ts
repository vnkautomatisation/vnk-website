// POST /api/admin/document-templates/render
// Rend un template Markdown en interpolant les variables {{...}} avec le
// contexte de l'employe et un contexte additionnel (donnees du contrat,
// extras passes par l'appelant).
//
// Body : { body: string, employeeId: number, contractId?: number | null, extraContext?: Record<string, unknown> }
// Reponse : { rendered: string, missingVars: string[] }
//
// Note : Implementation simple en attendant le module @/lib/document-templates
// developpe en parallele. Si le module existe, on delegue.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

function get(obj: unknown, path: string): JsonValue | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur as JsonValue | undefined;
}

function formatValue(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    return v.toLocaleDateString("fr-CA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (typeof v === "number") {
    return v.toLocaleString("fr-CA");
  }
  if (typeof v === "string") {
    // Detecte ISO date
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("fr-CA", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
    }
    return v;
  }
  return String(v);
}

function renderTemplate(
  body: string,
  context: Record<string, unknown>,
): { rendered: string; missingVars: string[] } {
  const missing = new Set<string>();
  const rendered = body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = get(context, key);
    if (value === undefined || value === null || value === "") {
      missing.add(key);
      return `{{${key}}}`;
    }
    return formatValue(value);
  });
  return { rendered, missingVars: Array.from(missing) };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  let payload: {
    body?: string;
    employeeId?: number;
    contractId?: number | null;
    extraContext?: Record<string, unknown>;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const body = typeof payload.body === "string" ? payload.body : "";
  if (!body) {
    return NextResponse.json({ error: "body requis" }, { status: 400 });
  }
  if (!Number.isFinite(payload.employeeId)) {
    return NextResponse.json({ error: "employeeId requis" }, { status: 400 });
  }

  // Tentative de delegation au module dedie s'il existe
  try {
    type RenderEngineModule = {
      renderTemplate: (
        body: string,
        context: Record<string, unknown>,
      ) => { rendered: string; missingVars: string[] };
    };
    type ContextModule = {
      buildEmployeeContext: (
        employeeId: number,
        contractId?: number | null,
      ) => Promise<Record<string, unknown>>;
    };
    // Imports dynamiques tolerants (les modules peuvent ne pas exister encore).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engineMod = (await import("@/lib/document-templates/render-engine" as any).catch(
      () => null,
    )) as RenderEngineModule | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctxMod = (await import("@/lib/document-templates/employee-context" as any).catch(
      () => null,
    )) as ContextModule | null;

    if (engineMod?.renderTemplate && ctxMod?.buildEmployeeContext) {
      const employeeContext = await ctxMod.buildEmployeeContext(
        payload.employeeId!,
        payload.contractId ?? null,
      );
      const context = { ...employeeContext, ...(payload.extraContext ?? {}) };
      const result = engineMod.renderTemplate(body, context);
      return NextResponse.json(result);
    }
  } catch {
    // Fallback inline
  }

  // ---- Fallback inline ------------------------------------------
  const employee = await prisma.admin.findUnique({
    where: { id: payload.employeeId! },
    include: {
      position: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employe introuvable" }, { status: 404 });
  }

  const context: Record<string, unknown> = {
    employee: {
      id: employee.id,
      fullName: employee.fullName ?? "",
      firstName: (employee.fullName ?? "").split(" ")[0] ?? "",
      lastName: (employee.fullName ?? "").split(" ").slice(1).join(" "),
      email: employee.email,
      position: employee.position?.name ?? "",
      department: employee.department ?? "",
      team: employee.team?.name ?? "",
      phone: employee.phone ?? "",
      startDate: employee.startDate ?? null,
    },
    company: {
      name: "VNK Automatisation Inc.",
    },
    today: new Date(),
    ...(payload.extraContext ?? {}),
  };

  const result = renderTemplate(body, context);
  return NextResponse.json(result);
}

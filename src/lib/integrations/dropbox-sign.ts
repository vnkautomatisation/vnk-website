// ─────────────────────────────────────────────────────────
// Intégration Dropbox Sign (ex HelloSign) — envoi de signatures
// Alternative au canvas interne. À utiliser pour contrats > 1000 $
// où une signature légalement renforcée (eIDAS/UETA) est nécessaire.
//
// API : https://app.hellosign.com/api/reference
// ─────────────────────────────────────────────────────────
import "server-only";
import { getIntegrationCredentials } from "@/lib/integrations/credentials";

type SignatureRequestInput = {
  title: string;
  subject?: string;
  message?: string;
  signers: { email: string; name: string; order?: number }[];
  fileBase64: string;           // PDF en base64
  fileName: string;             // ex: "contrat-vnk-CT-001.pdf"
  metadata?: Record<string, string>;
  testMode?: boolean;
};

type SignatureRequestResult = {
  signatureRequestId: string;
  signingUrl: string | null;
  ok: boolean;
  error?: string;
};

async function getCreds() {
  const creds = await getIntegrationCredentials("dropbox_sign");
  if (!creds?.api_key) return null;
  return creds;
}

// ── Envoyer une demande de signature ────────────────────
export async function sendSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult> {
  const creds = await getCreds();
  if (!creds) {
    return { ok: false, signatureRequestId: "", signingUrl: null, error: "Dropbox Sign non configuré" };
  }

  // L'API HelloSign accepte multipart OU JSON (avec file_url ou file en base64)
  // On utilise JSON avec file en base64
  const payload: Record<string, unknown> = {
    title: input.title,
    subject: input.subject ?? input.title,
    message: input.message ?? "Veuillez signer ce document.",
    signers: input.signers.map((s, i) => ({
      email_address: s.email,
      name: s.name,
      order: s.order ?? i,
    })),
    test_mode: input.testMode ?? (creds.test_mode === "true") ? 1 : 0,
    files: [{ filename: input.fileName, content: input.fileBase64 }],
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(creds.client_id ? { client_id: creds.client_id } : {}),
  };

  try {
    const res = await fetch("https://api.hellosign.com/v3/signature_request/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(creds.api_key + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, signatureRequestId: "", signingUrl: null, error: err };
    }

    const data = await res.json();
    const req = data.signature_request;
    return {
      ok: true,
      signatureRequestId: req.signature_request_id,
      signingUrl: req.signing_url ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur Dropbox Sign";
    return { ok: false, signatureRequestId: "", signingUrl: null, error: msg };
  }
}

// ── Récupérer le PDF signé après finalisation ──
export async function downloadSignedDocument(signatureRequestId: string): Promise<Buffer | null> {
  const creds = await getCreds();
  if (!creds) return null;

  try {
    const res = await fetch(`https://api.hellosign.com/v3/signature_request/files/${signatureRequestId}?file_type=pdf`, {
      headers: {
        Authorization: `Basic ${Buffer.from(creds.api_key + ":").toString("base64")}`,
      },
    });
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err) {
    console.error("[dropbox-sign] download failed:", err);
    return null;
  }
}

// ── Annuler une demande en cours ──
export async function cancelSignatureRequest(signatureRequestId: string): Promise<boolean> {
  const creds = await getCreds();
  if (!creds) return false;

  try {
    const res = await fetch(`https://api.hellosign.com/v3/signature_request/cancel/${signatureRequestId}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(creds.api_key + ":").toString("base64")}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Indicateur pour l'UI
export async function isDropboxSignAvailable(): Promise<boolean> {
  return !!(await getCreds());
}

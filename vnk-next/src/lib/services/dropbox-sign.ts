// Dropbox Sign (ex-HelloSign) — config via Settings → Intégrations
import "server-only";
import { getSetting } from "@/lib/settings";

export async function sendSignatureRequest(params: {
  title: string;
  subject: string;
  message: string;
  signerName: string;
  signerEmail: string;
  fileUrl: string;
}) {
  const apiKey = await getSetting<string>("integrations", "dropbox_sign_api_key");
  if (!apiKey) {
    return { ok: false, error: "Dropbox Sign non configuré" };
  }

  try {
    // Lazy import
    const sdk = await import("@dropbox/sign");
    const client = new sdk.SignatureRequestApi();
    client.username = apiKey;

    const req: any = {
      title: params.title,
      subject: params.subject,
      message: params.message,
      signers: [
        {
          name: params.signerName,
          emailAddress: params.signerEmail,
          order: 0,
        },
      ],
      fileUrls: [params.fileUrl],
      testMode: process.env.NODE_ENV !== "production",
    };

    const res = await client.signatureRequestSend(req);
    return { ok: true, requestId: (res.body as any).signatureRequest?.signatureRequestId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}

export async function verifyDropboxSignWebhook(event: string, hash: string) {
  const apiKey = await getSetting<string>("integrations", "dropbox_sign_api_key");
  if (!apiKey) return false;
  const crypto = await import("crypto");
  const expected = crypto.createHmac("sha256", apiKey).update(event).digest("hex");
  return expected === hash;
}

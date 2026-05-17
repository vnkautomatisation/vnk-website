// SCIM 2.0 — ServiceProviderConfig (descripteur des capacités)
import { NextResponse } from "next/server";
import { checkScimAuth } from "@/lib/security/scim-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = checkScimAuth(req);
  if (!auth.ok) {
    return NextResponse.json(
      { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: String(auth.status), detail: auth.error },
      { status: auth.status }
    );
  }
  return NextResponse.json({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://datatracker.ietf.org/doc/html/rfc7644",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        name: "OAuth Bearer Token",
        description: "Authentication via Bearer token (SCIM_BEARER_TOKEN)",
        specUri: "https://datatracker.ietf.org/doc/html/rfc6750",
        type: "oauthbearertoken",
        primary: true,
      },
    ],
    meta: { resourceType: "ServiceProviderConfig" },
  });
}

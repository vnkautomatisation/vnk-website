// Spec OpenAPI 3.1 publique pour l'API v1.
import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "VNK Automatisation API",
    version: "1.0.0",
    description: "API REST publique pour l'intégration externe au portail VNK Automatisation. Authentification par Bearer token personnel (vnk_pat_...).",
    contact: { name: "VNK Automatisation", url: "https://vnkautomatisation.ca" },
  },
  servers: [
    { url: "https://vnkautomatisation.ca/api/v1", description: "Production" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "vnk_pat_xxx",
        description: "Personal Access Token créé depuis /admin/settings/api",
      },
    },
    schemas: {
      Client: {
        type: "object",
        properties: {
          id: { type: "integer" },
          fullName: { type: "string" },
          email: { type: "string", format: "email" },
          companyName: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          city: { type: "string", nullable: true },
          province: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          archived: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ClientCreate: {
        type: "object",
        required: ["fullName", "email"],
        properties: {
          fullName: { type: "string" },
          email: { type: "string", format: "email" },
          companyName: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          city: { type: "string", nullable: true },
          province: { type: "string", nullable: true, default: "QC" },
        },
      },
      Invoice: {
        type: "object",
        properties: {
          id: { type: "integer" },
          invoiceNumber: { type: "string" },
          title: { type: "string" },
          amountHt: { type: "number" },
          tpsAmount: { type: "number" },
          tvqAmount: { type: "number" },
          amountTtc: { type: "number" },
          currency: { type: "string", default: "CAD" },
          status: { type: "string", enum: ["paid", "unpaid", "partially_paid", "overdue", "cancelled", "refunded", "draft"] },
          dueDate: { type: "string", format: "date", nullable: true },
          paidAt: { type: "string", format: "date-time", nullable: true },
          clientId: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      Pagination: {
        type: "object",
        properties: {
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/clients": {
      get: {
        summary: "Lister les clients",
        operationId: "listClients",
        tags: ["Clients"],
        security: [{ bearerAuth: ["read:clients"] }],
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Recherche par nom/email/entreprise" },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          200: {
            description: "Liste paginée",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Client" } },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
          401: { description: "Non authentifié", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          403: { description: "Scope insuffisant", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        summary: "Créer un client",
        operationId: "createClient",
        tags: ["Clients"],
        security: [{ bearerAuth: ["write:clients"] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ClientCreate" } } },
        },
        responses: {
          201: {
            description: "Client créé (incluant un mot de passe temporaire à transmettre)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Client" },
                    tempPassword: { type: "string", description: "Mot de passe temporaire généré" },
                  },
                },
              },
            },
          },
          400: { description: "Validation échouée" },
          409: { description: "Email déjà utilisé" },
        },
      },
    },
    "/invoices": {
      get: {
        summary: "Lister les factures",
        operationId: "listInvoices",
        tags: ["Factures"],
        security: [{ bearerAuth: ["read:invoices"] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["paid", "unpaid", "partially_paid", "overdue", "cancelled", "refunded", "draft"] } },
          { name: "clientId", in: "query", schema: { type: "integer" } },
          { name: "fromDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          200: {
            description: "Liste paginée",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Invoice" } },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: "Clients", description: "Gestion des clients" },
    { name: "Factures", description: "Lecture des factures émises" },
  ],
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

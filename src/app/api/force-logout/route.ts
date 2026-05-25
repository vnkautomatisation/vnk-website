// Endpoint de secours : force la suppression du cookie de session
// Quand le user est coince dans un redirect loop a cause d'un JWT corrompu/legacy.
// Visiter cette URL clear tous les cookies authjs et redirige vers /admin/login frais.
import { NextResponse } from "next/server";

export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Deconnexion forcee</title></head>
<body style="font-family:system-ui;max-width:500px;margin:40px auto;padding:20px;background:#f4f6fa">
<h2 style="color:#0F2D52">Cookies effaces</h2>
<p>Votre session a ete reinitialisee. Cliquez ci-dessous pour vous reconnecter.</p>
<a href="/admin/login" style="display:inline-block;background:#0F2D52;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Aller a la page de connexion</a>
</body></html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

  // Clear tous les cookies authjs possibles avec expiration immediate
  const cookieNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
  ];
  for (const name of cookieNames) {
    res.cookies.set(name, "", {
      expires: new Date(0),
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}

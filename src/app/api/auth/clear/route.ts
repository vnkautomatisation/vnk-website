// Page de nettoyage radical : vide cookies authjs + desinstalle TOUS les service
// workers + vide caches + localStorage/sessionStorage. Pour quand le browser
// spam /admin/login a cause d'un SW ou d'un onglet PWA qui poll.
//
// Acces : http://localhost:3000/api/auth/clear
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "authjs.csrf-token",
  "authjs.callback-url",
  "authjs.pkce.code_verifier",
  "authjs.state",
  "authjs.nonce",
  "__Secure-authjs.session-token",
  "__Secure-authjs.callback-url",
  "__Host-authjs.csrf-token",
  "next-auth.session-token",
  "next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.session-token",
  "__Secure-next-auth.callback-url",
  "__Host-next-auth.csrf-token",
];

export async function GET(req: Request) {
  const t = await getTranslations("api_errors");
  const url = new URL(req.url);
  const target = url.searchParams.get("redirect") ?? "/admin/login";

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Nettoyage en cours…</title>
<style>
  body { font-family: system-ui, sans-serif; background:#0F2D52; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:#fff; color:#0F2D52; padding:32px 40px; border-radius:12px; max-width:480px; box-shadow:0 20px 60px rgba(0,0,0,.3); }
  h1 { font-size:18px; margin:0 0 12px; }
  ul { font-size:13px; line-height:1.7; padding-left:20px; margin:12px 0; }
  .ok { color:#0a7; font-weight:600; }
  .err { color:#b30; font-weight:600; }
  a { color:#0F2D52; }
</style>
</head>
<body>
<div class="card">
  <h1>${t("nettoyage_session")}</h1>
  <ul id="log"></ul>
  <p>Redirection vers <a href="${target}">${target}</a>{t("route_dans")}<span id="cnt">3</span>s.</p>
</div>
<script>
(async () => {
  const log = document.getElementById('log');
  const add = (msg, ok = true) => {
    const li = document.createElement('li');
    li.innerHTML = (ok ? '<span class="ok">OK</span> ' : '<span class="err">!!</span> ') + msg;
    log.appendChild(li);
  };

  // 1) Service Workers
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
      add('Service workers desinscrits : ' + regs.length);
    } else {
      add('Pas de serviceWorker API');
    }
  } catch (e) { add('SW unregister : ' + e.message, false); }

  // 2) Caches
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
      add('Caches vides : ' + keys.length);
    }
  } catch (e) { add('Caches : ' + e.message, false); }

  // 3) localStorage / sessionStorage
  try {
    const lsCount = localStorage.length;
    localStorage.clear();
    add('localStorage vide : ' + lsCount + ' cles');
  } catch (e) { add('localStorage : ' + e.message, false); }
  try {
    const ssCount = sessionStorage.length;
    sessionStorage.clear();
    add('sessionStorage vide : ' + ssCount + ' cles');
  } catch (e) { add('sessionStorage : ' + e.message, false); }

  // 4) IndexedDB (best-effort)
  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      add('IndexedDB : ' + dbs.length + ' bases marquees pour suppression');
    }
  } catch (e) { add('IndexedDB : ' + e.message, false); }

  add('Cookies authjs effaces (cote serveur)');

  // Compteur + redirect
  let n = 3;
  const cnt = document.getElementById('cnt');
  const tick = setInterval(() => {
    n -= 1;
    cnt.textContent = String(n);
    if (n <= 0) {
      clearInterval(tick);
      window.location.replace(${JSON.stringify(target)});
    }
  }, 1000);
})();
</script>
</body>
</html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });

  const jar = await cookies();
  for (const name of AUTH_COOKIE_NAMES) {
    res.cookies.set(name, "", { path: "/", maxAge: 0, expires: new Date(0) });
  }
  for (const c of jar.getAll()) {
    if (/^(__Secure-|__Host-)?(authjs|next-auth)\./i.test(c.name)) {
      res.cookies.set(c.name, "", { path: "/", maxAge: 0, expires: new Date(0) });
    }
  }

  return res;
}

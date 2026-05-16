// ============================================================
// Have I Been Pwned — k-anonymity password check
// Cf. https://haveibeenpwned.com/API/v3#PwnedPasswords
// Envoie uniquement les 5 premiers chars du SHA-1, l'API renvoie
// la liste de tous les suffixes connus avec compteur de breach.
// ============================================================

export async function checkPasswordBreached(password: string): Promise<{ breached: boolean; count: number }> {
  // SHA-1 du mot de passe
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-1", enc);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  const prefix = hex.slice(0, 5);
  const suffix = hex.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "vnk-portal" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { breached: false, count: 0 };

    const text = await res.text();
    for (const line of text.split("\n")) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10);
        return { breached: count > 0, count };
      }
    }
    return { breached: false, count: 0 };
  } catch {
    // En cas d'erreur reseau on ne bloque pas le changement
    return { breached: false, count: 0 };
  }
}

// Force du mot de passe (0-4) — heuristique simple
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Tres faible", "Faible", "Moyen", "Fort", "Excellent"];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

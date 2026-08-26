// Access rules for endpoints taking an ?adminId.
// Dependency-free: the refusal paths are only ever reached by the tests.

/** The part of TimesheetScope the decision actually depends on. */
export type ScopeLike = {
  isHr: boolean;
  isFounder: boolean;
  allowedAdminIds: number[] | null;
};

export type ScopeAccess =
  | { ok: true; targetId: number }
  | { ok: false; status: 400 | 403; error: string };

const OUT_OF_SCOPE = "Hors de votre périmètre";
const BAD_ID = "adminId invalide";

function parseTargetId(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function reaches(scope: ScopeLike, targetId: number): boolean {
  if (scope.isFounder || scope.isHr) return true;
  return (scope.allowedAdminIds ?? []).includes(targetId);
}

/** Read someone's entries. Reading your own is always allowed. */
export function checkReadAccess(scope: ScopeLike, rawTargetId: unknown, selfId: number): ScopeAccess {
  const targetId = parseTargetId(rawTargetId);
  if (targetId == null) return { ok: false, status: 400, error: BAD_ID };
  if (targetId === selfId || reaches(scope, targetId)) return { ok: true, targetId };
  return { ok: false, status: 403, error: OUT_OF_SCOPE };
}

/** Act on someone's entries. Nobody reviews their own hours except the founder. */
export function checkReviewAccess(scope: ScopeLike, rawTargetId: unknown, selfId: number): ScopeAccess {
  const targetId = parseTargetId(rawTargetId);
  if (targetId == null) return { ok: false, status: 400, error: BAD_ID };
  if (targetId === selfId && !scope.isFounder) return { ok: false, status: 403, error: OUT_OF_SCOPE };
  if (reaches(scope, targetId)) return { ok: true, targetId };
  return { ok: false, status: 403, error: OUT_OF_SCOPE };
}

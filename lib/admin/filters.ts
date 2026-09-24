// Shared parsing for admin list filters (pages and CSV export read the same params).
import { TXN_SOURCES, type TxnType } from "@/lib/admin/transactions";

export const DAY_OPTIONS = [1, 7, 30, 90, 365] as const;

export function parseDays(v: string | undefined, fallback = 30): number {
  const d = Number(v);
  return (DAY_OPTIONS as readonly number[]).includes(d) ? d : fallback;
}

export function parseTxnTypes(v: string | undefined): TxnType[] | null {
  if (!v) return null;
  const valid = new Set(TXN_SOURCES.map((s) => s.type));
  const list = v.split(",").filter((x): x is TxnType => valid.has(x as TxnType));
  return list.length ? list : null;
}

export const isUuid = (v: string | undefined | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

/** Resolve "@handle", "handle" or a profile id to a creator_profiles id. */
export async function resolveCreator(admin: any, v: string | undefined): Promise<{ id: string; handle: string } | null> {
  const raw = (v ?? "").trim().replace(/^@/, "");
  if (!raw) return null;
  const q = isUuid(raw)
    ? admin.from("creator_profiles").select("id, handle").eq("id", raw)
    : admin.from("creator_profiles").select("id, handle").ilike("handle", raw);
  const { data } = await q.limit(1).maybeSingle();
  return data ?? null;
}

export async function handleMap(admin: any, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const out = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 500) {
    const { data } = await admin.from("creator_profiles").select("id, handle").in("id", unique.slice(i, i + 500));
    for (const c of data ?? []) out.set(c.id, c.handle);
  }
  return out;
}

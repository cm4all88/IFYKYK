// ──────────────────────────────────────────────────────────────────
// lib/prospects-db.ts
// Server-side reads for the acquisition screens. Service client only —
// creator_prospects has RLS on with no policies, so nothing else can see it.
//
// Callers must have passed isAdmin() first. This module does not check
// authorization; it assumes it and says so loudly here so nobody imports it
// into a public path by accident.
// ──────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase-server";
import { activationFor, type Activation } from "@/lib/acquisition";
import type { ProspectStage } from "@/lib/prospects";

export interface ProspectRow {
  id: string;
  display_name: string;
  platform: string | null;
  platform_handle: string | null;
  profile_url: string | null;
  email: string | null;
  niche: string | null;
  follower_count: number | null;
  location: string | null;
  handle_wanted: string | null;
  source: string;
  source_detail: string | null;
  stage: ProspectStage;
  score: number | null;
  notes: string | null;
  follow_up_at: string | null;
  disqualified_reason: string | null;
  do_not_contact: boolean;
  opted_out_at: string | null;
  creator_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectWithActivation extends ProspectRow {
  activation: Activation;
  profile: {
    id: string;
    handle: string;
    claimed_at: string | null;
    onboarding_completed_at: string | null;
    stripe_onboarded: boolean | null;
    avatar_url: string | null;
    bio: string | null;
  } | null;
  first_sent_at: string | null;
}

export interface ProspectFilters {
  q?: string;
  stage?: string;
  source?: string;
  platform?: string;
  dnc?: string;
  page?: number;
  perPage?: number;
}

/**
 * Load prospects with their derived activation.
 *
 * Three grouped queries rather than one per row: the prospect page, the
 * linked profiles, and the earliest outreach send per prospect. Activation is
 * then computed in memory by lib/acquisition.ts, which stays pure.
 */
export async function listProspects(filters: ProspectFilters = {}): Promise<{
  rows: ProspectWithActivation[];
  total: number;
}> {
  const admin = await createServiceClient();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 50));

  let query = (admin as any)
    .from("creator_prospects")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (filters.q) {
    const q = filters.q.replace(/[%,()]/g, "");
    query = query.or(
      `display_name.ilike.%${q}%,email.ilike.%${q}%,platform_handle.ilike.%${q}%,niche.ilike.%${q}%`
    );
  }
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.platform) query = query.eq("platform", filters.platform);
  if (filters.dnc === "1") query = query.eq("do_not_contact", true);

  const { data, count } = await query;
  const prospects: ProspectRow[] = (data ?? []) as ProspectRow[];

  const rows = await attachActivation(prospects);
  return { rows, total: count ?? 0 };
}

/** Everything needed for the funnel — no pagination, no per-row queries. */
export async function loadFunnelInput(): Promise<ProspectWithActivation[]> {
  const admin = await createServiceClient();
  const { data } = await (admin as any)
    .from("creator_prospects")
    .select("*")
    .neq("stage", "disqualified")
    .limit(5000);
  return attachActivation((data ?? []) as ProspectRow[]);
}

export async function getProspect(id: string): Promise<ProspectWithActivation | null> {
  const admin = await createServiceClient();
  const { data } = await (admin as any)
    .from("creator_prospects").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [row] = await attachActivation([data as ProspectRow]);
  return row ?? null;
}

export interface OutreachRow {
  id: string;
  prospect_id: string;
  channel: string;
  subject: string | null;
  body: string;
  claim_url_sent: string | null;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

export async function listOutreach(prospectId: string): Promise<OutreachRow[]> {
  const admin = await createServiceClient();
  const { data } = await (admin as any)
    .from("prospect_outreach")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as OutreachRow[];
}

/** Drafts awaiting a decision, across all prospects. */
export async function listPendingApprovals(): Promise<(OutreachRow & { prospect_name: string })[]> {
  const admin = await createServiceClient();
  const { data } = await (admin as any)
    .from("prospect_outreach")
    .select("*, prospect:prospect_id(display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as any[]).map((r) => ({ ...r, prospect_name: r.prospect?.display_name ?? "—" }));
}

// ─── Internals ────────────────────────────────────────────────────

async function attachActivation(prospects: ProspectRow[]): Promise<ProspectWithActivation[]> {
  if (prospects.length === 0) return [];
  const admin = await createServiceClient();

  const profileIds = prospects.map((p) => p.creator_profile_id).filter(Boolean) as string[];
  const prospectIds = prospects.map((p) => p.id);

  const [{ data: profiles }, { data: sends }] = await Promise.all([
    profileIds.length
      ? (admin as any)
          .from("creator_profiles")
          .select("id, handle, claimed_at, onboarding_completed_at, stripe_onboarded, avatar_url, bio")
          .in("id", profileIds)
      : Promise.resolve({ data: [] }),
    (admin as any)
      .from("prospect_outreach")
      .select("prospect_id, sent_at")
      .in("prospect_id", prospectIds)
      .not("sent_at", "is", null),
  ]);

  const profileById = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

  // Earliest send per prospect = when we first made contact.
  const firstSent = new Map<string, string>();
  for (const s of (sends ?? []) as any[]) {
    const existing = firstSent.get(s.prospect_id);
    if (!existing || s.sent_at < existing) firstSent.set(s.prospect_id, s.sent_at);
  }

  // Post and tier counts, only for prospects that actually have a page.
  const counts = await loadEngagementCounts(profileIds);

  return prospects.map((p) => {
    const profile = p.creator_profile_id ? profileById.get(p.creator_profile_id) ?? null : null;
    const c = profile ? counts.get(profile.id) : undefined;
    return {
      ...p,
      profile,
      first_sent_at: firstSent.get(p.id) ?? null,
      activation: activationFor({
        stage: p.stage,
        first_sent_at: firstSent.get(p.id) ?? null,
        profile,
        live_post_count: c?.posts ?? 0,
        active_tier_count: c?.tiers ?? 0,
      }),
    };
  });
}

async function loadEngagementCounts(
  profileIds: string[]
): Promise<Map<string, { posts: number; tiers: number }>> {
  const out = new Map<string, { posts: number; tiers: number }>();
  if (profileIds.length === 0) return out;

  const admin = await createServiceClient();
  const [{ data: posts }, { data: tiers }] = await Promise.all([
    (admin as any).from("posts")
      .select("creator_profile_id").in("creator_profile_id", profileIds).eq("status", "live"),
    (admin as any).from("subscription_tiers")
      .select("creator_profile_id").in("creator_profile_id", profileIds).eq("is_active", true),
  ]);

  for (const id of profileIds) out.set(id, { posts: 0, tiers: 0 });
  for (const p of (posts ?? []) as any[]) {
    const e = out.get(p.creator_profile_id); if (e) e.posts++;
  }
  for (const t of (tiers ?? []) as any[]) {
    const e = out.get(t.creator_profile_id); if (e) e.tiers++;
  }
  return out;
}

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app";

/**
 * Every sale a creator has made, with who bought it and what they paid.
 *
 * The point of this route is self-service. A buyer emails the creator saying the
 * download never arrived; without this the creator has to ask us to query the
 * database for them, which does not scale past a handful of creators and leaves
 * their customer waiting on our response time. Here they get the buyer's email,
 * whether the file was ever downloaded, and a link they can paste into a reply.
 *
 * Runs under the service role because buyer identity lives in auth.users and
 * digital_purchases rows are not readable by the creator under RLS. Scoped
 * strictly to profiles the caller owns.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profiles } = await (supabase as any)
    .from("creator_profiles").select("id").eq("user_id", user.id);
  const profileIds = (profiles ?? []).map((p: any) => p.id);
  if (profileIds.length === 0) return NextResponse.json({ orders: [], totals: null });

  const admin = await createServiceClient();

  const [{ data: digital }, { data: campaigns }, { data: tips }, { data: superTips }, { data: subPayments }] =
    await Promise.all([
      (admin as any)
        .from("digital_purchases")
        .select("id, fan_email, fan_user_id, amount_paid, creator_receives, download_token, download_count, created_at, digital_product_id, product:digital_product_id(title, download_limit)")
        .in("creator_profile_id", profileIds)
        .order("created_at", { ascending: false }),
      (admin as any).from("campaigns").select("id, title").in("creator_profile_id", profileIds),
      (admin as any)
        .from("tips").select("id, fan_user_id, amount, platform_receives, message, created_at")
        .in("creator_profile_id", profileIds).order("created_at", { ascending: false }),
      (admin as any)
        .from("super_tips").select("id, fan_user_id, amount_usd, creator_receives, message, created_at")
        .in("creator_profile_id", profileIds).order("created_at", { ascending: false }),
      (admin as any)
        .from("subscription_payments").select("id, fan_user_id, gross_usd, creator_receives, created_at")
        .in("creator_profile_id", profileIds).order("created_at", { ascending: false }),
    ]);

  const campaignById = new Map<string, string>((campaigns ?? []).map((c: any) => [String(c.id), String(c.title ?? "Campaign")]));
  let donations: any[] = [];
  if (campaignById.size) {
    const { data } = await (admin as any)
      .from("campaign_donations")
      .select("id, donor_user_id, amount, campaign_id, created_at")
      .in("campaign_id", Array.from(campaignById.keys()))
      .order("created_at", { ascending: false });
    donations = data ?? [];
  }

  type Order = {
    id: string;
    kind: "digital" | "campaign" | "tip" | "super_tip" | "subscription";
    label: string;
    what: string;
    buyerEmail: string | null;
    buyerName: string | null;
    gross: number;
    net: number;
    createdAt: string;
    /** Digital only: everything the creator needs to resolve a delivery problem. */
    downloadUrl?: string;
    downloadCount?: number;
    downloadLimit?: number | null;
    note?: string | null;
  };

  const orders: Order[] = [];
  const needIdentity = new Set<string>();

  for (const d of digital ?? []) {
    orders.push({
      id: d.id,
      kind: "digital",
      label: "Digital product",
      what: d.product?.title ?? "Product",
      buyerEmail: d.fan_email ?? null,
      buyerName: null,
      gross: Number(d.amount_paid ?? 0),
      net: Number(d.creator_receives ?? 0),
      createdAt: d.created_at,
      downloadUrl: d.download_token ? `${APP_URL}/api/digital/download?token=${d.download_token}` : undefined,
      downloadCount: d.download_count ?? 0,
      downloadLimit: d.product?.download_limit ?? null,
    });
    if (d.fan_user_id) needIdentity.add(d.fan_user_id);
  }

  for (const d of donations) {
    orders.push({
      id: d.id, kind: "campaign", label: "Campaign backing",
      what: campaignById.get(String(d.campaign_id)) ?? "Campaign",
      buyerEmail: null, buyerName: null,
      gross: Number(d.amount ?? 0), net: Number(d.amount ?? 0),
      createdAt: d.created_at,
    });
    if (d.donor_user_id) needIdentity.add(d.donor_user_id);
  }

  for (const t of tips ?? []) {
    orders.push({
      id: t.id, kind: "tip", label: "Tip", what: "Tip",
      buyerEmail: null, buyerName: null,
      gross: Number(t.amount ?? 0),
      net: Number(t.amount ?? 0) - Number(t.platform_receives ?? 0),
      createdAt: t.created_at, note: t.message ?? null,
    });
    if (t.fan_user_id) needIdentity.add(t.fan_user_id);
  }

  for (const t of superTips ?? []) {
    orders.push({
      id: t.id, kind: "super_tip", label: "Super Tip", what: "Super Tip",
      buyerEmail: null, buyerName: null,
      gross: Number(t.amount_usd ?? 0), net: Number(t.creator_receives ?? 0),
      createdAt: t.created_at, note: t.message ?? null,
    });
    if (t.fan_user_id) needIdentity.add(t.fan_user_id);
  }

  for (const s of subPayments ?? []) {
    orders.push({
      id: s.id, kind: "subscription", label: "Subscription", what: "Monthly subscription",
      buyerEmail: null, buyerName: null,
      gross: Number(s.gross_usd ?? 0), net: Number(s.creator_receives ?? 0),
      createdAt: s.created_at,
    });
    if (s.fan_user_id) needIdentity.add(s.fan_user_id);
  }

  // Resolve buyer identities once each. A single failure must not blank the list.
  const identities = new Map<string, { email: string | null; name: string | null }>();
  await Promise.all(
    Array.from(needIdentity).map(async (uid) => {
      try {
        const { data } = await (admin as any).auth.admin.getUserById(uid);
        identities.set(uid, {
          email: data?.user?.email ?? null,
          name:
            data?.user?.user_metadata?.display_name ??
            data?.user?.user_metadata?.full_name ??
            data?.user?.user_metadata?.name ??
            null,
        });
      } catch {
        /* leave unresolved */
      }
    })
  );

  const attach = (rows: any[], key: string, kinds: string[]) => {
    for (const r of rows) {
      const id = r[key];
      if (!id) continue;
      const ident = identities.get(id);
      if (!ident) continue;
      for (const o of orders) {
        if (kinds.includes(o.kind) && o.id === r.id) {
          o.buyerName = ident.name;
          // A digital purchase already carries the checkout email. Keep it, and
          // note the account email separately when they differ: the two are not
          // always the same inbox and support goes to whichever they used.
          if (!o.buyerEmail) o.buyerEmail = ident.email;
          else if (ident.email && ident.email.toLowerCase() !== o.buyerEmail.toLowerCase()) {
            o.note = `Account email: ${ident.email}`;
          }
        }
      }
    }
  };

  attach(digital ?? [], "fan_user_id", ["digital"]);
  attach(donations, "donor_user_id", ["campaign"]);
  attach(tips ?? [], "fan_user_id", ["tip"]);
  attach(superTips ?? [], "fan_user_id", ["super_tip"]);
  attach(subPayments ?? [], "fan_user_id", ["subscription"]);

  orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const now = Date.now();
  const since = (days: number) =>
    orders.filter((o) => now - new Date(o.createdAt).getTime() < days * 86400000);

  return NextResponse.json({
    orders,
    totals: {
      count: orders.length,
      net: orders.reduce((s, o) => s + o.net, 0),
      gross: orders.reduce((s, o) => s + o.gross, 0),
      net30: since(30).reduce((s, o) => s + o.net, 0),
      count30: since(30).length,
      // Delivery problems the creator can act on without asking anyone.
      undelivered: orders.filter((o) => o.kind === "digital" && (o.downloadCount ?? 0) === 0).length,
    },
  });
}

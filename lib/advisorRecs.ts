// ──────────────────────────────────────────────────────────────────
// Advisor recommendations (rule-based, entitlement-gated).
//
// These are the leverage prompts the AI Advisor surfaces alongside the
// chat. They are deterministic, not a second AI system: the chat stays
// the chat, this just points creators at the Phase 1 features that help
// them earn more or save time.
//
// Tone rule: sell leverage, never guilt. Every prompt frames a gain
// ("win over new subscribers"), not a failing ("you haven't posted").
//
// lib/entitlements.ts is the single source of truth for what is locked.
// ──────────────────────────────────────────────────────────────────
import type { Entitlements } from "@/lib/entitlements";

export type AdvisorLever = "earn" | "save";

// Which entitlement a recommendation leans on. Undefined = always available.
export type AdvisorRequirement = "schedulePosts" | "firstMonthOffer" | "analytics30";

export interface AdvisorRec {
  id: string;
  title: string;
  body: string;
  lever: AdvisorLever;
  requires?: AdvisorRequirement;
  actionLabel: string;
  pane: string; // dashboard pane to open when the rec is actionable
}

// The full Phase 1 set. Order is intentional: the two ungated wins sit at
// the end so Opening Act always has something it can act on right now.
const PHASE1_RECS: AdvisorRec[] = [
  {
    id: "schedule",
    title: "Post on a schedule",
    body: "Line up your next few posts so your page stays alive even on the days you are busy. A steady drumbeat is what keeps fans subscribed.",
    lever: "save",
    requires: "schedulePosts",
    actionLabel: "Schedule a post",
    pane: "posts",
  },
  {
    id: "first-month-offer",
    title: "Win over new subscribers",
    body: "Give new subscribers a lower first month. You still keep 100% of what they pay, and a softer entry price converts more of the fans already watching you.",
    lever: "earn",
    requires: "firstMonthOffer",
    actionLabel: "Set a first-month offer",
    pane: "profile",
  },
  {
    id: "analytics-30",
    title: "See the trend, not just the week",
    body: "Thirty days of history shows you which posts and prices actually move subscribers, so you can do more of what is working.",
    lever: "earn",
    requires: "analytics30",
    actionLabel: "Open analytics",
    pane: "analytics",
  },
  {
    id: "cadence",
    title: "Find a cadence you can keep",
    body: "Fans reward creators who show up. Pick a rhythm you can sustain for months, then protect it. Consistency beats intensity.",
    lever: "earn",
    actionLabel: "Write a post",
    pane: "posts",
  },
  {
    id: "conversion",
    title: "Turn followers into subscribers",
    body: "Your free followers are already warm. Give them one clear reason to subscribe: a teaser, a members-only drop, or a first taste behind the paywall.",
    lever: "earn",
    actionLabel: "Create a post",
    pane: "posts",
  },
];

function isLocked(rec: AdvisorRec, ent: Entitlements): boolean {
  switch (rec.requires) {
    case "schedulePosts":
      return !ent.schedulePosts;
    case "firstMonthOffer":
      return !ent.firstMonthOffer;
    case "analytics30":
      return ent.analyticsMaxDays < 30;
    default:
      return false; // ungated rec, always actionable
  }
}

// Returns every Phase 1 rec with a `locked` flag.
// - Opening Act: gated recs come back locked (render as Starter upsells),
//   ungated recs stay actionable (advisor-lite).
// - Starter and above: everything is actionable (full Phase 1 set).
export function advisorRecsFor(ent: Entitlements): { rec: AdvisorRec; locked: boolean }[] {
  return PHASE1_RECS.map((rec) => ({ rec, locked: isLocked(rec, ent) }));
}

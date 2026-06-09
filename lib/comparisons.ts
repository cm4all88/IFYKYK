// Data for the /vs/[competitor] comparison pages.
// Competitor facts verified current as of 2026; keep them accurate and fair —
// honest comparisons rank better and convert better than competitor-bashing.

export interface CompareRow {
  label: string;
  us: string;
  them: string;
  usWins?: boolean;
}

export interface Comparison {
  slug: string;
  name: string;
  metaTitle: string;
  metaDesc: string;
  kicker: string;
  headline: string;
  subhead: string;
  lede: string;
  theirFee: string;
  rows: CompareRow[];
  // The honest "where they're genuinely better" note. Builds trust, ranks better.
  fair: string;
}

const SPOTLIGHTLY_FEE = "0% on subscriptions — flat monthly plan instead";

const COMPARISONS: Comparison[] = [
  {
    slug: "patreon",
    name: "Patreon",
    metaTitle: "Patreon Alternative (2026) — Spotlightly vs Patreon",
    metaDesc:
      "Looking for a Patreon alternative? Patreon takes 10% of what you earn. Spotlightly takes 0% of your subscriptions and supports adult content too. The honest comparison.",
    kicker: "Patreon alternative",
    headline: "The Patreon alternative that doesn't take a cut of your subscriptions.",
    subhead: "Patreon takes 10% of everything you earn. Spotlightly takes none of your subscription revenue.",
    lede:
      "Patreon is the name everyone knows for fan memberships — but since August 2025, new creators pay a flat 10% of everything they make, plus processing. Spotlightly charges a flat monthly plan instead and takes nothing from your subscriptions, so the more you grow, the more the difference adds up. And unlike Patreon, you're not locked out the day your work stops being safe-for-work.",
    theirFee: "10% of earnings (new creators) + payment processing",
    rows: [
      { label: "Cut of your subscriptions", us: SPOTLIGHTLY_FEE, them: "10% of everything you earn", usWins: true },
      { label: "Cut of your tips", us: "0%", them: "Counts toward the 10%", usWins: true },
      { label: "Adult content", us: "Yes — a separate Backstage profile, private from your main page", them: "Not allowed", usWins: true },
      { label: "Safe-for-work content", us: "Yes — Spotlight", them: "Yes" },
      { label: "Pricing model", us: "Flat monthly plan, keep your earnings", them: "Percentage of earnings, forever" },
      { label: "Grows with you", us: "One home from SFW to adult — keep your audience", them: "Leave the day you go adult", usWins: true },
    ],
    fair:
      "Where Patreon still wins: if you're just starting and earning under roughly $1,500 a month, their percentage can work out cheaper than a flat plan, and Patreon's brand recognition and built-in discovery are far bigger than ours today. We're built for creators who are scaling — and for anyone who wants an adult lane Patreon will never offer.",
  },
  {
    slug: "onlyfans",
    name: "OnlyFans",
    metaTitle: "OnlyFans Alternative (2026) — Spotlightly vs OnlyFans",
    metaDesc:
      "An OnlyFans alternative that takes 0% of your subscriptions (OnlyFans takes 20%), keeps your adult page private from your main one, and gives you a safe-for-work side too.",
    kicker: "OnlyFans alternative",
    headline: "An OnlyFans alternative that doesn't take 20% — and protects who you are.",
    subhead: "OnlyFans takes 20% of everything. Spotlightly takes 0% of your subscriptions, and your adult page stays private from your main one.",
    lede:
      "OnlyFans takes a flat 20% of every subscription, tip, and message — and it's one identity, with all the stigma the name carries. Spotlightly splits the difference: a mainstream-safe Spotlight page and a private Backstage page that aren't publicly linked unless you choose, so your employer or family never have to know. You keep your subscription revenue, and you keep control of who sees what.",
    theirFee: "20% of everything — subscriptions, tips, PPV, messages",
    rows: [
      { label: "Cut of your subscriptions", us: SPOTLIGHTLY_FEE, them: "20% of everything", usWins: true },
      { label: "Cut of your tips", us: "0%", them: "20%", usWins: true },
      { label: "Safe-for-work side", us: "Yes — a mainstream Spotlight page", them: "No — adult-first, one identity", usWins: true },
      { label: "Privacy between identities", us: "Your SFW and adult pages aren't publicly linked unless you choose", them: "One public identity", usWins: true },
      { label: "Adult content", us: "Yes — Backstage", them: "Yes" },
      { label: "Audience size today", us: "Newer and smaller", them: "Largest adult audience online" },
    ],
    fair:
      "Where OnlyFans still wins: it has by far the largest built-in adult audience and discovery, so you may reach more paying fans there today than on a newer platform. Our edge is what you keep and what you protect — 0% on subscriptions and an identity that stays yours — not audience size yet.",
  },
  {
    slug: "fansly",
    name: "Fansly",
    metaTitle: "Fansly Alternative (2026) — Spotlightly vs Fansly",
    metaDesc:
      "A Fansly alternative that takes 0% of your subscriptions instead of 20%, keeps your adult page separate from a safe-for-work page, and lets you protect your identity.",
    kicker: "Fansly alternative",
    headline: "A Fansly alternative that keeps your 20% — and your privacy.",
    subhead: "Fansly takes 20%, same as OnlyFans. Spotlightly takes 0% of your subscriptions and keeps your adult page private from your main one.",
    lede:
      "Fansly charges the same flat 20% as OnlyFans on subscriptions, tips, and sales. Spotlightly takes nothing from your subscriptions — you pay a flat monthly plan — and gives you two pages that stay unlinked in public: a safe-for-work Spotlight and a private Backstage. You decide who ever knows the second one exists.",
    theirFee: "20% of subscriptions, sales, and tips",
    rows: [
      { label: "Cut of your subscriptions", us: SPOTLIGHTLY_FEE, them: "20%", usWins: true },
      { label: "Cut of your tips", us: "0%", them: "20%", usWins: true },
      { label: "Safe-for-work side", us: "Yes — a mainstream Spotlight page", them: "No — adult-first", usWins: true },
      { label: "Privacy between identities", us: "SFW and adult pages aren't publicly linked unless you choose", them: "One public identity", usWins: true },
      { label: "Tiered subscriptions", us: "Yes", them: "Yes" },
      { label: "Audience size today", us: "Newer and smaller", them: "Established adult audience" },
    ],
    fair:
      "Where Fansly still wins: it has an established adult audience and flexible tiered subscriptions creators like, and a real discovery engine we're still building. We compete on what reaches your bank account and on protecting your identity, not on audience size yet.",
  },
  {
    slug: "fanvue",
    name: "Fanvue",
    metaTitle: "Fanvue Alternative (2026) — Spotlightly vs Fanvue",
    metaDesc:
      "A Fanvue alternative that takes 0% of your subscriptions. Fanvue charges 15% for your first year, then 20%. Spotlightly also gives you a safe-for-work page and identity privacy.",
    kicker: "Fanvue alternative",
    headline: "A Fanvue alternative with no cut on your subscriptions — ever.",
    subhead: "Fanvue charges 15% for your first year, then jumps to 20%. Spotlightly takes 0% of your subscriptions from day one and never raises it.",
    lede:
      "Fanvue starts at a friendly 15% — then quietly becomes 20% after twelve months, the same as OnlyFans. Spotlightly takes nothing from your subscriptions on day one or year three; you pay a flat monthly plan instead. You also get a mainstream Spotlight page alongside a private Backstage one, so your adult work and your public identity stay separate unless you decide otherwise.",
    theirFee: "15% for the first 12 months, then 20%",
    rows: [
      { label: "Cut of your subscriptions", us: SPOTLIGHTLY_FEE, them: "15% year one, then 20%", usWins: true },
      { label: "Rate increases over time", us: "No — flat plan, never rises with earnings", them: "Yes — 15% → 20% after a year", usWins: true },
      { label: "Safe-for-work side", us: "Yes — a mainstream Spotlight page", them: "Adult-focused", usWins: true },
      { label: "Privacy between identities", us: "SFW and adult pages aren't publicly linked unless you choose", them: "One public identity", usWins: true },
      { label: "AI tools", us: "AI bio + onboarding help, more coming", them: "Heavy AI tooling" },
      { label: "Audience size today", us: "Newer and smaller", them: "Large, fast-growing" },
    ],
    fair:
      "Where Fanvue still wins: its 15% intro rate is genuinely cheaper than a flat plan for your first year at lower earnings, and its AI creator tools and audience are well ahead of ours right now. We win once you're past that intro year and at scale — and if you want a safe-for-work identity Fanvue isn't built for.",
  },
  {
    slug: "kofi",
    name: "Ko-fi",
    metaTitle: "Ko-fi Alternative (2026) — Spotlightly vs Ko-fi",
    metaDesc:
      "A Ko-fi alternative for creators who've outgrown the tip jar. Build real subscriptions with no cut, post adult content, sell, and run campaigns — all in one place.",
    kicker: "Ko-fi alternative",
    headline: "A Ko-fi alternative for creators who've outgrown the tip jar.",
    subhead: "Ko-fi is great for one-off tips. Spotlightly is where you build a paying audience — subscriptions, exclusive content, even adult — with no cut on your subscriptions.",
    lede:
      "Ko-fi is free for one-time tips, which is genuinely great. But the moment you want memberships, it's either a 5% cut or a monthly Ko-fi Gold subscription — and it's safe-for-work only, a tip jar at heart. Spotlightly is built for the next step: real subscriptions and locked content with no cut (a flat plan instead), an adult lane that stays private, plus a marketplace and crowdfunding campaigns Ko-fi doesn't have.",
    theirFee: "0% on tips; 5% on memberships (or $6–8/mo Ko-fi Gold to remove it)",
    rows: [
      { label: "Cut of one-time tips", us: "0%", them: "0%" },
      { label: "Cut of memberships / subscriptions", us: SPOTLIGHTLY_FEE, them: "5%, or pay $6–8/mo for Ko-fi Gold", usWins: true },
      { label: "Built for recurring, exclusive content", us: "Yes — full subscriptions, tiers, locked posts", them: "Lightweight memberships; a tip jar at heart", usWins: true },
      { label: "Adult content", us: "Yes — a private Backstage page", them: "Not allowed", usWins: true },
      { label: "Crowdfunding + marketplace + merch", us: "Built in", them: "A shop, but no crowdfunding campaigns" },
    ],
    fair:
      "Where Ko-fi wins: for simple one-off tips it's free and frictionless with no monthly cost — if all you want is a tip jar, Ko-fi is hard to beat and you may not need us at all. We're for when you want to build a real paid audience, post adult content, or sell more than a tip.",
  },
  {
    slug: "buy-me-a-coffee",
    name: "Buy Me a Coffee",
    metaTitle: "Buy Me a Coffee Alternative (2026) — Spotlightly vs Buy Me a Coffee",
    metaDesc:
      "A Buy Me a Coffee alternative that doesn't take 5% of everything. Spotlightly takes 0% of your subscriptions, supports adult content, and does far more than a tip button.",
    kicker: "Buy Me a Coffee alternative",
    headline: "A Buy Me a Coffee alternative that doesn't take 5% of everything.",
    subhead: "Buy Me a Coffee charges 5% on every tip, membership, and sale. Spotlightly takes 0% of your subscriptions — a flat plan instead — and does a lot more than a tip button.",
    lede:
      "Buy Me a Coffee is simple and has no monthly fee, but it takes 5% of everything — tips, memberships, sales — and it's safe-for-work only. That 5% is painless when you're earning a little and heavy once you're not. Spotlightly takes nothing from your subscriptions, adds a private adult lane, a marketplace, and crowdfunding campaigns, and gives you real subscription depth instead of a tip button.",
    theirFee: "5% on everything — tips, memberships, sales",
    rows: [
      { label: "Cut of your subscriptions", us: SPOTLIGHTLY_FEE, them: "5%", usWins: true },
      { label: "Cut of your tips", us: "0%", them: "5%", usWins: true },
      { label: "Adult content", us: "Yes — a private Backstage page", them: "Not allowed", usWins: true },
      { label: "Subscription depth", us: "Tiers, locked posts, exclusive content", them: "Memberships + posts, tip-focused" },
      { label: "Crowdfunding + marketplace + merch", us: "Built in", them: "Limited" },
    ],
    fair:
      "Where Buy Me a Coffee wins: it's dead simple, has no monthly fee, and 5% barely registers when you're earning a little — for casual tipping it's lovely and you may not need more. We pull ahead once 5% starts to sting, or you want adult, privacy, or more than tips.",
  },
  {
    slug: "fanfix",
    name: "Fanfix",
    metaTitle: "Fanfix Alternative (2026) — Spotlightly vs Fanfix",
    metaDesc:
      "A Fanfix alternative that takes 0% of your subscriptions (Fanfix takes 20%), has no follower requirement to join, and lets you post adult content privately if you choose.",
    kicker: "Fanfix alternative",
    headline: "A Fanfix alternative that takes 0% of your subscriptions — and lets you in.",
    subhead: "Fanfix takes 20% and won't let you join without 10,000 followers. Spotlightly takes 0% of your subscriptions and is open to creators at any size.",
    lede:
      "Fanfix is a polished, PG-13 platform for Gen Z creators — but it takes a 20% cut, caps your subscription price at $50, and won't let you join until you have 10,000 followers. Spotlightly takes nothing from your subscriptions, has no follower gate, no price cap, and gives you the option of a private adult lane Fanfix's clean policy will never allow.",
    theirFee: "20% commission; PG-13 only; requires 10,000+ followers to join",
    rows: [
      { label: "Cut of your subscriptions", us: SPOTLIGHTLY_FEE, them: "20%", usWins: true },
      { label: "Follower requirement to join", us: "None — start at any size", them: "10,000+ followers required", usWins: true },
      { label: "Subscription price cap", us: "You set it", them: "$5–$50/month cap", usWins: true },
      { label: "Adult content", us: "Yes — a private Backstage page", them: "No — PG-13 only", usWins: true },
      { label: "Audience size today", us: "Newer and smaller", them: "Large Gen Z audience" },
    ],
    fair:
      "Where Fanfix wins: it has a big built-in Gen Z audience and a polished, brand-safe feel mainstream creators like. If you already have 10k+ followers and never want an adult option, it's a credible home. We win on the cut you keep, the open door for smaller creators, and the private adult option.",
  },
  {
    slug: "passes",
    name: "Passes",
    metaTitle: "Passes Alternative (2026) — Spotlightly vs Passes",
    metaDesc:
      "A Passes alternative with no cut on your subscriptions. Passes takes 10%; Spotlightly takes 0% with a flat plan, and adds a private adult lane Passes doesn't offer.",
    kicker: "Passes alternative",
    headline: "A Passes alternative with no cut on your subscriptions.",
    subhead: "Passes takes 10% of what you earn. Spotlightly takes 0% of your subscriptions — a flat plan instead — and adds a private adult lane Passes doesn't have.",
    lede:
      "Passes is a well-funded, feature-rich creator platform with a flat 10% cut. Spotlightly takes nothing from your subscriptions, and pairs a mainstream Spotlight page with a private Backstage one so you can monetize adult content without linking it to your main identity. You give up some of Passes' polish today, but you keep more of every subscription and get a privacy model it doesn't offer.",
    theirFee: "10% of earnings",
    rows: [
      { label: "Cut of your subscriptions", us: SPOTLIGHTLY_FEE, them: "10%", usWins: true },
      { label: "Adult content", us: "Yes — a private Backstage page", them: "Mainstream-focused", usWins: true },
      { label: "Privacy between identities", us: "SFW and adult pages aren't publicly linked unless you choose", them: "One identity", usWins: true },
      { label: "Built-out tooling (CRM, anti-screenshot, AI)", us: "Growing", them: "Established and deep" },
      { label: "Funding / track record", us: "Newer", them: "Well-funded, established" },
    ],
    fair:
      "Where Passes wins: it's well-funded with a deep feature set — a fan CRM, anti-screenshot protection, AI analytics — and far more name recognition than us. If those tools matter most to you, Passes is strong. We compete on keeping your subscription revenue and on an adult lane with real identity privacy.",
  },
];

export default COMPARISONS;
export const getComparison = (slug: string) => COMPARISONS.find((c) => c.slug === slug) ?? null;
export const getAllComparisonSlugs = () => COMPARISONS.map((c) => c.slug);

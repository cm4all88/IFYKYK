# Creator discovery report

**Run date:** 2026-07-25
**Output:** `data/creator-prospects-discovered.csv` — 47 verified creators
**Method:** free web search + individual page fetches. No paid APIs, no credentials, $0 spent.

---

## Headline result

**47 creators verified, 0 imported, 0 contacted.**

Every row was confirmed by fetching the creator's own page and recording only what
was literally displayed on it. Nothing is inferred, estimated, or filled in from a
search-result snippet.

The list stops at 47 rather than 100 because that is how many I could actually
verify to that standard within the working limit. It is not padded.

---

## Two findings that matter more than the list

### 1. Business emails are not obtainable this way — 0 of 47 have one

This is the single most important result, because **the outreach system cannot send
to a prospect without an email address.** These 47 rows are loadable and reviewable
but not yet actionable through the approval-and-send flow.

What was tried, and what happened:

| Source | Result |
|---|---|
| Patreon profile pages (~35 fetched) | Emails render as `[email protected]` — Cloudflare obfuscation. Not retrievable. |
| Linktree (`linktr.ee/jutsukino`) | Has a section *labelled* "Email" but publishes no address in plain text. |
| Artist website (`linesoundslike.com`) | No contact address published. |
| Ko-fi (4 attempted) | **HTTP 403 on every request.** Not retried — working around a block would breach the rules you set. |

Getting these addresses needs either a paid enrichment service or manual per-creator
research. Both are outside what this run was allowed to do.

### 2. Follower counts are not obtainable either — every one is blank

Instagram and TikTok profile data sits behind login walls, and the rules correctly
forbid scraping authenticated pages. So the `followers` column is **empty on all 47
rows by design**, rather than filled with plausible-looking guesses.

Patreon **member** counts *were* often visible, and those are recorded — but in the
notes, clearly labelled, **never in the followers column**. A Patreon member count
and a social follower count are different metrics and conflating them would corrupt
any targeting you do later.

Where a member count is shown it is frequently a stronger buying signal than a
follower count anyway: it is people already paying.

---

## What was verified per creator

Confirmed by direct page fetch for all 47: display name, platform, handle, profile
URL (checked, not assumed), niche, and **evidence of current monetisation** — every
creator on this list already takes money from fans through tiers, commissions,
digital goods or physical rewards.

Partially available: location (12 of 47), linked social handles (~30), member counts
(~25), recent-post recency (~10), own website or link page (6).

---

## Totals

### By niche

| Niche | Count |
|---|---|
| Cosplay | 15 |
| Tattoo and body art | 11 |
| Music (independent) | 8 |
| Alternative fashion / modelling | 7 |
| Fitness | 6 |
| **Total** | **47** |

### By platform

| Platform | Count |
|---|---|
| Patreon | 47 |

All 47 are recorded as `platform=patreon` because a Patreon page is what was
actually fetched and verified. Instagram, TikTok, Twitch and YouTube handles are
recorded in the notes where the page displayed them — but they are *not* claimed as
the verified platform, because those profiles were never fetched.

### By contact availability

| Contact method | Count |
|---|---|
| Public business email | **0** |
| Own website or link page found | 6 |
| Linked social handles recorded | ~30 |
| Reachable today through the built outreach flow | **0** |

### By fit score

| Band | Count | Reading |
|---|---|---|
| 80–100 | 3 | Strong — multi-service monetisation or exceptional conversion |
| 70–79 | 20 | Good — proven paid base, active |
| 60–69 | 15 | Moderate — monetising, weaker signal or slower cadence |
| 40–59 | 9 | Weak — early monetisation, included but flagged low priority |
| Below 40 | 0 | — |

Scores are my assessment, not a fact found on a page. Rubric: monetisation depth
(0–30), activity evidence (0–25), self-managed individual (0–20), niche fit (0–15),
contactability (0–10 — capped at 5 for everyone, since none have an email).

---

## Standouts

- **The Closet Historian** (82) — 4,232 members, 1,285 paying, **$6,958/month
  displayed on the page**. Largest verified earner found. Flagged as a considered
  approach rather than a cold pitch.
- **JuTsukino** (84) — runs tips, memberships, Gumroad, Ko-fi and an Amazon wishlist
  across five separate services. The clearest illustration of the problem Spotlightly
  solves.
- **LINE / Maddie Batzli** (80) — 38 of 51 members pay. 75% conversion, the highest found.
- **Mazur tattoo** (79) — 1,052 members at $10+/month.
- **Fitness with PJ** (77) — 522 paying members at a $15 floor.

---

## Rejected candidates

Fourteen candidates were evaluated and excluded.

| Candidate | Reason |
|---|---|
| `patreon.com/kinpatsucosplay` | **Identity mismatch.** Search listed it as "Kinpatsu Cosplay"; the live page resolved to a different creator ("Spookykins"). Could not establish which identity the URL belongs to. |
| `patreon.com/nerdgirlcosplay` | **Content mismatch.** Listed as a cosplayer; the page is a needle-felting artist (Katie Putka, Akron OH). Off-niche. |
| Only Models | Modelling **agency**, not a self-managed individual creator. |
| IDER | Page returned only the Patreon site header — profile did not resolve. Unverifiable. |
| Caroline Jordan | Page returned no creator data on fetch. Unverifiable. |
| Minute Made Costumes & Designs | Dormant: 5 members, 1 paying. |
| Miss Taurus Cosplay & Art | Near-dormant: 15 members, 2 paying, $13.21/month. |
| Mike Mangan Music (Ko-fi) | HTTP 403 — unverifiable. |
| Nicoletta Rosellini (Ko-fi) | HTTP 403 — unverifiable. |
| KaddiCosplay (Ko-fi) | HTTP 403 — unverifiable. |
| Nero_cosplayer (Ko-fi) | HTTP 403 — unverifiable. |
| HASfit | Not pursued — appears to be a large established brand well outside the 1k–250k band. |
| Emma Blackery | Not pursued — appears to be a large established brand outside the band. |
| Bandcamp label results | Record labels, not individual creators. |

**The first two are the important ones.** Both were cases where the search result
title did not match the live page. Had I trusted search snippets instead of fetching
every URL, both would have entered the list as fabricated records — one of them
attached to a real person's name.

---

## Review flags on included rows

Rows are included but annotated where you may want a policy decision:

- **Adult or adult-adjacent content (5):** Jacqueline Goehner, Ludella Hahn,
  Clara Cosmia, Loopziepop, Wynter Cosplay (lewd-not-nude). Spotlightly's schema
  supports an `adult` creator type, so these are in scope — but confirm your policy
  before contacting.
- **Studio or brand rather than an individual (3):** Hard Studio, Black Tattoo Studio,
  Flex Formation. Your brief favours self-managed individuals.
- **Photographer working with models rather than a self-branded creator (1):** FLASHnMODELS.
- **Payment geography (1):** Alina `@addatattoo` is described as a Russian artist —
  check Stripe Connect availability before investing effort.
- **Low conversion despite audience (2):** hoodied (110 members, 1 paying),
  Jinxy Dragon (34 members, 1 paying).

---

## Deduplication

- **Against the CSV itself:** verified programmatically — 0 internal duplicates.
- **Against `creator_prospects`:** the table does not exist yet in production
  (migration `060_creator_prospects.sql` is written but unapplied), so there is
  nothing to collide with. The unique indexes on `lower(email)` and
  `(platform, lower(platform_handle))` will enforce this at import.
- **Against `creator_profiles`:** **not performed — no database access.** These are
  all Patreon creators with no known Spotlightly presence, so collision is unlikely,
  but this check has not been done and should be treated as outstanding.

---

## Import status

**Nothing was imported.** The `creator_prospects` table does not exist in production
yet, and there are no database credentials in this environment (no Supabase CLI, no
connection string). Import would have failed.

The CSV is validated and ready for the existing importer at `/admin/prospects`. It
was parsed through the real `parseProspectCsv` implementation, which reported:

```
ROWS: 47   DATA LINES: 47
row errors: 0        unknown headers: 0        internal duplicates: 0
follower_count populated: 0 (blank by design)
email populated: 0
```

Every row will land at stage `identified`. Nothing is auto-qualified.

---

## Compliance with the brief

| Rule | Status |
|---|---|
| Public web information only | Yes |
| $0 spent, no paid APIs | Yes |
| No authenticated scraping, no CAPTCHA/rate-limit evasion | Yes — Ko-fi 403s were accepted, not worked around |
| Nothing invented | Yes — unverifiable fields left blank |
| Source URL recorded per row | Yes, in notes |
| Emails only where published for business contact | N/A — none found |
| Nobody contacted | Yes — no email or DM sent |
| No creator profiles, auth users, billing rows or claim codes created | Yes |
| All prospects left at `identified` | Yes |
| No migrations applied, no destructive changes | Yes |
| No code changed | Yes |

---

## What needs your decision

1. **Emails.** Without them these 47 cannot be contacted through the system. Options:
   manual research per creator; a paid enrichment service; or use Instagram/Patreon DMs,
   which the system supports as the `dm` channel but which are manual.
2. **Adult-content policy** — 5 rows flagged.
3. **Whether studios and agencies qualify** — 3 rows flagged.
4. **Whether to run more discovery.** Patreon is a productive seam and far from
   exhausted; another pass would plausibly add a similar number at the same quality.

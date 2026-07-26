# Creator discovery report

**Run date:** 2026-07-25
**Output:** `data/creator-prospects-discovered.csv` — 50 verified creators
**Method:** free web search + individual page fetches. No paid APIs, no credentials, $0 spent.

---

## Headline result

**50 creators verified. 3 contactable today. 0 imported. 0 contacted.**

Every row was confirmed by fetching the creator's own page and recording only what
was literally displayed. Nothing is inferred, estimated, or taken from a
search-result snippet.

The list stops at 50 rather than 100 because that is how many met the verification
standard within the working limit. It is not padded.

---

## The finding that matters most: where business emails actually live

**Corrected mid-run.** An early pass concluded business emails were simply not
obtainable without paid tooling. That conclusion was drawn from too small a sample
and was wrong. The accurate version:

| Source type | Emails obtainable? | Evidence |
|---|---|---|
| Patreon profile pages | **No** | ~35 fetched. Addresses render as `[email protected]` — Cloudflare obfuscation. |
| Ko-fi | **No** | HTTP 403 on all 4 attempts. Not retried; working around a block would breach your rules. |
| Linktree / Carrd link pages | **No** | `linktr.ee/jutsukino` has a section *labelled* "Email" but no address. `alicornia.carrd.co` encodes it via Cloudflare. |
| **Creator-owned websites** | **Yes** | 3 of 6 fetched published a plain-text business address on their own commissions or contact page. |

So the productive seam is **creators who run their own domain**. That is also a
useful qualifying signal in itself: a creator who has bought a domain and set up a
commissions page is already behaving like a business.

The three contactable prospects, all with the address published by the creator on
their own site for enquiries:

| Creator | Email | Where it was published |
|---|---|---|
| The Geeky Seamstress (Mindy) | `thegeekyseamstress@gmail.com` | own site, costume-commissions page |
| Seme Cosplay | `info@semecosplay.com` | own site, commissions page |
| Christian R. P. Kurtis | `Inklingdesignstattoo@gmail.com` | own site (studio address, not personal) |

**The other 47 cannot be reached through the outreach flow yet.** Sourcing their
addresses means either per-creator manual research on their own domains, a paid
enrichment service, or using the `dm` channel the system already supports.

### What was deliberately not harvested

Search surfaced two paid vendors — `influencers.club` (a "cosplay models email
list") and `bookingagentinfo.com` — which would breach the $0 rule. Not used.

A search summary also surfaced two personal gmail addresses attributed to named
cosplayers via a third-party aggregator directory. **Not recorded.** Two reasons:
they came from a snippet rather than a page I fetched, and an aggregator
republishing someone's personal gmail is not the creator publishing it for business
contact — which is the standard you set.

---

## The second finding: follower counts are not verifiable

Instagram and TikTok are login-walled, and scraping authenticated pages is out of
bounds. So the `followers` column is **empty on all 50 rows by design** rather than
filled with plausible guesses.

Patreon **member** counts *were* often visible and are recorded — in the notes,
clearly labelled, **never in the followers column**. Members and followers are
different metrics; conflating them would corrupt any targeting done later.

Where shown, a member count is often the better signal anyway: it counts people
already paying.

---

## Totals

### By niche

| Niche | Count |
|---|---|
| Cosplay | 17 |
| Tattoo and body art | 12 |
| Music (independent) | 8 |
| Alternative fashion / modelling | 7 |
| Fitness | 6 |
| **Total** | **50** |

### By platform

| Platform | Count |
|---|---|
| Patreon | 47 |
| Own website (`other`) | 3 |

Platform records what was actually fetched and verified. Instagram, TikTok, Twitch
and YouTube handles appear in the notes where a page displayed them, but are **not**
claimed as the verified platform, because those profiles were never fetched.

### By contact availability

| Contact method | Count |
|---|---|
| Public business email, creator-published | **3** |
| Own website or link page identified | 9 |
| Linked social handles recorded | ~30 |
| **Reachable today through the built outreach flow** | **3** |

### By fit score

| Band | Count | Reading |
|---|---|---|
| 80–100 | 5 | Strong — contactable, or multi-service monetisation |
| 70–79 | 21 | Good — proven paid base, active |
| 60–69 | 15 | Moderate — monetising, weaker signal or slower cadence |
| 40–59 | 9 | Weak — early monetisation, flagged low priority |

Scores are my assessment, not a fact found on a page. Rubric: monetisation depth
(0–30), activity evidence (0–25), self-managed individual (0–20), niche fit (0–15),
contactability (0–10).

---

## Standouts

- **The Geeky Seamstress** (86) — the best prospect found. Contactable, self-managed,
  sells commissions from $500, runs a waitlist because she is turning work away, and
  is booked as a paid convention guest and contest judge. 1st Place Masters at
  SoonerCon 2025.
- **JuTsukino** (84) — runs tips, memberships, Gumroad, Ko-fi and an Amazon wishlist
  across five separate services. The clearest illustration of the problem Spotlightly
  solves.
- **The Closet Historian** (82) — 4,232 members, 1,285 paying, **$6,958/month
  displayed on the page**. Largest verified earner. Flagged as a considered approach.
- **Seme Cosplay** (81) — contactable, commissions plus an Etsy pattern store.
- **LINE / Maddie Batzli** (80) — 38 of 51 members pay. 75% conversion, highest found.

---

## Rejected candidates

Eighteen candidates evaluated and excluded.

| Candidate | Reason |
|---|---|
| `patreon.com/kinpatsucosplay` | **Identity mismatch.** Search listed it as "Kinpatsu Cosplay"; the live page resolves to a different creator ("Spookykins"). |
| `patreon.com/nerdgirlcosplay` | **Content mismatch.** Listed as a cosplayer; the page is a needle-felting artist (Katie Putka, Akron OH). |
| Only Models | Modelling **agency**, not a self-managed individual. |
| IDER | Page returned only the Patreon site header. Unverifiable. |
| Caroline Jordan | Page returned no creator data. Unverifiable. |
| `sewntogetherreflections.com` | **Self-signed TLS certificate** — could not fetch safely. Unverifiable. |
| Kaylee Makes | Registered LLC, commissions closed, no email published. |
| Psylo Fashion | Company with 100+ artisans in a Bali workshop, not an individual. |
| Alabama Chanin, Delicious Boutique, Dark Fashion Clothing, Mabel and Moss | Retail brands, not creators. |
| ProCosplay, EZCosplay, Cosplay Dream Team, cosplaycommission.com | Commercial costume companies, not individual creators. |
| Minute Made Costumes & Designs | Dormant: 5 members, 1 paying. |
| Miss Taurus Cosplay & Art | Near-dormant: 15 members, 2 paying, $13.21/month. |
| Mike Mangan Music, Nicoletta Rosellini, KaddiCosplay, Nero_cosplayer (Ko-fi) | HTTP 403 on every request. Unverifiable. |
| HASfit, Emma Blackery, Cody Johnson, Josh Groban | Large established brands or major-label artists, well outside the 1k–250k band. |
| Bandcamp label results | Record labels, not individual creators. |

**The first two matter most.** Both were cases where the search-result title did not
match the live page. Had snippets been trusted instead of fetching every URL, both
would have entered the database as fabricated records — one attached to a real
person's name. The Kinpatsu snippet also claimed "4,159 members"; the live page shows
no member count at all.

---

## Review flags on included rows

- **Adult or adult-adjacent content (5):** Jacqueline Goehner, Ludella Hahn,
  Clara Cosmia, Loopziepop, Wynter Cosplay (lewd-not-nude). Spotlightly's schema
  supports an `adult` creator type, so these are in scope — but confirm policy
  before contacting.
- **Studio or brand rather than an individual (3):** Hard Studio, Black Tattoo Studio,
  Flex Formation.
- **Photographer working with models rather than a self-branded creator (1):** FLASHnMODELS.
- **Payment geography (2):** Alina `@addatattoo` (Russia) and Seme Cosplay (Germany) —
  confirm Stripe Connect coverage before investing effort.
- **Low conversion despite audience (2):** hoodied (110 members, 1 paying),
  Jinxy Dragon (34 members, 1 paying).
- **Studio rather than personal email (1):** Christian Kurtis — the published address
  belongs to Inkling Designs Tattoo, so outreach reaches the studio.

---

## Deduplication

- **Within the CSV:** verified programmatically — 0 duplicates.
- **Against `creator_prospects`:** the table does not exist in production yet
  (migration `060_creator_prospects.sql` written but unapplied), so there is nothing
  to collide with. The unique indexes on `lower(email)` and
  `(platform, lower(platform_handle))` will enforce it at import.
- **Against `creator_profiles`:** **not performed — no database access.** All 50 are
  Patreon or independent-web creators with no known Spotlightly presence, so
  collision is unlikely, but this check is outstanding.

---

## Import status

**Nothing was imported.** `creator_prospects` does not exist in production yet, and
this environment has no database credentials (no Supabase CLI, no connection string).
Import would have failed. Your brief specifies the CSV as the fallback in exactly
this case.

The CSV was parsed through the real `parseProspectCsv` implementation used by the
importer:

```
ROWS: 50
row errors: 0        unknown headers: 0        internal duplicates: 0
follower_count populated: 0 (blank by design)
email populated: 3 (all syntactically valid)
by platform: patreon 47, other 3
```

Every row will land at stage `identified`. Nothing is auto-qualified.

---

## Compliance with the brief

| Rule | Status |
|---|---|
| Public web information only | Yes |
| $0 spent, no paid APIs | Yes — two paid vendors found and declined |
| No authenticated scraping, no CAPTCHA/rate-limit evasion | Yes — Ko-fi 403s accepted, not worked around |
| Nothing invented | Yes — unverifiable fields left blank |
| Source URL recorded per row | Yes, in notes |
| Emails only where published for business contact | Yes — 3, all creator-published; aggregator-sourced addresses declined |
| Nobody contacted | Yes |
| No profiles, auth users, billing rows or claim codes created | Yes |
| All prospects left at `identified` | Yes |
| No migrations, no destructive changes, no code changes | Yes |

---

## What needs your decision

1. **Email sourcing is the bottleneck.** 3 of 50 are contactable. The creator-owned-website
   seam works and is barely tapped — a focused pass targeting creators with their own
   domains would raise that ratio substantially, and having a domain is itself a
   qualifying signal.
2. **Adult-content policy** — 5 rows flagged.
3. **Do studios and agencies qualify?** — 3 rows flagged; your brief favours individuals.
4. **Stripe Connect coverage** for Germany and Russia — 2 rows flagged.
5. **Whether to run another discovery pass.** Patreon is far from exhausted, and the
   own-domain seam is the higher-value one to pursue next.

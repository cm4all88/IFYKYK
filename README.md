# Spotlightly

> Your work. Your moment. Your money.

The creator platform that takes 0% of your earnings. Flat monthly fee. You own your audience, your content, and every dollar.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Storage/Video:** BunnyCDN Storage + Stream
- **Payments (SFW):** Stripe Connect
- **Payments (18+):** CCBill (creator's own merchant account)
- **AI:** Claude (advisor, chat moderation, clip captions)
- **Moderation:** Hive AI
- **ID Verification:** Veriff
- **Deployment:** Vercel
- **DNS:** Cloudflare

## Quick Start

```bash
# 1. Clone
git clone https://github.com/your-org/spotlightly.git
cd spotlightly

# 2. Install
npm install

# 3. Set up environment
cp .env.example .env.local
# Fill in all values in .env.local

# 4. Set up Supabase
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push

# 5. Run locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
spotlightly/
├── app/
│   ├── (marketing)/        # Public marketing site — light theme
│   ├── (platform)/         # Creator/fan app — dark theme
│   ├── (auth)/             # Login, signup, verification
│   ├── c/[creator]/        # Public creator pages
│   └── api/                # API routes
├── components/
│   ├── icons/              # Custom Spotlightly SVG icons
│   └── ui/                 # Base components
├── lib/                    # Integrations (Supabase, Stripe, CCBill, etc.)
├── config/                 # Business logic config (tiers, ratings, niches)
├── supabase/migrations/    # Database schema
├── types/                  # TypeScript types
└── hooks/                  # React hooks
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values. See `.env.example` for documentation on each variable.

**Required before launch:**
- Supabase project URL + keys
- Stripe publishable + secret key + webhook secret
- Anthropic API key
- BunnyCDN API key + storage zone

**Required before 18+ content goes live:**
- CCBill merchant credentials
- Veriff API key
- 2257 records custodian designated

**Required before auto-sharing:**
- TikTok API credentials (apply at developers.tiktok.com)
- Instagram/Meta Graph API (apply at developers.facebook.com — takes 1–4 weeks)
- Twitter v2 API (apply at developer.twitter.com)
- RedGIFs API (email dev@redgifs.com)

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Connect repo to Vercel at vercel.com
3. Add all environment variables in Vercel dashboard
4. Deploy — every push to `main` deploys automatically

### GitHub Secrets for CI/CD

Add these to your GitHub repo secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`  
- `VERCEL_PROJECT_ID`

### Custom Domain

1. Add `spotlightly.app` as custom domain in Vercel
2. Point DNS at Vercel nameservers via Cloudflare
3. Creator subdomains (`jadecuts.spotlightly.app`) handled via rewrites in `next.config.ts`

## Compliance Checklist

- [ ] Register DMCA agent at copyright.gov ($6)
- [ ] Attorney review of TOS and Privacy Policy
- [ ] Attorney review of Parental Agreement
- [ ] 2257 custodian of records designated
- [ ] 2257 compliance statement on all 18+ pages
- [ ] Stripe Connect OAuth flow tested
- [ ] CCBill test merchant account approved

## Architecture Notes

### Payment Flow
- **SFW creators** use Stripe Connect. Fan pays creator's Stripe account. Platform fee charged separately.
- **18+ creators** have their own CCBill merchant accounts. Platform is never in the payment chain.
- Platform revenue comes from flat monthly creator subscription fees only.

### Content Rating System
- G/PG/M → Stripe payments
- R/X → CCBill payments (requires Veriff ID verification + 2257 records)
- Young creator accounts hard-blocked from R/X content

### Subdomain Routing
Creator pages at `handle.spotlightly.app` are handled by rewrites in `next.config.ts` → resolves to `/c/[handle]`.

### Channel System
Creators can have multiple channels (e.g., Hair & Style + Dance). Each channel has its own URL (`/c/jade/hair`), QR code, and subscription price. SFW channels use Stripe; 18+ channels use CCBill.

## License

Private — All rights reserved. Tahoma Industries LLC / Spotlightly.

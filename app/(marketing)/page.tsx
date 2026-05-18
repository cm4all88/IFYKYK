import Link from "next/link";
import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Spotlightly · Every creator deserves a spotlight",
  description: "Flat monthly fee. 0% of your earnings. The creator platform built against the 20% tax.",
};

export default function LandingPage() {
  return (
    <main className="lp">
      <SiteHeader variant="marketing" />

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-spotlight" aria-hidden />
        <div className="hero-spotlight-edge" aria-hidden />
        <div className="hero-ambient" aria-hidden />

        <div className="hero-inner">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            The creator platform
          </div>

          <h1 className="hero-title">
            They take <em>20%.</em>
            <span className="hero-title-line2">We take nothing.</span>
          </h1>

          <p className="hero-lede">
            Spotlightly charges a flat monthly fee and takes zero percent
            of what you earn. Your subscriptions, your tips, your revenue —
            yours. One platform, one payout, your whole career.
          </p>

          <div className="hero-actions">
            <Link href="/signup" className="btn btn--primary hero-cta">
              Claim your handle →
            </Link>
            <Link href="/login" className="btn btn--secondary">
              Sign in
            </Link>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-num">0%</span>
              <span className="hero-stat-label">of your earnings</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">$0</span>
              <span className="hero-stat-label">from your tips</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">100%</span>
              <span className="hero-stat-label">yours to keep</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section className="compare">
        <div className="compare-inner">
          <p className="kicker">The honest comparison</p>
          <h2 className="section-h">
            What OnlyFans costs you at <em>real scale.</em>
          </h2>

          <div className="compare-table">
            <div className="compare-header">
              <div />
              <div className="compare-col-head">OnlyFans</div>
              <div className="compare-col-head compare-col-head--spot">Spotlightly</div>
              <div className="compare-col-head compare-col-head--save">You save</div>
            </div>
            {([
              { subs:"500 fans",    gross:"$5,000/mo",   of:"$1,000",  sl:"$99/mo",     save:"$901" },
              { subs:"1,000 fans",  gross:"$10,000/mo",  of:"$2,000",  sl:"$249/mo",    save:"$1,751" },
              { subs:"5,000 fans",  gross:"$50,000/mo",  of:"$10,000", sl:"$999/mo",    save:"$9,001" },
              { subs:"10,000 fans", gross:"$100,000/mo", of:"$20,000", sl:"$1,999/mo",  save:"$18,001" },
            ] as const).map(row => (
              <div className="compare-row" key={row.subs}>
                <div className="compare-label">
                  <span className="compare-subs">{row.subs}</span>
                  <span className="compare-gross">{row.gross} gross</span>
                </div>
                <div className="compare-cell compare-cell--bad">{row.of}</div>
                <div className="compare-cell compare-cell--good">{row.sl}</div>
                <div className="compare-cell compare-cell--save">{row.save}</div>
              </div>
            ))}
          </div>

          <p className="compare-note">
            Based on $9.99/mo subscriptions. OnlyFans takes 20% of every dollar — subscriptions, tips, live, pay-per-view. Every month. Forever.
          </p>

          <div className="compare-breakeven">
            <p className="kicker" style={{ marginBottom: "8px" }}>The breakeven point</p>
            <p className="compare-be-text">
              Spotlightly is cheaper than OnlyFans once you earn more than
              <strong> $145/month</strong> — roughly 15 subscribers at $9.99. After that, every subscriber
              you gain saves you more money vs staying on a 20% platform.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEES ── */}
      <section className="fees">
        <div className="fees-inner">
          <p className="kicker">What you actually pay</p>
          <h2 className="section-h">Completely <em>transparent.</em></h2>

          <div className="fees-grid">
            <div className="fee-block fee-block--creator">
              <p className="fee-block-label">Your monthly Spotlightly fee</p>
              <p className="fee-block-title">Flat. Based on subscribers.</p>
              <p className="fee-block-body">You pay one fee based on how many subscribers you have. Spotlightly takes nothing from your earnings.</p>
              <div className="fee-tiers">
                {([
                  { tier:"Starter", price:"$29/mo",    range:"Up to 100 subscribers" },
                  { tier:"Growth",  price:"$99/mo",    range:"Up to 500 subscribers" },
                  { tier:"Pro",     price:"$249/mo",   range:"Up to 1,000 subscribers" },
                  { tier:"Elite",   price:"$499/mo",   range:"Up to 2,500 subscribers" },
                  { tier:"Premier", price:"$999/mo",   range:"Up to 5,000 subscribers" },
                  { tier:"Icon",    price:"$1,999/mo", range:"Up to 10,000 subscribers" },
                  { tier:"Legend",  price:"$3,499/mo", range:"Unlimited" },
                ] as const).map(t => (
                  <div className="fee-tier" key={t.tier}>
                    <span className="fee-tier-name">{t.tier}</span>
                    <span className="fee-tier-price">{t.price}</span>
                    <span className="fee-tier-range">{t.range}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="fee-block fee-block--stripe">
              <p className="fee-block-label">Payment processing — Stripe</p>
              <p className="fee-block-title">2.9% + 30¢ per transaction.</p>
              <p className="fee-block-body">
                This is Stripe&apos;s fee — not ours. Every platform using Stripe passes this cost on.
                Most don&apos;t tell you. We do. On a $9.99 subscription:
                Stripe takes 59¢, you get $9.40, Spotlightly gets $0.
              </p>
              <div className="stripe-example">
                {([
                  { l:"Fan pays", v:"$9.99", cls:"" },
                  { l:"Stripe fee (2.9% + 30¢)", v:"− $0.59", cls:"stripe-val--bad" },
                  { l:"Spotlightly takes", v:"$0.00", cls:"stripe-val--good" },
                  { l:"You receive", v:"$9.40", cls:"stripe-val--good" },
                ] as const).map((r, i) => (
                  <div key={i} className={`stripe-row${i === 3 ? " stripe-row--total" : ""}`}>
                    <span>{r.l}</span>
                    <span className={`stripe-val ${r.cls}`}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="fee-extras" style={{ marginTop: "var(--s-6)" }}>
            <p className="kicker" style={{ marginBottom: "12px" }}>Fan extras — how Spotlightly earns alongside you</p>
            <p style={{ fontSize: "14px", color: "var(--text-soft)", marginBottom: "16px", lineHeight: "1.7" }}>
              These are optional features fans can buy. Most of them pay you too.
            </p>
            <div className="extras-table">
              {([
                { name:"Front Row Messages", desc:"Fan pays to send a priority DM to your inbox", you:"50%", sl:"50%" },
                { name:"Super Tips",         desc:"Gold border, pinned notification, Top Supporter badge", you:"85%", sl:"15%" },
                { name:"Gift Subscriptions", desc:"Fan gifts your subscription to someone else", you:"90%", sl:"10%" },
                { name:"Early Access Pass",  desc:"$2.99/mo — fan sees your posts 30 min early", you:"—",   sl:"100%" },
                { name:"Comment Boosts",     desc:"$1.99–$9.99 to pin a comment for 24 hours", you:"—",   sl:"100%" },
              ] as const).map(e => (
                <div className="extras-row" key={e.name}>
                  <div className="extras-name">{e.name}</div>
                  <div className="extras-desc">{e.desc}</div>
                  <div className="extras-you">You<br /><strong>{e.you}</strong></div>
                  <div className="extras-sl">Platform<br /><strong>{e.sl}</strong></div>
                </div>
              ))}
            </div>
          </div>

          <div className="fee-live">
            <p className="fee-live-title">Live Streaming</p>
            <p className="fee-live-body">
              Your first hour of every live stream is <strong>always free</strong>. After that:
              <strong> $0.01 per viewer per hour</strong> — billed in 15-minute increments, because streaming at scale has real infrastructure costs.
            </p>
            <div className="live-examples">
              {([
                { viewers:"100 viewers",   cost:"$1/hr after hour 1" },
                { viewers:"500 viewers",   cost:"$5/hr after hour 1" },
                { viewers:"1,000 viewers", cost:"$10/hr after hour 1" },
                { viewers:"5,000 viewers", cost:"$50/hr after hour 1" },
              ] as const).map(e => (
                <div className="live-ex" key={e.viewers}>
                  <span className="live-ex-v">{e.viewers}</span>
                  <span className="live-ex-c">{e.cost}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TIERS ── */}
      <section className="tiers">
        <div className="tiers-inner">
          <p className="kicker">Two stages · One venue</p>
          <h2 className="section-h">Where does <em>your story start?</em></h2>
          <div className="tier-grid">
            <article className="tier tier--spot">
              <div className="tier-rule" />
              <p className="tier-tag">Ages 18+ · Default tier</p>
              <h3 className="tier-name">Spotlight</h3>
              <p className="tier-desc">Center stage. Where careers get built. Subscriptions, tips, locked posts, live, merch. The product you&apos;ll use every day.</p>
              <ul className="tier-feats">
                <li>Your own page + custom handle</li>
                <li>Fan subscriptions — you keep 100%</li>
                <li>Tips — you keep 100%</li>
                <li>Live streaming (first hour free)</li>
                <li>Locked posts, channels, merch</li>
                <li>AI monetization advisor</li>
              </ul>
            </article>
            <article className="tier tier--back">
              <div className="tier-rule" />
              <p className="tier-tag">Ages 18+ verified · Opt-in</p>
              <h3 className="tier-name">Backstage</h3>
              <p className="tier-desc">A completely separate public identity for adult content. Linked to your Spotlight or kept invisible — nobody knows unless you tell them.</p>
              <ul className="tier-feats">
                <li>Separate handle and public profile</li>
                <li>Zero public link to Spotlight (default)</li>
                <li>CCBill for adult content payments</li>
                <li>Age verification + 2257 compliance</li>
                <li>Unified dashboard and single payout</li>
                <li>Your employer will never know</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ── PRIVACY ── */}
      <section className="differentiator">
        <div className="differentiator-inner">
          <div className="diff-text">
            <p className="kicker">The privacy architecture</p>
            <h2 className="section-h">
              One account. Two public faces.
              <br /><em>Your choice which connect.</em>
            </h2>
            <p className="diff-lede">
              The biggest reason creators don&apos;t post adult content isn&apos;t payment processing.
              It&apos;s exposure. Employers, family, mainstream followers.
            </p>
            <p className="diff-body">
              Behind the scenes: one login, one wallet, one payout. Publicly: completely
              separate identities unless you choose to link them. Default is unlinked.
              This is the feature that unlocks careers for teachers, nurses, and anyone with a
              professional identity worth protecting.
            </p>
          </div>
          <div className="diff-states">
            <div className="state state--unlinked">
              <p className="state-tag">🔒 Unlinked · Default</p>
              <p className="state-text">Zero trace on your Spotlight profile. Backstage is only findable through Backstage search or a direct link. Your boss will never know it exists.</p>
            </div>
            <div className="state state--linked">
              <p className="state-tag">🔗 Linked · Opt-in</p>
              <p className="state-text">A Backstage badge appears on your Spotlight. Fans navigate directly. You&apos;re using Backstage as an upsell from your main brand.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLOSING ── */}
      <section className="closing">
        <div className="closing-inner">
          <h2 className="closing-h">We built the <em>whole venue.</em></h2>
          <p className="closing-text">
            Flat fee. Zero cut. Your audience, your earnings, your career.
            Start here. Stay here.
          </p>
          <Link href="/signup" className="btn btn--primary closing-cta">
            Claim your handle →
          </Link>
        </div>
      </section>

      <Footer />

      <style>{`
        @keyframes spotlight-breathe {
          0%   { opacity:0.65; transform:translateX(-50%) scaleX(0.9); }
          100% { opacity:1;    transform:translateX(-50%) scaleX(1.1); }
        }
        @keyframes dot-pulse {
          0%,100% { opacity:1; } 50% { opacity:0.35; }
        }
      `}</style>
    </main>
  );
}

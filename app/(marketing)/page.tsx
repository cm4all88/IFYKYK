import Link from "next/link";
import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Spotlightly · Every creator deserves a spotlight",
  description:
    "Flat monthly fee. You keep everything you earn. The creator platform built against the 20% platforms.",
};

export default function LandingPage() {
  return (
    <main className="lp">
      <SiteHeader variant="marketing" />

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="hero-inner">
          <p className="kicker hero-kicker">Spotlightly · The Creator Platform</p>

          <h1 className="hero-title">
            They take 20%.
            <br />
            <em>We don&apos;t.</em>
          </h1>

          <p className="hero-lede">
            Spotlightly charges a flat monthly fee and takes nothing from what
            you earn. Your subscriptions, your tips, your revenue — yours.
            One platform. One payout. Your whole career.
          </p>

          <div className="hero-actions">
            <Link href="/signup" className="btn btn--primary">
              Claim your handle
            </Link>
            <Link href="/login" className="btn btn--secondary">
              Sign in
            </Link>
          </div>

          <p className="hero-meta">
            Flat monthly fee · 0% of your earnings · You keep it all
          </p>
        </div>
      </section>

      {/* THE COMPARISON */}
      <section className="compare">
        <div className="compare-inner">
          <p className="kicker">The honest comparison</p>
          <h2 className="section-h">
            What OnlyFans costs you at <em>real scale.</em>
          </h2>

          <div className="compare-table">
            <div className="compare-header">
              <div></div>
              <div className="compare-col-head">OnlyFans</div>
              <div className="compare-col-head compare-col-head--spot">Spotlightly</div>
              <div className="compare-col-head compare-col-head--save">You save</div>
            </div>
            {[
              { subs: "500 fans", gross: "$5,000/mo", of: "$1,000", sl: "$99/mo", save: "$901" },
              { subs: "1,000 fans", gross: "$10,000/mo", of: "$2,000", sl: "$249/mo", save: "$1,751" },
              { subs: "5,000 fans", gross: "$50,000/mo", of: "$10,000", sl: "$999/mo", save: "$9,001" },
              { subs: "10,000 fans", gross: "$100,000/mo", of: "$20,000", sl: "$1,999/mo", save: "$18,001" },
            ].map((row) => (
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
            Based on $9.99/mo subscriptions. OnlyFans takes 20% of every dollar — subscriptions, tips, live earnings, pay-per-view. Every month. Forever.
          </p>

          <div className="compare-breakeven">
            <p className="kicker">The breakeven point</p>
            <p className="compare-be-text">
              Spotlightly is cheaper than OnlyFans once you earn more than
              <strong> $145/month</strong> — roughly 15 subscribers at $9.99.
              After that, every dollar you earn saves you money vs a 20% platform.
            </p>
          </div>
        </div>
      </section>

      {/* HONEST FEES */}
      <section className="fees">
        <div className="fees-inner">
          <p className="kicker">What you actually pay</p>
          <h2 className="section-h">
            Completely <em>transparent.</em>
          </h2>

          <div className="fees-grid">
            <div className="fee-block fee-block--creator">
              <p className="fee-block-label">Your monthly Spotlightly fee</p>
              <p className="fee-block-title">Flat. Based on subscribers.</p>
              <p className="fee-block-body">
                You pay one fee based on how many subscribers you have. That&apos;s it.
                We take nothing from your earnings.
              </p>
              <div className="fee-tiers">
                {[
                  { tier: "Starter", price: "$29/mo", range: "Up to 100 subscribers" },
                  { tier: "Growth",  price: "$99/mo", range: "Up to 500 subscribers" },
                  { tier: "Pro",     price: "$249/mo", range: "Up to 1,000 subscribers" },
                  { tier: "Elite",   price: "$499/mo", range: "Up to 2,500 subscribers" },
                  { tier: "Premier", price: "$999/mo", range: "Up to 5,000 subscribers" },
                  { tier: "Icon",    price: "$1,999/mo", range: "Up to 10,000 subscribers" },
                  { tier: "Legend",  price: "$3,499/mo", range: "Unlimited" },
                ].map((t) => (
                  <div className="fee-tier" key={t.tier}>
                    <span className="fee-tier-name">{t.tier}</span>
                    <span className="fee-tier-price">{t.price}</span>
                    <span className="fee-tier-range">{t.range}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="fee-block fee-block--stripe">
              <p className="fee-block-label">Payment processing (Stripe)</p>
              <p className="fee-block-title">2.9% + 30¢ per transaction.</p>
              <p className="fee-block-body">
                This is Stripe&apos;s fee — not ours. Every platform using Stripe passes this cost on,
                most just don&apos;t tell you. On a $9.99 subscription:
                Stripe takes 59¢. You get $9.40. Spotlightly gets nothing.
              </p>
              <div className="stripe-example">
                <div className="stripe-row">
                  <span>Fan pays</span>
                  <span className="stripe-val">$9.99</span>
                </div>
                <div className="stripe-row">
                  <span>Stripe fee (2.9% + 30¢)</span>
                  <span className="stripe-val stripe-val--bad">− $0.59</span>
                </div>
                <div className="stripe-row">
                  <span>Spotlightly fee</span>
                  <span className="stripe-val stripe-val--good">$0.00</span>
                </div>
                <div className="stripe-row stripe-row--total">
                  <span>You receive</span>
                  <span className="stripe-val stripe-val--good">$9.40</span>
                </div>
              </div>
            </div>
          </div>

          <div className="fee-extras">
            <p className="kicker" style={{ marginBottom: "14px" }}>Fan extras — how Spotlightly earns alongside you</p>
            <p style={{ fontSize: "14px", color: "rgba(232,232,240,0.65)", marginBottom: "20px", lineHeight: "1.7" }}>
              These are optional features fans can buy. They&apos;re where Spotlightly makes most of its revenue —
              not from your earnings.
            </p>
            <div className="extras-table">
              {[
                { name: "Front Row Messages", desc: "Fan pays to send a priority DM that surfaces above the rest in your inbox", you: "50%", sl: "50%" },
                { name: "Super Tips", desc: "Gold border, pinned notification, 30-day Top Supporter badge", you: "85%", sl: "15%" },
                { name: "Early Access Pass", desc: "$2.99/mo — fan sees your posts 30 min before everyone else", you: "—", sl: "100%" },
                { name: "Comment Boosts", desc: "$1.99–$9.99 to pin a comment for 24 hours", you: "—", sl: "100%" },
                { name: "Gift Subscriptions", desc: "Fan gifts your subscription to a friend — 90% of the gift goes to you", you: "90%", sl: "10%" },
              ].map((e) => (
                <div className="extras-row" key={e.name}>
                  <div className="extras-name">{e.name}</div>
                  <div className="extras-desc">{e.desc}</div>
                  <div className="extras-you">You get<br /><strong>{e.you}</strong></div>
                  <div className="extras-sl">Spotlightly<br /><strong>{e.sl}</strong></div>
                </div>
              ))}
            </div>
          </div>

          <div className="fee-live">
            <p className="fee-live-title">Live Streaming</p>
            <p className="fee-live-body">
              Your first hour of every live stream is <strong>always free</strong>.
              After that, it&apos;s <strong>$0.01 per viewer per hour</strong> — because streaming at scale
              has real infrastructure costs. At 1,000 viewers, that&apos;s $10/hour.
              While those 1,000 people are sending tips and Front Row Messages,
              you&apos;re making far more than that.
            </p>
            <div className="live-examples">
              {[
                { viewers: "100 viewers", cost: "$1/hr after hour 1" },
                { viewers: "500 viewers", cost: "$5/hr after hour 1" },
                { viewers: "1,000 viewers", cost: "$10/hr after hour 1" },
                { viewers: "5,000 viewers", cost: "$50/hr after hour 1" },
              ].map((e) => (
                <div className="live-ex" key={e.viewers}>
                  <span className="live-ex-v">{e.viewers}</span>
                  <span className="live-ex-c">{e.cost}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TIERS */}
      <section className="tiers">
        <div className="tiers-inner">
          <p className="kicker">Two Stages · One Venue</p>
          <h2 className="section-h">
            Where does <em>your story start?</em>
          </h2>

          <div className="tier-grid">
            <article className="tier tier--spot">
              <div className="tier-rule" />
              <p className="tier-tag">Ages 18+ · Default tier</p>
              <h3 className="tier-name">Spotlight</h3>
              <p className="tier-desc">
                Center stage. Where most careers get built. Subscriptions, tips,
                locked posts, live, merch. The product you&apos;ll use every day.
              </p>
              <ul className="tier-feats">
                <li>Your own creator page + handle</li>
                <li>Subscriptions — you keep 100%</li>
                <li>Tips — you keep 100%</li>
                <li>Live streaming (1hr free, then viewer-based)</li>
                <li>Locked posts, channels, merch</li>
              </ul>
            </article>

            <article className="tier tier--back">
              <div className="tier-rule" />
              <p className="tier-tag">Ages 18+ verified · Opt-in</p>
              <h3 className="tier-name">Backstage</h3>
              <p className="tier-desc">
                A completely separate public identity for adult content.
                Linked to your Spotlight or kept totally private — your call.
                Your employer will never know it exists unless you tell them.
              </p>
              <ul className="tier-feats">
                <li>Separate handle and public profile</li>
                <li>Linked or unlinked from Spotlight</li>
                <li>CCBill for adult content payments</li>
                <li>Age verification + 2257 records handled</li>
                <li>Unified dashboard, one bank account</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* PRIVACY */}
      <section className="differentiator">
        <div className="differentiator-inner">
          <div className="diff-text">
            <p className="kicker">The Privacy Architecture</p>
            <h2 className="section-h">
              One account. Two public faces.
              <br />
              <em>Your choice which ones connect.</em>
            </h2>
            <p className="diff-lede">
              The biggest reason creators don&apos;t post adult content isn&apos;t payment processing.
              It&apos;s exposure. Employers, family, mainstream followers.
            </p>
            <p className="diff-body">
              Behind the scenes, your Spotlight and Backstage are unified — one login, one wallet,
              one payout. Publicly, they&apos;re completely separate unless you choose to link them.
              Default is unlinked.
            </p>
          </div>

          <div className="diff-states">
            <div className="state state--unlinked">
              <p className="state-tag">🔒 Unlinked · Default</p>
              <p className="state-text">
                Zero trace on your Spotlight profile. Your Backstage is only
                discoverable through Backstage search or direct link.
                Your boss will never know it exists.
              </p>
            </div>
            <div className="state state--linked">
              <p className="state-tag">🔗 Linked · Opt-in</p>
              <p className="state-text">
                A Backstage badge appears on your Spotlight. Fans navigate directly.
                You&apos;re using Backstage as an upsell from your main brand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="closing">
        <div className="closing-inner">
          <h2 className="closing-h">
            We built the <em>whole venue.</em>
          </h2>
          <p className="closing-text">
            Flat fee. Zero cut. Your audience, your earnings, your career.
            Start here. Stay here.
          </p>
          <Link href="/signup" className="btn btn--primary closing-cta">
            Claim your handle
          </Link>
        </div>
      </section>

      <Footer />

      <style>{`
        /* ── COMPARE ── */
        .compare { padding: var(--s-20) var(--s-6); border-top: 1px solid var(--border); }
        .compare-inner { max-width: var(--container); margin: 0 auto; }
        .compare-table { margin-top: var(--s-10); border: 1px solid var(--border); border-radius: var(--r-3); overflow: hidden; }
        .compare-header {
          display: grid; grid-template-columns: 1fr 140px 140px 140px;
          gap: 0; background: var(--surface-2);
          border-bottom: 1px solid var(--border);
          padding: var(--s-3) var(--s-5);
        }
        .compare-col-head {
          font-family: var(--font-mono); font-size: 10px; letter-spacing: .15em;
          text-transform: uppercase; color: var(--muted); text-align: center;
        }
        .compare-col-head--spot { color: var(--accent); }
        .compare-col-head--save { color: var(--accent-open); }
        .compare-row {
          display: grid; grid-template-columns: 1fr 140px 140px 140px;
          padding: var(--s-4) var(--s-5);
          border-bottom: 1px solid rgba(255,255,255,.04);
          align-items: center;
        }
        .compare-row:last-child { border-bottom: none; }
        .compare-row:hover { background: rgba(255,255,255,.02); }
        .compare-label { display: flex; flex-direction: column; gap: 2px; }
        .compare-subs { font-size: 14px; color: var(--text); font-weight: 500; }
        .compare-gross { font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
        .compare-cell { text-align: center; font-family: var(--font-mono); font-size: 13px; }
        .compare-cell--bad { color: var(--red); }
        .compare-cell--good { color: var(--accent); }
        .compare-cell--save { color: var(--accent-open); font-weight: 500; }
        .compare-note { font-size: 12px; color: var(--muted); margin-top: var(--s-4); line-height: 1.7; }
        .compare-breakeven {
          background: var(--surface); border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          padding: var(--s-5) var(--s-6); margin-top: var(--s-8);
        }
        .compare-be-text { font-size: 14px; color: rgba(232,232,240,.8); line-height: 1.75; margin-top: var(--s-2); }
        .compare-be-text strong { color: var(--accent); }

        /* ── FEES ── */
        .fees { padding: var(--s-20) var(--s-6); border-top: 1px solid var(--border); background: var(--bg-elevated); }
        .fees-inner { max-width: var(--container); margin: 0 auto; }
        .fees-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-top: var(--s-10); }
        .fee-block { background: var(--surface); border: 1px solid var(--border); padding: var(--s-8) var(--s-6); position: relative; }
        .fee-block::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; }
        .fee-block--creator::before { background: var(--accent); }
        .fee-block--stripe::before { background: #635bff; }
        .fee-block-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); margin-bottom: var(--s-3); }
        .fee-block-title { font-family: var(--font-serif); font-size: 24px; font-weight: 400; color: #fff; margin-bottom: var(--s-3); line-height: 1.1; }
        .fee-block-body { font-size: 13px; color: var(--text-soft); line-height: 1.75; margin-bottom: var(--s-6); }
        .fee-tiers { display: flex; flex-direction: column; gap: 2px; }
        .fee-tier {
          display: grid; grid-template-columns: 70px 80px 1fr;
          padding: var(--s-2) var(--s-3);
          background: var(--surface-2);
          border: 1px solid var(--border);
          font-size: 12px; align-items: center; gap: var(--s-3);
        }
        .fee-tier-name { font-family: var(--font-mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
        .fee-tier-price { font-family: var(--font-mono); font-size: 12px; color: var(--accent); }
        .fee-tier-range { font-size: 11px; color: var(--muted); }

        .stripe-example { display: flex; flex-direction: column; gap: 2px; }
        .stripe-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--s-2) var(--s-3); background: var(--surface-2);
          border: 1px solid var(--border); font-size: 13px; color: var(--text-soft);
        }
        .stripe-row--total { border-top: 1px solid var(--border-strong); background: var(--surface-3); }
        .stripe-val { font-family: var(--font-mono); font-size: 13px; color: var(--text); }
        .stripe-val--bad { color: var(--red); }
        .stripe-val--good { color: var(--accent-open); }

        .fee-extras { margin-top: var(--s-10); background: var(--surface); border: 1px solid var(--border); padding: var(--s-6); }
        .extras-table { display: flex; flex-direction: column; gap: 2px; }
        .extras-row {
          display: grid; grid-template-columns: 180px 1fr 80px 100px;
          gap: var(--s-4); padding: var(--s-3) var(--s-4);
          background: var(--surface-2); border: 1px solid var(--border);
          align-items: center;
        }
        .extras-name { font-size: 13px; color: var(--text); font-weight: 500; }
        .extras-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }
        .extras-you, .extras-sl {
          font-family: var(--font-mono); font-size: 10px; text-align: center;
          color: var(--muted); letter-spacing: .05em;
          line-height: 1.8;
        }
        .extras-you strong { display: block; color: var(--accent-open); font-size: 13px; }
        .extras-sl strong { display: block; color: var(--accent); font-size: 13px; }

        .fee-live {
          margin-top: var(--s-6); background: var(--surface);
          border: 1px solid var(--border); border-left: 3px solid var(--red);
          padding: var(--s-6);
        }
        .fee-live-title { font-family: var(--font-serif); font-size: 22px; font-weight: 400; color: #fff; margin-bottom: var(--s-3); }
        .fee-live-body { font-size: 13px; color: var(--text-soft); line-height: 1.75; margin-bottom: var(--s-5); }
        .fee-live-body strong { color: var(--text); font-weight: 500; }
        .live-examples { display: flex; gap: 2px; flex-wrap: wrap; }
        .live-ex {
          display: flex; flex-direction: column; gap: 4px;
          background: var(--surface-2); border: 1px solid var(--border);
          padding: var(--s-3) var(--s-4); flex: 1; min-width: 140px;
        }
        .live-ex-v { font-family: var(--font-mono); font-size: 10px; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
        .live-ex-c { font-size: 13px; color: var(--accent); font-weight: 500; }

        @media (max-width: 760px) {
          .fees-grid { grid-template-columns: 1fr; }
          .compare-header, .compare-row { grid-template-columns: 1fr 80px 100px 80px; font-size: 11px; }
          .extras-row { grid-template-columns: 1fr; }
          .fee-tier { grid-template-columns: 70px 70px 1fr; }
        }
      `}</style>
    </main>
  );
}

import Link from "next/link";
import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Spotlightly — Every creator deserves a spotlight",
  description: "Your work. Your moment. Your money. The creator platform built for your whole career.",
};

export default function LandingPage() {
  return (
    <main className="lp">
      <SiteHeader variant="marketing" />

      {/* ── HERO ── The feeling first. */}
      <section className="hero">
        <div className="hero-spotlight" aria-hidden />
        <div className="hero-spotlight-edge" aria-hidden />
        <div className="hero-ambient" aria-hidden />

        <div className="hero-inner">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Built for creators, by design
          </div>

          <h1 className="hero-title">
            Every creator deserves<br />
            <em>a spotlight.</em>
          </h1>

          <p className="hero-lede">
            Your audience is out there. Your work is ready.
            Spotlightly is the venue — built for your whole career,
            from your first post to your most exclusive content.
          </p>

          <div className="hero-actions">
            <Link href="/signup" className="btn btn--primary hero-cta">
              Claim your handle →
            </Link>
            <Link href="/login" className="btn btn--secondary">
              Sign in
            </Link>
          </div>

          <div className="hero-venue">
            <div className="hero-stage hero-stage--spot">
              <span className="hero-stage-name">Spotlight</span>
              <span className="hero-stage-desc">Your main stage. SFW, full monetization, every format.</span>
            </div>
            <div className="hero-stage-plus">+</div>
            <div className="hero-stage hero-stage--back">
              <span className="hero-stage-name">Backstage</span>
              <span className="hero-stage-desc">A separate identity for adult content. Linked or invisible — your call.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE VENUE ── What this place is. */}
      <section className="venue-section">
        <div className="venue-inner">
          <p className="kicker">The venue metaphor</p>
          <h2 className="section-h">We built the <em>whole venue.</em></h2>
          <p className="venue-lede">
            Every great performer needs a stage. Spotlightly is yours —
            a professional, fully-equipped venue where you control every
            aspect of your presence and every dollar you earn.
          </p>

          <div className="venue-cards">
            <div className="venue-card venue-card--spot">
              <div className="venue-card-rule" />
              <div className="venue-card-tag">Spotlight</div>
              <h3 className="venue-card-title">Center stage.</h3>
              <p className="venue-card-body">
                Your public page. Your custom handle. Your audience.
                Subscriptions, tips, locked posts, live streams, merchandise —
                the full stack for building a career. This is where most
                creators spend every day of their professional life.
              </p>
              <ul className="venue-card-feats">
                <li>Custom handle + public page</li>
                <li>Subscriptions and locked content</li>
                <li>Tips — you keep every dollar</li>
                <li>Live streaming</li>
                <li>Merch store via Spotlightly</li>
                <li>AI monetization advisor</li>
              </ul>
            </div>

            <div className="venue-card venue-card--back">
              <div className="venue-card-rule" />
              <div className="venue-card-tag">Backstage</div>
              <h3 className="venue-card-title">The other side of the curtain.</h3>
              <p className="venue-card-body">
                A completely separate public identity for adult content.
                Your Spotlight and Backstage share one dashboard, one wallet,
                one payout — but publicly, they&apos;re invisible to each other
                unless you choose to connect them.
              </p>
              <ul className="venue-card-feats">
                <li>Separate handle and public profile</li>
                <li>Zero public connection to Spotlight (default)</li>
                <li>Age verification + 2257 compliance</li>
                <li>CCBill for adult content payments</li>
                <li>One login, one wallet, one bank account</li>
                <li>Your employer will never know it exists</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRIVACY — The feature that unlocks careers ── */}
      <section className="privacy-section">
        <div className="privacy-inner">
          <p className="kicker">The privacy architecture</p>
          <h2 className="section-h">
            One account. Two public faces.<br />
            <em>Your choice which connect.</em>
          </h2>

          <div className="privacy-body">
            <div className="privacy-text">
              <p>
                The single biggest reason creators don&apos;t post adult content
                isn&apos;t legal complexity or payment processing.
                It&apos;s <strong>exposure</strong> — employers, family, mainstream followers.
              </p>
              <p>
                Spotlightly solved this with an architecture no competitor
                has thought through this carefully. Behind the scenes, everything
                is unified. Publicly, your Spotlight and Backstage are treated
                as completely separate entities — unless you explicitly choose
                to connect them. Default is unlinked.
              </p>
              <p>
                This is the feature that makes careers possible for teachers,
                nurses, corporate professionals, and anyone with a public
                identity worth protecting.
              </p>
            </div>

            <div className="privacy-states">
              <div className="state state--unlinked">
                <p className="state-tag">🔒 Unlinked · Default</p>
                <p className="state-text">
                  Zero trace on your Spotlight profile. Your Backstage exists
                  and fans can find it — but your boss, your family, and your
                  mainstream followers will never know it does.
                </p>
              </div>
              <div className="state state--linked">
                <p className="state-tag">🔗 Linked · Opt-in</p>
                <p className="state-text">
                  A Backstage badge appears on your Spotlight. Fans navigate
                  directly. Use it as an upsell from your main brand when
                  you want to.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE MONEY TRUTH — Pricing, honest and last ── */}
      <section className="money-section">
        <div className="money-inner">
          <p className="kicker">How you get paid</p>
          <h2 className="section-h">They take 20%. <em>We don&apos;t.</em></h2>

          <div className="money-split">
            <div className="money-left">
              <p className="money-lead">
                Spotlightly charges a <strong>flat monthly fee</strong> based on
                your subscriber count and takes <strong>zero percent</strong> of
                your earnings. Your subscriptions and tips are yours.
              </p>
              <p className="money-sub">
                OnlyFans takes 20% of everything — forever.
                At 1,000 subscribers, that&apos;s $2,000 a month they keep.
                On Spotlightly, you&apos;d pay $249 and keep the rest.
              </p>

              <div className="breakeven-pill">
                Spotlightly becomes cheaper than OnlyFans at just
                <strong> $145/month in gross revenue</strong> — roughly 15 subscribers.
              </div>
            </div>

            <div className="money-right">
              <div className="compare-table">
                <div className="compare-header">
                  <div />
                  <div className="compare-col-head">OnlyFans</div>
                  <div className="compare-col-head compare-col-head--spot">Spotlightly</div>
                  <div className="compare-col-head compare-col-head--save">You save</div>
                </div>
                {([
                  { subs:"500 fans",    gross:"$5,000/mo",   of:"$1,000",  sl:"$99/mo",    save:"$901" },
                  { subs:"1,000 fans",  gross:"$10,000/mo",  of:"$2,000",  sl:"$249/mo",   save:"$1,751" },
                  { subs:"5,000 fans",  gross:"$50,000/mo",  of:"$10,000", sl:"$999/mo",   save:"$9,001" },
                  { subs:"10,000 fans", gross:"$100,000/mo", of:"$20,000", sl:"$1,999/mo", save:"$18,001" },
                ] as const).map(row => (
                  <div className="compare-row" key={row.subs}>
                    <div className="compare-label">
                      <span className="compare-subs">{row.subs}</span>
                      <span className="compare-gross">{row.gross}</span>
                    </div>
                    <div className="compare-cell compare-cell--bad">{row.of}</div>
                    <div className="compare-cell compare-cell--good">{row.sl}</div>
                    <div className="compare-cell compare-cell--save">{row.save}</div>
                  </div>
                ))}
              </div>
              <p className="compare-note">Based on $9.99/mo subscriptions. OnlyFans takes 20% of all earnings.</p>
            </div>
          </div>

          {/* Fan extras */}
          <div className="extras-note">
            <p className="kicker" style={{ marginBottom: 12 }}>How Spotlightly earns alongside you</p>
            <p style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.75, maxWidth: 680 }}>
              Platform revenue comes from optional fan purchases — Front Row Messages (50/50 split with you),
              Super Tips (85% to you), Comment Boosts, and Early Access Passes.
              <strong style={{ color: "var(--text)" }}> We make money when your fans want to do more, not by taxing what you already earn.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ── CLOSING ── */}
      <section className="closing">
        <div className="closing-inner">
          <h2 className="closing-h">Your stage is <em>waiting.</em></h2>
          <p className="closing-text">
            Start with Spotlight. Add Backstage when you&apos;re ready.
            Your whole career, one venue.
          </p>
          <Link href="/signup" className="btn btn--primary closing-cta">
            Claim your handle →
          </Link>
        </div>
      </section>

      <Footer />

      <style>{`
        /* VENUE SECTION */
        .venue-section { padding: var(--s-24) var(--s-6); border-top: 1px solid var(--border); }
        .venue-inner { max-width: var(--container-wide); margin: 0 auto; }
        .venue-lede {
          font-size: 18px; line-height: 1.75; color: var(--text-soft);
          max-width: 620px; margin: 0 0 var(--s-12);
        }
        .venue-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
        .venue-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-3); padding: var(--s-10) var(--s-8);
          position: relative; overflow: hidden;
          transition: border-color var(--t-base), transform var(--t-base), box-shadow var(--t-base);
        }
        .venue-card:hover { transform: translateY(-3px); }
        .venue-card--spot:hover { border-color: var(--accent-border); box-shadow: 0 8px 60px rgba(240,180,41,0.08); }
        .venue-card--back:hover { border-color: rgba(168,85,247,0.25); box-shadow: 0 8px 60px rgba(168,85,247,0.07); }
        .venue-card-rule { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
        .venue-card--spot .venue-card-rule { background: linear-gradient(90deg, var(--accent), var(--accent-bright)); }
        .venue-card--back .venue-card-rule { background: linear-gradient(90deg, var(--accent-back), #C084FC); }
        .venue-card-tag {
          font-family: var(--font-mono); font-size: 10px; letter-spacing: .2em;
          text-transform: uppercase; margin-bottom: var(--s-3);
        }
        .venue-card--spot .venue-card-tag { color: var(--accent); }
        .venue-card--back .venue-card-tag { color: var(--accent-back); }
        .venue-card-title {
          font-family: var(--font-display); font-size: 32px; font-weight: 800;
          letter-spacing: -0.03em; color: #fff; margin: 0 0 var(--s-4); line-height: 1.05;
        }
        .venue-card-body {
          font-size: 14px; line-height: 1.8; color: var(--text-soft); margin: 0 0 var(--s-6);
        }
        .venue-card-feats { list-style: none; padding: 0; margin: 0; border-top: 1px solid var(--border); padding-top: var(--s-5); }
        .venue-card-feats li {
          font-size: 13px; color: var(--text-soft); padding: 7px 0 7px var(--s-5);
          position: relative; line-height: 1.5;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .venue-card-feats li:last-child { border-bottom: none; }
        .venue-card-feats li::before { content: "—"; position: absolute; left: 0; color: var(--muted-faint); }

        /* HERO VENUE STRIP */
        .hero-venue {
          display: flex; align-items: center; gap: var(--s-4);
          justify-content: center; flex-wrap: wrap;
          margin-top: var(--s-10);
        }
        .hero-stage {
          display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
          padding: 14px 20px; border: 1px solid var(--border);
          border-radius: var(--r-3); background: rgba(255,255,255,0.03);
          backdrop-filter: blur(8px); max-width: 240px; text-align: left;
        }
        .hero-stage--spot { border-color: var(--accent-border); }
        .hero-stage--back { border-color: rgba(168,85,247,0.2); }
        .hero-stage-name {
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          letter-spacing: 0.01em;
        }
        .hero-stage--spot .hero-stage-name { color: var(--accent); }
        .hero-stage--back .hero-stage-name { color: var(--accent-back); }
        .hero-stage-desc { font-size: 11px; color: var(--muted); line-height: 1.5; }
        .hero-stage-plus {
          font-size: 24px; color: var(--muted-faint); font-weight: 300;
          flex-shrink: 0;
        }

        /* PRIVACY SECTION */
        .privacy-section { padding: var(--s-24) var(--s-6); border-top: 1px solid var(--border); background: var(--bg-elevated); }
        .privacy-inner { max-width: var(--container-wide); margin: 0 auto; }
        .privacy-body {
          display: grid; grid-template-columns: 1.1fr 1fr; gap: var(--s-16);
          align-items: start; margin-top: var(--s-4);
        }
        .privacy-text p {
          font-size: 15px; line-height: 1.85; color: var(--text-soft);
          margin-bottom: var(--s-5);
        }
        .privacy-text p:last-child { margin-bottom: 0; }
        .privacy-text strong { color: var(--text); font-weight: 600; }
        .privacy-states { display: flex; flex-direction: column; gap: 2px; }

        /* MONEY SECTION */
        .money-section { padding: var(--s-24) var(--s-6); border-top: 1px solid var(--border); }
        .money-inner { max-width: var(--container-wide); margin: 0 auto; }
        .money-split {
          display: grid; grid-template-columns: 1fr 1.2fr; gap: var(--s-12);
          align-items: start; margin-top: var(--s-4);
        }
        .money-lead {
          font-size: 17px; line-height: 1.8; color: var(--text-soft); margin-bottom: var(--s-4);
        }
        .money-lead strong { color: var(--text); font-weight: 600; }
        .money-sub {
          font-size: 14px; line-height: 1.75; color: var(--text-faint); margin-bottom: var(--s-6);
        }
        .breakeven-pill {
          background: var(--accent-soft); border: 1px solid var(--accent-border);
          border-radius: var(--r-3); padding: var(--s-4) var(--s-5);
          font-size: 13px; color: var(--text-soft); line-height: 1.7;
        }
        .breakeven-pill strong { color: var(--accent-bright); font-weight: 700; }
        .extras-note {
          margin-top: var(--s-10); padding-top: var(--s-10);
          border-top: 1px solid var(--border);
        }

        @media (max-width: 860px) {
          .venue-cards { grid-template-columns: 1fr; }
          .privacy-body { grid-template-columns: 1fr; gap: var(--s-8); }
          .money-split { grid-template-columns: 1fr; }
          .hero-venue { flex-direction: column; align-items: center; }
          .hero-stage { max-width: 100%; width: 100%; }
          .hero-stage-plus { transform: rotate(90deg); }
        }
      `}</style>
    </main>
  );
}

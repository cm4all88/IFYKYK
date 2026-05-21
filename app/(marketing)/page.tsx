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

      {/* ── PLATFORM REALITY — The money problem with social ── */}
      <section className="reality-section">
        <div className="reality-inner">
          <p className="kicker">The problem with social platforms</p>
          <h2 className="section-h">
            You built the audience.<br />
            <em>They kept the money.</em>
          </h2>
          <p style={{ fontSize:17, color:"var(--text-soft)", lineHeight:1.75, maxWidth:620, marginBottom:"var(--s-12)" }}>
            TikTok, Instagram, and Twitter need your content to survive.
            You post every day. They sell ads against it.
            The math on what they pay back is almost insulting.
          </p>

          <div className="reality-grid">
            <div className="reality-card reality-card--bad">
              <div className="reality-platform">TikTok</div>
              <div className="reality-pay">$0.02–$0.04</div>
              <div className="reality-unit">per 1,000 views</div>
              <div className="reality-note">
                A video with 1 million views pays you $20–$40.
                TikTok made far more than that selling ads against it.
              </div>
            </div>

            <div className="reality-card reality-card--bad">
              <div className="reality-platform">Instagram</div>
              <div className="reality-pay">Today.</div>
              <div className="reality-unit">subscriptions can be cancelled tomorrow</div>
              <div className="reality-note">
                Meta can cancel Instagram subscriptions the same way
                they cancelled the Reels Play Bonus — overnight, no warning,
                your income gone. If your livelihood depends on a feature
                a platform controls, it was never really yours.
              </div>
            </div>

            <div className="reality-card reality-card--bad">
              <div className="reality-platform">X / Twitter</div>
              <div className="reality-pay">Minimal</div>
              <div className="reality-unit">requires X Premium + massive reach</div>
              <div className="reality-note">
                Ad revenue share requires a paid subscription and
                millions of impressions. Most creators see almost nothing.
              </div>
            </div>

            <div className="reality-card reality-card--good">
              <div className="reality-platform">Spotlightly</div>
              <div className="reality-pay">100%</div>
              <div className="reality-unit">of what your fans pay</div>
              <div className="reality-note">
                Your audience is already there. Spotlightly is where
                they pay you directly — subscriptions, tips, exclusive
                content. You set the price. You keep the money.
              </div>
            </div>
          </div>

          <div style={{ background:"rgba(239,68,68,0.05)", border:"1px solid var(--red-border)", borderRadius:"var(--r-2)", padding:"var(--s-4) var(--s-6)", marginBottom:"var(--s-4)", fontSize:14, color:"var(--text-soft)", lineHeight:1.75 }}>
            <strong style={{ color:"var(--red)" }}>Platform risk is real.</strong>{" "}
            TikTok nearly got banned in the US. Instagram killed the Reels bonus.
            Twitter changed its monetization rules multiple times in a year.
            When your income depends on a feature a platform controls,
            they can take it away without warning.{" "}
            <strong style={{ color:"var(--text)" }}>Your Spotlightly page is yours. Nobody can cancel it.</strong>
          </div>

          <div className="reality-strategy">
            <div className="reality-strategy-head">The strategy that works</div>
            <div className="reality-strategy-steps">
              <div className="reality-step">
                <span className="reality-step-num">1</span>
                <div>
                  <strong>Post on TikTok, Instagram, YouTube</strong> — build your audience where the discovery happens. Those platforms are great for reach.
                </div>
              </div>
              <div className="reality-step-arrow">→</div>
              <div className="reality-step">
                <span className="reality-step-num">2</span>
                <div>
                  <strong>Put your Spotlightly link in your bio</strong> — one URL replaces Linktree and does something Linktree can't: it lets fans subscribe and pay you directly.
                </div>
              </div>
              <div className="reality-step-arrow">→</div>
              <div className="reality-step">
                <span className="reality-step-num">3</span>
                <div>
                  <strong>Post your best work on Spotlightly</strong> — the content your fans will actually pay for. Subscribers get it. Everyone else gets a preview.
                </div>
              </div>
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

      {/* ── CREATOR CONTROL — Know your fans, own your space ── */}
      <section className="control-section">
        <div className="control-inner">
          <p className="kicker">Creator safety & control</p>
          <h2 className="section-h">
            You know exactly<br />
            <em>who's in the room.</em>
          </h2>
          <p style={{ fontSize:17, color:"var(--text-soft)", lineHeight:1.75, maxWidth:620, marginBottom:"var(--s-12)" }}>
            Every fan who subscribes verifies their identity — email and phone number,
            confirmed before they access your content. Not anonymous. Not throwaway accounts.
            Real people, accountable to their information.
          </p>

          <div className="control-grid">
            <div className="control-card">
              <div className="control-icon">👤</div>
              <h3 className="control-title">Know who your fans are</h3>
              <p className="control-body">
                Every subscriber verifies their email and phone number at signup.
                You see your audience as real, accountable people — not anonymous usernames.
              </p>
            </div>
            <div className="control-card">
              <div className="control-icon">🚫</div>
              <h3 className="control-title">Block anyone, instantly</h3>
              <p className="control-body">
                Block a specific fan and they&apos;re gone — from your page, your messages,
                your subscriber list. No appeal process. Your space, your rules.
              </p>
            </div>
            <div className="control-card">
              <div className="control-icon">🌍</div>
              <h3 className="control-title">Block entire regions</h3>
              <p className="control-body">
                Block subscribers from specific countries or regions entirely.
                Whether it&apos;s for legal reasons, personal reasons, or no reason —
                you control who can access your content geographically.
              </p>
            </div>
            <div className="control-card">
              <div className="control-icon">🔒</div>
              <h3 className="control-title">Real contact on file</h3>
              <p className="control-body">
                Verified email and phone number for every subscriber.
                If something goes wrong, you have real contact information —
                not a throwaway account with no way to reach them.
              </p>
            </div>
          </div>

          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderLeft:"3px solid var(--accent)", borderRadius:"var(--r-3)", padding:"var(--s-6) var(--s-8)", marginTop:"var(--s-4)" }}>
            <p style={{ fontSize:15, color:"var(--text-soft)", lineHeight:1.8, margin:0 }}>
              On TikTok or Instagram, you have no idea who&apos;s watching. You can&apos;t block someone from your content,
              you can&apos;t verify who they are, and you have no contact information for anyone in your audience.
              On Spotlightly, <strong style={{ color:"var(--text)" }}>your subscriber list is a real, verified,
              accountable audience that you control completely.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ── THE MONEY TRUTH ── */}
      <section className="money-section">
        <div className="money-inner">
          <p className="kicker">The honest numbers</p>
          <h2 className="section-h">You have a following. <em>Keep what it earns.</em></h2>

          <p style={{ fontSize: 17, color: "var(--text-soft)", lineHeight: 1.75, maxWidth: 640, marginBottom: "var(--s-10)" }}>
            Every platform you&apos;re on right now is built to take a cut of your earnings. Spotlightly charges a flat monthly fee and takes nothing else. Here&apos;s how that actually plays out.
          </p>

          {/* Platform comparison grid */}
          <div className="platform-grid">
            {([
              { name: "OnlyFans",    cut: "20%", note: "Of all earnings, forever",          bad: true },
              { name: "Fansly",      cut: "20%", note: "Of all earnings",                   bad: true },
              { name: "Patreon",     cut: "5–12%", note: "Depends on plan",                 bad: true },
              { name: "Substack",    cut: "10%", note: "Of all paid subscriptions",         bad: true },
              { name: "Fanvue",      cut: "15%", note: "Of all earnings",                   bad: true },
              { name: "ManyVids",    cut: "20–40%", note: "Varies by category",             bad: true },
              { name: "Spotlightly", cut: "0%",  note: "Flat monthly fee only. Keep everything.", bad: false },
            ] as const).map(p => (
              <div key={p.name} className={`platform-card${p.bad ? "" : " platform-card--us"}`}>
                <div className="platform-name">{p.name}</div>
                <div className={`platform-cut${p.bad ? " platform-cut--bad" : " platform-cut--good"}`}>{p.cut}</div>
                <div className="platform-note">{p.note}</div>
              </div>
            ))}
          </div>

          {/* Dollar comparison at scale */}
          <div className="scale-table">
            <p className="kicker" style={{ marginBottom: 14 }}>What 1,000 subscribers at $9.99/mo actually means</p>
            <div className="compare-table">
              <div className="compare-header" style={{ gridTemplateColumns: "1fr 120px 120px 120px 140px" }}>
                <div />
                <div className="compare-col-head">OnlyFans</div>
                <div className="compare-col-head">Fansly</div>
                <div className="compare-col-head">Patreon</div>
                <div className="compare-col-head compare-col-head--spot">Spotlightly</div>
              </div>
              <div className="compare-row" style={{ gridTemplateColumns: "1fr 120px 120px 120px 140px" }}>
                <div className="compare-label">
                  <span className="compare-subs">Gross revenue</span>
                  <span className="compare-gross">$9,990/mo from fans</span>
                </div>
                <div className="compare-cell compare-cell--bad">$1,998 taken</div>
                <div className="compare-cell compare-cell--bad">$1,998 taken</div>
                <div className="compare-cell compare-cell--bad">~$1,199 taken</div>
                <div className="compare-cell compare-cell--good">$249/mo flat</div>
              </div>
              <div className="compare-row" style={{ gridTemplateColumns: "1fr 120px 120px 120px 140px", background: "rgba(52,211,153,0.03)", borderTop: "1px solid var(--border)" }}>
                <div className="compare-label">
                  <span className="compare-subs" style={{ color: "var(--accent-open)" }}>You keep</span>
                </div>
                <div className="compare-cell compare-cell--bad">$7,992</div>
                <div className="compare-cell compare-cell--bad">$7,992</div>
                <div className="compare-cell compare-cell--bad">$8,791</div>
                <div className="compare-cell compare-cell--save">$9,741</div>
              </div>
            </div>
            <p className="compare-note">Patreon Pro plan (12% cut). Spotlightly Pro tier ($249/mo). All figures approximate before Stripe processing fees (2.9% + 30¢/transaction — disclosed because most platforms don&apos;t).</p>
          </div>

          <div className="extras-note">
            <p className="kicker" style={{ marginBottom: 12 }}>How Spotlightly earns alongside you</p>
            <p style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.75, maxWidth: 680 }}>
              Our revenue comes from optional fan purchases — Front Row Messages (50/50 split with you), Super Tips (85% to you), Comment Boosts, and Early Access Passes.
              <strong style={{ color: "var(--text)" }}> We make money when your fans want to do more, not by taxing what you already earn.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ── LINK IN BIO — Linktree replacement ── */}
      <section className="linktree-section">
        <div className="linktree-inner">
          <p className="kicker">Replace Linktree</p>
          <h2 className="section-h">Your handle. <em>All your links.</em></h2>
          <p style={{ fontSize: 17, color: "var(--text-soft)", lineHeight: 1.75, maxWidth: 580, marginBottom: "var(--s-10)" }}>
            Your Spotlightly page is your link in bio. Connect your TikTok, Instagram,
            YouTube, X, Twitch, and anywhere else you post. One URL. Every platform. No middleman.
          </p>
          <div className="social-grid">
            {([
              { name: "TikTok", icon: "📱" },
              { name: "Instagram", icon: "📸" },
              { name: "YouTube", icon: "▶" },
              { name: "X / Twitter", icon: "✕" },
              { name: "Twitch", icon: "🎮" },
              { name: "Discord", icon: "💬" },
              { name: "Substack", icon: "✉" },
              { name: "Your website", icon: "🌐" },
            ] as const).map(s => (
              <div key={s.name} className="social-pill">
                <span className="social-icon">{s.icon}</span>
                <span className="social-name">{s.name}</span>
              </div>
            ))}
          </div>
          <div className="linktree-callout">
            <div className="linktree-vs">
              <div className="linktree-them">
                <div className="linktree-them-name">Linktree</div>
                <div className="linktree-them-note">A separate app, separate URL, separate brand. Your audience goes to Linktree, not to you.</div>
              </div>
              <div className="linktree-divider">vs</div>
              <div className="linktree-ours">
                <div className="linktree-ours-name">Spotlightly</div>
                <div className="linktree-ours-note">Your page, your brand, your handle. Every link. And fans can subscribe while they're there.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── USE CASES — Who this is for ── */}
      <section className="uses-section">
        <div className="uses-inner">
          <p className="kicker">Built for every kind of creator</p>
          <h2 className="section-h">If you have an audience, <em>this is for you.</em></h2>

          <div className="uses-grid">
            <div className="uses-card">
              <div className="uses-emoji">✈️</div>
              <h3 className="uses-title">The trip you need funding for</h3>
              <p className="uses-body">
                Launch a campaign. Set a goal. Supporters donate and get exclusive access —
                behind-the-scenes posts, live streams, private content from the road
                that your regular followers won&apos;t see.
                Not GoFundMe. Not charity. An experience they&apos;re part of.
              </p>
              <div className="uses-example">"Fund my training trip to Spain — donors get daily content from camp"</div>
            </div>

            <div className="uses-card">
              <div className="uses-emoji">💬</div>
              <h3 className="uses-title">The help you give every day for free</h3>
              <p className="uses-body">
                You answer questions on TikTok and Instagram all day long.
                People DM you on Instagram asking for advice, send you Venmo requests for help.
                Spotlightly puts that on a proper footing — paid DMs, subscriptions,
                locked guides, accountability check-ins. Your knowledge has value.
              </p>
              <div className="uses-example">"Subscribe for weekly check-ins and my full training programme"</div>
            </div>

            <div className="uses-card">
              <div className="uses-emoji">🎓</div>
              <h3 className="uses-title">The course you&apos;ve been meaning to build</h3>
              <p className="uses-body">
                Your locked posts are your curriculum. Upload the guide, the video,
                the template, the walkthrough. Subscribers unlock it all.
                No course platform, no monthly SaaS fee, no percentage taken.
                Just your content behind a paywall you control.
              </p>
              <div className="uses-example">"Subscribe to get my full 12-week programme and coaching library"</div>
            </div>

            <div className="uses-card">
              <div className="uses-emoji">🎁</div>
              <h3 className="uses-title">Your wish list — with a private address</h3>
              <p className="uses-body">
                Add anything from any store. Fans buy it through Spotlightly — we purchase it
                and ship it to you. Your address never leaves the platform. You see who sent
                each gift. They never know where you live. Better than any wish list that exists.
              </p>
              <div className="uses-example">"Sony camera · Nike Airs · anything you actually want — your fans can send it"</div>
            </div>

            <div className="uses-card">
              <div className="uses-emoji">🔒</div>
              <h3 className="uses-title">The content you can&apos;t post everywhere</h3>
              <p className="uses-body">
                Backstage is a completely separate identity. Linked to your main page
                or completely invisible — your call. Your employer, your family,
                your mainstream followers never see the connection.
                One login. One wallet. One payout. Two lives.
              </p>
              <div className="uses-example">"My Spotlight is my fitness page. My Backstage is mine alone."</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CLOSING ── */}}
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

        /* PLATFORM COMPARISON */
        .platform-grid {
          display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;
          margin-bottom: var(--s-10);
        }
        .platform-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-2); padding: var(--s-5) var(--s-4); text-align: center;
        }
        .platform-card--us {
          border-color: var(--accent-border); background: rgba(240,180,41,0.05);
          position: relative;
        }
        .platform-card--us::before {
          content: "You"; position: absolute; top: -10px; left: 50%;
          transform: translateX(-50%); font-family: var(--font-mono);
          font-size: 9px; letter-spacing: .15em; text-transform: uppercase;
          color: var(--accent); background: var(--bg); padding: 0 8px;
        }
        .platform-name {
          font-family: var(--font-display); font-size: 11px; font-weight: 700;
          color: var(--muted); margin-bottom: var(--s-3);
        }
        .platform-card--us .platform-name { color: var(--accent); }
        .platform-cut {
          font-family: var(--font-display); font-size: 22px; font-weight: 800;
          letter-spacing: -0.03em; line-height: 1; margin-bottom: var(--s-2);
        }
        .platform-cut--bad { color: var(--red); }
        .platform-cut--good { color: var(--accent-open); }
        .platform-note { font-size: 10px; color: var(--muted); line-height: 1.5; }
        .platform-card--us .platform-note { color: var(--text-soft); }
        .scale-table { margin-bottom: var(--s-8); }

        /* LINKTREE SECTION */
        .linktree-section { padding: var(--s-24) var(--s-6); border-top: 1px solid var(--border); }
        .linktree-inner { max-width: var(--container-wide); margin: 0 auto; }
        .social-grid {
          display: flex; flex-wrap: wrap; gap: var(--s-2);
          margin-bottom: var(--s-10);
        }
        .social-pill {
          display: flex; align-items: center; gap: var(--s-2);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-pill); padding: 10px 18px;
          font-family: var(--font-display); font-size: 13px; font-weight: 600;
          color: var(--text-soft);
          transition: all var(--t-fast);
        }
        .social-pill:hover { border-color: var(--border-strong); color: var(--text); }
        .social-icon { font-size: 16px; }
        .social-name { font-size: 13px; }
        .linktree-callout {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-3); padding: var(--s-8);
        }
        .linktree-vs {
          display: grid; grid-template-columns: 1fr auto 1fr; gap: var(--s-8);
          align-items: center;
        }
        .linktree-them, .linktree-ours {
          padding: var(--s-5);
        }
        .linktree-them { opacity: 0.5; }
        .linktree-them-name, .linktree-ours-name {
          font-family: var(--font-display); font-size: 20px; font-weight: 800;
          letter-spacing: -0.02em; margin-bottom: var(--s-2);
        }
        .linktree-them-name { color: var(--muted); }
        .linktree-ours-name { color: var(--accent); }
        .linktree-them-note, .linktree-ours-note {
          font-size: 13px; color: var(--text-soft); line-height: 1.7;
        }
        .linktree-divider {
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          color: var(--muted); letter-spacing: .1em; text-transform: uppercase;
          padding: var(--s-3) var(--s-4); border: 1px solid var(--border);
          border-radius: var(--r-pill); background: var(--surface-2);
          text-align: center;
        }

        @media (max-width: 860px) {
          .platform-grid { grid-template-columns: repeat(3, 1fr); }
          .linktree-vs { grid-template-columns: 1fr; }
          .linktree-divider { text-align: center; }
          .compare-header, .compare-row { grid-template-columns: 1fr 90px 90px 90px 110px !important; font-size: 11px; }
        }
        @media (max-width: 600px) {
          .platform-grid { grid-template-columns: repeat(2, 1fr); }
        }


        /* PLATFORM REALITY SECTION */
        .reality-section {
          padding: var(--s-24) var(--s-6);
          border-top: 1px solid var(--border);
          background: var(--bg-elevated);
        }
        .reality-inner { max-width: var(--container-wide); margin: 0 auto; }

        .reality-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
          margin-bottom: var(--s-10);
        }
        .reality-card {
          border-radius: var(--r-3);
          padding: var(--s-6) var(--s-5);
          position: relative;
        }
        .reality-card--bad {
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .reality-card--good {
          background: rgba(240,180,41,0.05);
          border: 1px solid var(--accent-border);
        }
        .reality-platform {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--muted);
          margin-bottom: var(--s-4);
          text-transform: uppercase;
        }
        .reality-card--good .reality-platform { color: var(--accent); }
        .reality-pay {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: var(--red);
          margin-bottom: 4px;
        }
        .reality-card--good .reality-pay { color: var(--accent-bright); }
        .reality-unit {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted-faint);
          margin-bottom: var(--s-4);
          line-height: 1.5;
        }
        .reality-note {
          font-size: 12px;
          color: var(--text-faint);
          line-height: 1.65;
          border-top: 1px solid var(--border);
          padding-top: var(--s-4);
          margin-top: var(--s-2);
        }
        .reality-card--good .reality-note { color: var(--text-soft); }

        .reality-strategy {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          border-radius: var(--r-3);
          padding: var(--s-8) var(--s-6);
        }
        .reality-strategy-head {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: var(--s-6);
        }
        .reality-strategy-steps {
          display: flex;
          align-items: flex-start;
          gap: var(--s-4);
          flex-wrap: wrap;
        }
        .reality-step {
          display: flex;
          gap: var(--s-4);
          align-items: flex-start;
          flex: 1;
          min-width: 200px;
          font-size: 14px;
          color: var(--text-soft);
          line-height: 1.65;
        }
        .reality-step strong { color: var(--text); font-weight: 600; display: block; margin-bottom: 4px; }
        .reality-step-num {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--accent);
          line-height: 1;
          flex-shrink: 0;
        }
        .reality-step-arrow {
          font-size: 20px;
          color: var(--muted-faint);
          padding-top: 4px;
          flex-shrink: 0;
        }

        @media (max-width: 860px) {
          .reality-grid { grid-template-columns: 1fr 1fr; }
          .reality-strategy-steps { flex-direction: column; }
          .reality-step-arrow { transform: rotate(90deg); align-self: center; }
        }
        @media (max-width: 500px) {
          .reality-grid { grid-template-columns: 1fr; }
        }


        /* CREATOR CONTROL SECTION */
        .control-section {
          padding: var(--s-24) var(--s-6);
          border-top: 1px solid var(--border);
        }
        .control-inner { max-width: var(--container-wide); margin: 0 auto; }
        .control-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
          margin-bottom: var(--s-6);
        }
        .control-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-3);
          padding: var(--s-7) var(--s-6);
          transition: border-color var(--t-fast), transform var(--t-base);
        }
        .control-card:hover {
          border-color: var(--accent-border);
          transform: translateY(-2px);
        }
        .control-icon { font-size: 28px; margin-bottom: var(--s-4); }
        .control-title {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: var(--s-3);
          line-height: 1.2;
        }
        .control-body {
          font-size: 13px;
          color: var(--text-soft);
          line-height: 1.75;
          margin: 0;
        }
        @media (max-width: 860px) {
          .control-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 500px) {
          .control-grid { grid-template-columns: 1fr; }
        }


        /* USE CASES */
        .uses-section { padding: var(--s-24) var(--s-6); border-top: 1px solid var(--border); background: var(--bg-elevated); }
        .uses-inner { max-width: var(--container-wide); margin: 0 auto; }
        .uses-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; margin-top: var(--s-10); }
        .uses-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-3); padding: var(--s-8) var(--s-7);
          transition: border-color var(--t-base), transform var(--t-base);
        }
        .uses-card:hover { border-color: var(--accent-border); transform: translateY(-2px); }
        .uses-emoji { font-size: 32px; margin-bottom: var(--s-4); }
        .uses-title { font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #fff; margin-bottom: var(--s-3); line-height: 1.2; }
        .uses-body { font-size: 14px; color: var(--text-soft); line-height: 1.8; margin-bottom: var(--s-4); }
        .uses-example { font-family: var(--font-serif); font-size: 14px; font-style: italic; color: var(--accent); line-height: 1.5; padding-left: var(--s-4); border-left: 2px solid var(--accent-border); }
        @media (max-width: 700px) { .uses-grid { grid-template-columns: 1fr; } }

      `}</style>
    </main>
  );
}

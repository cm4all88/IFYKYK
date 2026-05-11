import Link from "next/link";
import SiteHeader from "@/components/site-header";

export const metadata = {
  title: "Spotlightly · Every creator deserves a spotlight",
  description:
    "The creator platform built for your whole career. Spotlight and Backstage — one venue, one wallet, one dashboard.",
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
            Every creator
            <br />
            deserves <em>a spotlight.</em>
          </h1>

          <p className="hero-lede">
            We built the whole venue. Center stage for your main work.
            Backstage for the rest. One platform, one payout, your whole
            career.
          </p>

          <div className="hero-actions">
            <Link href="/signup" className="btn btn--primary">
              Become a creator
            </Link>
            <Link href="/login" className="btn btn--secondary">
              Sign in
            </Link>
          </div>

          <p className="hero-meta">
            0% on tips. Custom subdomain. Yours from day one.
          </p>
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
                <li>Full monetization stack</li>
                <li>Themeable creator page</li>
                <li>0% on standard tips</li>
                <li>Stripe payouts</li>
              </ul>
            </article>

            <article className="tier tier--back">
              <div className="tier-rule" />
              <p className="tier-tag">Ages 18+ verified · Opt-in</p>
              <h3 className="tier-name">Backstage</h3>
              <p className="tier-desc">
                Adult content, handled professionally. A separate public profile
                with optional links to your Spotlight. Age verification and 2257
                records done right.
              </p>
              <ul className="tier-feats">
                <li>Separate public identity</li>
                <li>Linked or unlinked — your call</li>
                <li>CCBill for adult payments</li>
                <li>Unified dashboard, single payout</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* DUAL IDENTITY — the core differentiator */}
      <section className="differentiator">
        <div className="differentiator-inner">
          <div className="diff-text">
            <p className="kicker">The Privacy Architecture</p>
            <h2 className="section-h">
              One account. Two public faces.
              <br />
              <em>Your choice which ones are connected.</em>
            </h2>
            <p className="diff-lede">
              The single biggest reason creators don&apos;t post adult content
              isn&apos;t legal complexity. It&apos;s exposure. Employers, family,
              mainstream followers. Spotlightly solves this with an architecture
              no one else has thought through this cleanly.
            </p>
            <p className="diff-body">
              Behind the scenes, your Spotlight and Backstage are unified. One
              login. One wallet. One payout. Publicly, they&apos;re treated as
              completely separate — unless you choose to link them. Default is
              unlinked.
            </p>
          </div>

          <div className="diff-states">
            <div className="state state--unlinked">
              <p className="state-tag">🔒 Unlinked · Default</p>
              <p className="state-text">
                Zero trace on your Spotlight profile. Your Backstage is only
                discoverable through Backstage search or direct link. Your boss
                will never know it exists.
              </p>
            </div>
            <div className="state state--linked">
              <p className="state-tag">🔗 Linked · Opt-in</p>
              <p className="state-text">
                A Backstage badge appears on your Spotlight. Fans navigate
                directly. You&apos;re using Backstage as an upsell from your
                main brand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MONETIZATION */}
      <section className="money">
        <div className="money-inner">
          <p className="kicker">How You Get Paid</p>
          <h2 className="section-h">
            Seven revenue streams. <em>One wallet.</em>
          </h2>

          <div className="money-grid">
            <div className="money-row">
              <div className="money-name">Subscriptions</div>
              <div className="money-cut">10–20% platform fee</div>
              <div className="money-desc">Monthly fan subscriptions to your channels.</div>
            </div>
            <div className="money-row">
              <div className="money-name">Tips</div>
              <div className="money-cut tone-spot">0% — you keep all</div>
              <div className="money-desc">Direct fan-to-creator. Always free for both sides.</div>
            </div>
            <div className="money-row">
              <div className="money-name">Super Tips</div>
              <div className="money-cut">15%</div>
              <div className="money-desc">Pinned, badged, animated. Your top supporters get the spotlight too.</div>
            </div>
            <div className="money-row">
              <div className="money-name">Gift Subscriptions</div>
              <div className="money-cut">10%</div>
              <div className="money-desc">Fans gift your subscription to friends. Organic growth.</div>
            </div>
            <div className="money-row">
              <div className="money-name">Merch</div>
              <div className="money-cut">10–15%</div>
              <div className="money-desc">Printful integration, your designs, your store.</div>
            </div>
            <div className="money-row">
              <div className="money-name">Locked posts</div>
              <div className="money-cut">Standard sub fee</div>
              <div className="money-desc">Pay-per-post or sub-only content. You set the rules.</div>
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
            Your audience shouldn&apos;t have to follow you across three
            platforms as you grow. Start here. Stay here.
          </p>
          <Link href="/signup" className="btn btn--primary closing-cta">
            Claim your handle
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Link href="/" className="lp-footer-brand">
            Spot<span>light</span>ly
          </Link>
          <p className="lp-footer-meta">
            A Tahoma Systems product · Every creator deserves a spotlight.
          </p>
        </div>
      </footer>
    </main>
  );
}

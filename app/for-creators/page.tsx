import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "For Creators · Spotlightly",
  description: "You built the audience. Now get paid for it. The creator platform for every niche — fitness, music, art, comedy, photography, and more.",
  openGraph: {
    title: "You built the audience. Now get paid for it.",
    description: "Spotlightly is where your audience comes to actually support you. Subscribe. Get exclusive content. Watch you live. No algorithm. No middleman.",
  },
};

export default function ForCreatorsPage() {
  return (
    <main style={{ background: "#fff", minHeight: "100vh", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600&family=DM+Mono:wght@500&display=swap');
        .os-body { max-width: 720px; margin: 0 auto; padding: 52px 44px 80px; color: #111; }
        .os-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 44px; }
        .os-brand { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #111; text-decoration: none; }
        .os-brand span { color: #B8860B; }
        .os-badge { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #999; border: 1px solid #ddd; padding: 5px 12px; border-radius: 2px; }
        .os-rule { width: 100%; height: 2px; background: #B8860B; opacity: 0.25; margin-bottom: 44px; }
        .kicker { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #999; margin-bottom: 16px; }
        .hero-h { font-family: 'Playfair Display', serif; font-size: clamp(36px, 5.5vw, 50px); font-weight: 700; color: #111; line-height: 1.1; margin-bottom: 22px; }
        .hero-h em { font-style: italic; color: #B8860B; }
        .lede { font-size: 16px; color: #333; line-height: 1.9; margin-bottom: 40px; }
        .lede strong { color: #111; font-weight: 600; }
        .os-hr { border: none; border-top: 1px solid #eee; margin: 36px 0; }
        .slabel { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #999; margin-bottom: 14px; }
        .sh { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #111; margin-bottom: 12px; line-height: 1.2; }
        .sb { font-size: 15px; color: #333; line-height: 1.85; }
        .tags { display: flex; flex-wrap: wrap; gap: 7px; margin: 16px 0 4px; }
        .tag2 { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.04em; padding: 6px 14px; border: 1px solid #e0e0e0; border-radius: 2px; color: #555; background: #fafafa; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin: 20px 0; }
        .feat { background: #fafafa; border: 1px solid #eee; padding: 20px 22px; }
        .feat-t { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 6px; }
        .feat-d { font-size: 14px; color: #444; line-height: 1.7; }
        .feat-hi { background: #FFFDF5; border: 1px solid #f0e4a0; }
        .money { background: #fff; border: 1px solid #ddd; border-left: 4px solid #B8860B; padding: 28px 32px; margin: 20px 0; }
        .money-h { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: #111; margin-bottom: 12px; }
        .money-b { font-size: 15px; color: #333; line-height: 1.85; margin-bottom: 20px; }
        .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .mc { padding: 20px; }
        .mc-bad { background: #FFF5F5; border: 1px solid #f0c0c0; }
        .mc-good { background: #F5FFF8; border: 1px solid #b0ddc0; }
        .mp { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 10px; }
        .mp-bad { color: #aa2222; }
        .mp-good { color: #186b38; }
        .mn { font-family: 'Playfair Display', serif; font-size: 34px; font-weight: 700; line-height: 1; }
        .mn-bad { color: #aa2222; }
        .mn-good { color: #186b38; }
        .mn-note { font-size: 12px; color: #888; margin-top: 8px; line-height: 1.55; }
        .priv { background: #FAF8FF; border: 1px solid #e0d8f5; border-left: 4px solid #8b5cf6; padding: 22px 26px; margin: 20px 0; }
        .priv-l { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #8b5cf6; margin-bottom: 10px; }
        .priv-b { font-size: 14px; color: #444; line-height: 1.75; }
        .cta { text-align: center; padding: 48px 28px; border: 1px solid #eee; background: #FAFAF8; margin-top: 4px; }
        .cta-h { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: #111; line-height: 1.2; margin-bottom: 12px; }
        .cta-h em { font-style: italic; color: #B8860B; }
        .cta-s { font-size: 15px; color: #888; margin-bottom: 24px; }
        .cta-btn { display: inline-block; background: #B8860B; color: #fff; font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; padding: 16px 36px; border-radius: 3px; text-decoration: none; margin-bottom: 16px; }
        .cta-trial { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #bbb; }
        @media (max-width: 600px) {
          .os-body { padding: 32px 24px 60px; }
          .grid { grid-template-columns: 1fr; }
          .compare { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="os-body">
        <div className="os-top">
          <Link href="/" className="brand-logo brand-logo--light" style={{ fontSize: 24 }}>Spot<span>light</span>ly</Link>
          <span className="os-badge">Creator platform</span>
        </div>
        <div className="os-rule" />

        <p className="kicker">What is Spotlightly</p>
        <h1 className="hero-h">You built the audience.<br /><em>Now get paid for it.</em></h1>
        <p className="lede">
          You post on Instagram. You post on TikTok. Your followers show up, they love what you do — and the platform keeps the ad money while you get nothing.<br /><br />
          <strong>Spotlightly is where your audience comes to actually support you.</strong> Subscribe to you. Get the exclusive content you don&apos;t post publicly. Watch you live. Buy from you directly. No algorithm. No middleman. Just you and the people who genuinely want to go deeper.
        </p>

        <hr className="os-hr" />

        <p className="slabel">This is not OnlyFans</p>
        <h2 className="sh">Built for every creator, every niche.</h2>
        <p className="sb">Fitness. Music. Art. Comedy. Photography. Cooking. Education. Sports. Gaming. Any creator with an audience has something their followers want more of. That&apos;s what Spotlightly is for.</p>
        <div className="tags">
          {["Fitness coaches","Musicians","Photographers","Visual artists","Chefs & cooks","Comedians","Athletes","Educators","Tattoo artists","Gamers","Stylists","Writers","Podcasters","Anyone with an audience"].map(t => (
            <span key={t} className="tag2">{t}</span>
          ))}
        </div>

        <hr className="os-hr" />

        <p className="slabel">Six ways to earn from the audience you already have</p>
        <div className="grid">
          {[
            { hi: true, t: "Exclusive subscriber content", d: "Post the behind-the-scenes, the process, the real stuff — only for people who subscribe. Your social shows the highlight reel. This is everything else." },
            { hi: true, t: "Monthly subscriptions", d: "Fans pay monthly. You set the price. You keep 100%. Spotlightly charges a flat fee — never a cut of what you earn." },
            { t: "Live streaming", d: "Go live to your subscribers anytime. No follower threshold. No application. Start from your browser or OBS." },
            { t: "Tips — 0% platform cut", d: "When a fan tips you, every dollar goes to your account. Spotlightly takes nothing on tips. Zero." },
            { t: "Digital products", d: "Presets, guides, workout plans, courses, templates. Fans pay once, download instantly. You keep 100%." },
            { t: "Personal marketplace", d: "Sell signed items, worn gear, prints, personal pieces directly from your page. Spotlightly takes 5%." },
          ].map(f => (
            <div key={f.t} className={`feat${f.hi ? " feat-hi" : ""}`}>
              <p className="feat-t">{f.t}</p>
              <p className="feat-d">{f.d}</p>
            </div>
          ))}
        </div>

        <hr className="os-hr" />

        <p className="slabel">The money</p>
        <div className="money">
          <h2 className="money-h">Flat fee. Not a cut of everything you make.</h2>
          <p className="money-b">Every other platform takes a percentage of your earnings — forever. The more you grow, the more they keep. Spotlightly charges a flat monthly fee based on subscriber count. That&apos;s it. Your revenue is yours.</p>
          <div className="compare">
            <div className="mc mc-bad">
              <p className={`mp mp-bad`}>OnlyFans / Patreon</p>
              <p className="mn mn-bad">$2,000</p>
              <p className="mn-note">they keep every month at 1,000 subscribers paying $9.99/mo</p>
            </div>
            <div className="mc mc-good">
              <p className={`mp mp-good`}>Spotlightly</p>
              <p className="mn mn-good">$249</p>
              <p className="mn-note">flat monthly fee at 1,000 subscribers — you keep the other $9,751</p>
            </div>
          </div>
        </div>

        <hr className="os-hr" />

        <p className="slabel">Optional — for creators who want it</p>
        <div className="priv">
          <p className="priv-l">Backstage — adult content, kept completely separate</p>
          <p className="priv-b">Spotlightly has an optional Backstage profile for adult content. It&apos;s invisible from your main page unless you link them. Your employer, family, and mainstream followers will never see the connection. Most creators never use it — but it&apos;s there if you want it.</p>
        </div>

        <hr className="os-hr" />

        <div className="cta">
          <h2 className="cta-h">Your audience is already out there.<br /><em>Give them somewhere real to go.</em></h2>
          <p className="cta-s">Your handle. Your page. Your money.</p>
          <Link href="/signup" className="cta-btn">Claim your handle →</Link>
          <p className="cta-trial">30-day free trial · No card required</p>
        </div>
      </div>
    </main>
  );
}

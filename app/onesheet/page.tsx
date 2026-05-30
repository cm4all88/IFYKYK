import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spotlightly — Built for every creator",
  description: "You built the audience. Now get paid for it. Spotlightly is where your audience comes to actually support you.",
};

export default function OnesheetPage() {
  return (
    <main style={{ background: "#fff", minHeight: "100vh", display: "flex", justifyContent: "center", padding: "0 20px" }}>
      <div style={{ width: "100%", maxWidth: 680, padding: "52px 0 80px", fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 400, lineHeight: 1.7, color: "#111" }}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600&family=DM+Mono:wght@500&display=swap');
          .os-brand { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; color: #111; }
          .os-brand span { color: #B8860B; }
          .os-kicker { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #999; margin-bottom: 16px; display: block; }
          .os-h1 { font-family: 'Playfair Display', serif; font-size: clamp(36px, 5.5vw, 50px); font-weight: 700; color: #111; line-height: 1.1; margin-bottom: 22px; }
          .os-h1 em { font-style: italic; color: #B8860B; }
          .os-h2 { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #111; margin-bottom: 12px; line-height: 1.2; }
          .os-h3 { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: #111; margin-bottom: 12px; }
          .os-h3 { font-size: 22px; }
          .os-lede { font-size: 16px; color: #333; line-height: 1.9; margin-bottom: 40px; }
          .os-lede strong { color: #111; font-weight: 600; }
          .os-body { font-size: 15px; color: #333; line-height: 1.85; }
          .os-rule { border: none; border-top: 1px solid #eee; margin: 36px 0; }
          .os-slabel { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: #999; margin-bottom: 14px; display: block; }
          .os-tags { display: flex; flex-wrap: wrap; gap: 7px; margin: 16px 0; }
          .os-tag { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; padding: 6px 14px; border: 1px solid #e0e0e0; border-radius: 2px; color: #555; background: #fafafa; }
          .os-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin: 20px 0; }
          .os-feat { background: #fafafa; border: 1px solid #eee; padding: 20px 22px; }
          .os-feat-hi { background: #FFFDF5; border: 1px solid #f0e4a0; }
          .os-feat-t { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 6px; }
          .os-feat-d { font-size: 14px; color: #444; line-height: 1.7; }
          .os-money { background: #fff; border: 1px solid #ddd; border-left: 4px solid #B8860B; padding: 28px 32px; margin: 20px 0; }
          .os-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
          .os-mc { padding: 20px; }
          .os-mc-bad { background: #FFF5F5; border: 1px solid #f0c0c0; }
          .os-mc-good { background: #F5FFF8; border: 1px solid #b0ddc0; }
          .os-mp { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 10px; display: block; }
          .os-mp-bad { color: #aa2222; }
          .os-mp-good { color: #186b38; }
          .os-mn { font-family: 'Playfair Display', serif; font-size: 34px; font-weight: 700; line-height: 1; display: block; }
          .os-mn-bad { color: #aa2222; }
          .os-mn-good { color: #186b38; }
          .os-mn-note { font-size: 12px; color: #888; margin-top: 8px; line-height: 1.55; display: block; }
          .os-priv { background: #FAF8FF; border: 1px solid #e0d8f5; border-left: 4px solid #8b5cf6; padding: 22px 26px; margin: 20px 0; }
          .os-priv-l { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #8b5cf6; margin-bottom: 10px; display: block; }
          .os-priv-b { font-size: 14px; color: #444; line-height: 1.75; }
          .os-cta { text-align: center; padding: 48px 28px; border: 1px solid #eee; background: #FAFAF8; margin-top: 4px; }
          .os-cta-h { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: #111; line-height: 1.2; margin-bottom: 12px; }
          .os-cta-h em { font-style: italic; color: #B8860B; }
          .os-cta-s { font-size: 15px; color: #888; margin-bottom: 24px; display: block; }
          .os-cta-url { font-family: 'DM Mono', monospace; font-size: 16px; font-weight: 500; color: #B8860B; letter-spacing: 0.05em; display: block; margin-bottom: 10px; text-decoration: none; }
          .os-cta-t { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #bbb; }
          .os-btn { display: inline-block; margin-top: 24px; background: #B8860B; color: #fff; font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; padding: 14px 32px; border-radius: 3px; text-decoration: none; }
          @media (max-width: 600px) {
            .os-grid { grid-template-columns: 1fr; }
            .os-compare { grid-template-columns: 1fr; }
          }
        `}</style>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 44 }}>
          <span className="os-brand">Spot<span>light</span>ly</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: "#999", border: "1px solid #ddd", padding: "5px 12px", borderRadius: 2 }}>
            Creator platform
          </span>
        </div>
        <div style={{ width: "100%", height: 2, background: "#B8860B", opacity: 0.25, marginBottom: 44 }} />

        {/* Hero */}
        <span className="os-kicker">What is Spotlightly</span>
        <h1 className="os-h1">You built the audience.<br />Now <em>get paid for it.</em></h1>
        <p className="os-lede">
          You post on Instagram. You post on TikTok. Your followers show up, they love what you do — and the platform keeps the ad money while you get nothing.<br /><br />
          <strong>Spotlightly is where your audience comes to actually support you.</strong> Subscribe to you. Get the exclusive content you don&apos;t post publicly. Watch you live. Buy from you directly. No algorithm. No middleman. Just you and the people who genuinely want to go deeper.
        </p>

        <hr className="os-rule" />

        {/* Not OnlyFans */}
        <span className="os-slabel">This is not OnlyFans</span>
        <h2 className="os-h2">Built for every creator, every niche.</h2>
        <p className="os-body">Fitness. Music. Art. Comedy. Photography. Cooking. Education. Sports. Gaming. Any creator with an audience has something their followers want more of. That&apos;s what Spotlightly is for.</p>
        <div className="os-tags">
          {["Fitness coaches","Musicians","Photographers","Visual artists","Chefs & cooks","Comedians","Athletes","Educators","Tattoo artists","Gamers","Stylists","Writers","Podcasters","Anyone with an audience"].map(t => (
            <span key={t} className="os-tag">{t}</span>
          ))}
        </div>

        <hr className="os-rule" />

        {/* Features */}
        <span className="os-slabel">Six ways to earn from the audience you already have</span>
        <div className="os-grid">
          <div className="os-feat os-feat-hi">
            <p className="os-feat-t">Exclusive subscriber content</p>
            <p className="os-feat-d">Post the behind-the-scenes, the process, the real stuff — only for people who subscribe. Your social shows the highlight reel. This is everything else.</p>
          </div>
          <div className="os-feat os-feat-hi">
            <p className="os-feat-t">Monthly subscriptions</p>
            <p className="os-feat-d">Fans pay monthly. You set the price. You keep 100%. Spotlightly charges a flat fee — never a cut of what you earn.</p>
          </div>
          <div className="os-feat">
            <p className="os-feat-t">Live streaming</p>
            <p className="os-feat-d">Go live to your subscribers anytime. No follower threshold. No application. Start from your browser or OBS.</p>
          </div>
          <div className="os-feat">
            <p className="os-feat-t">Tips — 0% platform cut</p>
            <p className="os-feat-d">When a fan tips you, every dollar goes to your account. Spotlightly takes nothing on tips. Zero.</p>
          </div>
          <div className="os-feat">
            <p className="os-feat-t">Digital products</p>
            <p className="os-feat-d">Presets, guides, workout plans, courses, templates. Fans pay once, download instantly. You keep 100%.</p>
          </div>
          <div className="os-feat">
            <p className="os-feat-t">Personal marketplace</p>
            <p className="os-feat-d">Sell signed items, worn gear, prints, personal pieces directly from your page. Spotlightly takes 5% for hosting.</p>
          </div>
        </div>

        <hr className="os-rule" />

        {/* Money */}
        <span className="os-slabel">The money</span>
        <div className="os-money">
          <h2 className="os-h3">Flat fee. Not a cut of everything you make.</h2>
          <p className="os-body">Every other platform takes a percentage of your earnings — forever. The more you grow, the more they keep. Spotlightly charges a flat monthly fee based on subscriber count. That&apos;s it. Your revenue is yours.</p>
          <div className="os-compare">
            <div className="os-mc os-mc-bad">
              <span className="os-mp os-mp-bad">OnlyFans / Patreon</span>
              <span className="os-mn os-mn-bad">$2,000</span>
              <span className="os-mn-note">they keep every month at 1,000 subscribers paying $9.99/mo (20% cut)</span>
            </div>
            <div className="os-mc os-mc-good">
              <span className="os-mp os-mp-good">Spotlightly</span>
              <span className="os-mn os-mn-good">$249</span>
              <span className="os-mn-note">flat monthly fee at 1,000 subscribers — you keep the other $9,751</span>
            </div>
          </div>
        </div>

        <hr className="os-rule" />

        {/* Backstage */}
        <span className="os-slabel">Optional — for creators who want it</span>
        <div className="os-priv">
          <span className="os-priv-l">Backstage — adult content, kept completely separate</span>
          <p className="os-priv-b">Spotlightly has an optional Backstage profile for adult content. It&apos;s invisible from your main page unless you choose to link them. Your employer, family, and mainstream followers will never see the connection. Most creators never use it — but it&apos;s there if you want it.</p>
        </div>

        <hr className="os-rule" />

        {/* CTA */}
        <div className="os-cta">
          <h2 className="os-cta-h">Your audience is already out there.<br />Give them <em>somewhere real to go.</em></h2>
          <span className="os-cta-s">Your handle. Your page. Your money.</span>
          <a href="https://spotlightly.app/signup" className="os-cta-url">spotlightly.app/signup</a>
          <p className="os-cta-t">30-day free trial · No card required</p>
          <a href="/signup" className="os-btn">Claim your handle →</a>
        </div>

      </div>
    </main>
  );
}

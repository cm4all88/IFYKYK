import Link from 'next/link'

// ─── Design tokens ───────────────────────────────────────────────
const T = {
  bg:      '#09090C',
  surface: '#111115',
  border:  'rgba(255,255,255,0.07)',
  text:    '#F2F2F0',
  muted:   '#71717A',
  gold:    '#F0B429',
  purple:  '#A855F7',
  red:     '#EF4444',
  mint:    '#34D399',
}

const font = {
  serif: 'Cormorant Garamond, serif',
  sans:  'Plus Jakarta Sans, sans-serif',
  mono:  'DM Mono, monospace',
}

// ─── Shared styles ────────────────────────────────────────────────
const kicker = {
  fontFamily: font.mono,
  fontSize: '10px',
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  color: T.muted,
  marginBottom: '20px',
  display: 'block',
}

const sectionWrap = (extra?: React.CSSProperties): React.CSSProperties => ({
  maxWidth: '900px',
  margin: '0 auto',
  padding: '0 40px',
  position: 'relative',
  ...extra,
})

const featTag = (color: string): React.CSSProperties => ({
  fontFamily: font.mono,
  fontSize: '10px',
  letterSpacing: '0.08em',
  padding: '4px 12px',
  border: `1px solid ${color}33`,
  color,
  borderRadius: '2px',
  display: 'inline-block',
})

// ─── Page ─────────────────────────────────────────────────────────
export default function MarketingPage() {
  return (
    <main style={{ background: T.bg, color: T.text, fontFamily: font.sans, fontWeight: 400, lineHeight: 1.7, overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: `1px solid ${T.border}`,
        background: 'rgba(9,9,12,0.85)',
        backdropFilter: 'blur(12px)',
        padding: '0 40px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: font.serif, fontSize: '22px', fontWeight: 300, color: '#fff' }}>
          Spot<span style={{ color: T.gold }}>light</span>ly
        </div>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          {['How it works', 'Pricing', 'About'].map(l => (
            <Link key={l} href={`/${l.toLowerCase().replace(/ /g, '-')}`} style={{
              fontFamily: font.mono, fontSize: '10px', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: T.muted, textDecoration: 'none',
            }}>{l}</Link>
          ))}
          <Link href="/signup" style={{
            background: T.gold, color: T.bg, fontFamily: font.mono,
            fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
            fontWeight: 500, padding: '10px 20px', textDecoration: 'none', borderRadius: '4px',
          }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden', paddingTop: '60px' }}>
        {/* Spotlight beam */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '1px', height: '55%',
          background: `linear-gradient(to bottom, ${T.gold}80, transparent)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '400px', height: '60%',
          background: `radial-gradient(ellipse 60% 100% at 50% 0%, ${T.gold}12, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        {/* Ambient corners */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '400px', height: '400px', background: `radial-gradient(ellipse, ${T.purple}08, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '400px', height: '400px', background: `radial-gradient(ellipse, ${T.mint}06, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ ...sectionWrap(), textAlign: 'center', padding: '0 40px' }}>
          <span style={kicker}>The creator platform</span>
          <h1 style={{
            fontFamily: font.serif,
            fontSize: 'clamp(52px, 8vw, 96px)',
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#fff',
            marginBottom: '24px',
          }}>
            Every creator deserves<br />
            <em style={{ fontStyle: 'italic', color: T.gold }}>a spotlight.</em>
          </h1>
          <p style={{ fontFamily: font.serif, fontSize: 'clamp(18px, 2.5vw, 26px)', fontStyle: 'italic', fontWeight: 300, color: 'rgba(242,242,240,0.55)', maxWidth: '560px', margin: '0 auto 48px', lineHeight: 1.5 }}>
            We built the whole venue.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '64px' }}>
            <Link href="/signup" style={{
              background: T.gold, color: T.bg, fontFamily: font.mono,
              fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
              fontWeight: 500, padding: '16px 36px', textDecoration: 'none', borderRadius: '4px',
            }}>
              Claim your handle
            </Link>
            <Link href="/how-it-works" style={{
              border: `1px solid ${T.border}`, color: T.muted, fontFamily: font.mono,
              fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
              padding: '16px 36px', textDecoration: 'none', borderRadius: '4px',
            }}>
              How it works
            </Link>
          </div>
          {/* Quick trust hits */}
          <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              'No minimum followers',
              '0% on tips',
              'Your own subdomain',
              'No approval process',
            ].map(t => (
              <span key={t} style={{ fontFamily: font.mono, fontSize: '10px', letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase' }}>
                ✓ {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── NO MINIMUMS ── */}
      <section style={{ padding: '100px 40px', borderTop: `1px solid ${T.border}` }}>
        <div style={sectionWrap()}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
            <div style={{ padding: '48px', background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.gold}` }}>
              <span style={kicker}>The rule we threw out</span>
              <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 300, color: '#fff', lineHeight: 1.1, marginBottom: '20px' }}>
                YouTube says<br /><em style={{ color: T.gold, fontStyle: 'italic' }}>1,000 subscribers.</em><br />We say day one.
              </h2>
              <p style={{ color: 'rgba(242,242,240,0.6)', fontSize: '15px', lineHeight: 1.8, margin: 0 }}>
                Every major platform gates monetization behind a threshold you haven't hit yet. 
                Spotlightly doesn't. Post your first piece of content and charge for it on the same day. 
                No followers required. No approval. No waiting.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { platform: 'YouTube', gate: '1,000 subscribers + 4,000 watch hours', color: T.red },
                { platform: 'TikTok', gate: '10,000 followers + 100k views in 30 days', color: T.red },
                { platform: 'Instagram', gate: 'Invite-only creator program', color: T.red },
                { platform: 'Spotlightly', gate: 'No minimum. Monetize from post one.', color: T.mint },
              ].map(item => (
                <div key={item.platform} style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  padding: '20px 28px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: '16px',
                }}>
                  <span style={{ fontFamily: font.mono, fontSize: '11px', letterSpacing: '0.08em', color: item.platform === 'Spotlightly' ? T.gold : T.muted, textTransform: 'uppercase' }}>{item.platform}</span>
                  <span style={{ fontSize: '13px', color: item.color, textAlign: 'right', maxWidth: '260px' }}>{item.gate}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── THE VENUE ── */}
      <section style={{ padding: '100px 40px', borderTop: `1px solid ${T.border}` }}>
        <div style={sectionWrap()}>
          <span style={kicker}>The two stages</span>
          <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 300, color: '#fff', lineHeight: 1.05, marginBottom: '16px' }}>
            One platform.<br /><em style={{ color: T.gold, fontStyle: 'italic' }}>Two worlds.</em>
          </h2>
          <p style={{ color: 'rgba(242,242,240,0.6)', fontSize: '16px', lineHeight: 1.8, maxWidth: '600px', marginBottom: '48px' }}>
            Most creators outgrow their platform before they peak. Spotlightly is built for the whole career — 
            wherever it goes.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
            {/* Spotlight */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.gold}`, padding: '40px' }}>
              <div style={{ fontFamily: font.serif, fontSize: '32px', fontWeight: 300, color: T.gold, marginBottom: '8px' }}>Spotlight</div>
              <div style={{ fontFamily: font.mono, fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.muted, marginBottom: '20px' }}>18+ · The main stage</div>
              <p style={{ fontSize: '14px', color: 'rgba(242,242,240,0.65)', lineHeight: 1.8, marginBottom: '24px' }}>
                Your branded page. Your audience. Every monetization tool a working creator needs — 
                subscriptions, tips, locked posts, digital products, merch, live content, booking links. 
                SFW, professional, shareable anywhere.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['Custom subdomain','Subscriptions','Locked posts','Digital store','Merch','Live','Booking links','Social feed'].map(f => (
                  <span key={f} style={featTag(T.gold)}>{f}</span>
                ))}
              </div>
            </div>
            {/* Backstage */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.purple}`, padding: '40px' }}>
              <div style={{ fontFamily: font.serif, fontSize: '32px', fontWeight: 300, color: T.purple, marginBottom: '8px' }}>Backstage</div>
              <div style={{ fontFamily: font.mono, fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.muted, marginBottom: '20px' }}>18+ verified · Opt-in only</div>
              <p style={{ fontSize: '14px', color: 'rgba(242,242,240,0.65)', lineHeight: 1.8, marginBottom: '24px' }}>
                Adult content, handled professionally. A completely separate public identity — 
                linked to your Spotlight only if you choose. One login, one dashboard, one payout. 
                Age verified. 2257 compliant.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['Separate identity','Optional link','Age verified','2257 records','CCBill payments','Unified wallet','Unified dashboard'].map(f => (
                  <span key={f} style={featTag(T.purple)}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STIGMA ── */}
      <section style={{ padding: '100px 40px', borderTop: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 50% 60% at 50% 50%, ${T.gold}04, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={sectionWrap()}>
          <span style={kicker}>The platform problem</span>
          <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 300, color: '#fff', lineHeight: 1.05, marginBottom: '24px' }}>
            Would you tell your employer<br />
            <em style={{ fontStyle: 'italic', color: T.gold }}>you're on OnlyFans?</em>
          </h2>
          <p style={{ color: 'rgba(242,242,240,0.6)', fontSize: '16px', lineHeight: 1.8, maxWidth: '620px', marginBottom: '56px' }}>
            You shouldn't have to think about that question. OnlyFans has a perception problem 
            that has nothing to do with what most creators actually post — fitness coaches, musicians, 
            educators — but every creator on it inherits that reputation anyway. You deserve a platform 
            that doesn't make you explain yourself.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginBottom: '48px' }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.red}44`, padding: '36px' }}>
              <div style={{ fontFamily: font.mono, fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: `${T.red}88`, marginBottom: '20px' }}>Every other platform</div>
              {[
                'One brand. One reputation. You inherit all of it.',
                'Post yoga. Get associated with adult content anyway.',
                'Two platforms means rebuilding your audience from zero.',
                'Your employer Googles you. They find your page.',
              ].map((item, i) => (
                <div key={i} style={{ fontSize: '14px', color: 'rgba(242,242,240,0.45)', padding: '10px 0 10px 20px', borderBottom: `1px solid ${T.border}`, position: 'relative', lineHeight: 1.6 }}>
                  <span style={{ position: 'absolute', left: 0, color: `${T.red}55`, fontFamily: font.mono }}>—</span>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.gold}`, padding: '36px' }}>
              <div style={{ fontFamily: font.mono, fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.gold, marginBottom: '20px' }}>Spotlightly</div>
              {[
                'Adult content lives in its own world. Your page stays clean.',
                'A fitness creator is a fitness creator. Full stop.',
                'One platform. Your whole career. Your audience follows.',
                'Your employer finds your Spotlight page — and that\'s it.',
              ].map((item, i) => (
                <div key={i} style={{ fontSize: '14px', color: 'rgba(242,242,240,0.75)', padding: '10px 0 10px 20px', borderBottom: `1px solid ${T.border}`, position: 'relative', lineHeight: 1.6 }}>
                  <span style={{ position: 'absolute', left: 0, color: T.gold, fontFamily: font.mono }}>—</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Three creator personas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
            {[
              { who: 'The yoga instructor', story: 'Posts fitness content on Spotlight. Has a Backstage for subscribers who want more. Her studio clients never know it exists.' },
              { who: 'The musician', story: 'Sells exclusive tracks and merch on Spotlight. His Backstage has nothing to do with his music — or everything. His call.' },
              { who: 'The educator', story: 'Runs a paid course channel. Professional, searchable, shareable with anyone. Zero stigma attached to their name.' },
            ].map(item => (
              <div key={item.who} style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '28px' }}>
                <div style={{ fontFamily: font.serif, fontSize: '18px', fontWeight: 400, color: '#fff', marginBottom: '12px' }}>{item.who}</div>
                <p style={{ fontSize: '13px', color: 'rgba(242,242,240,0.55)', lineHeight: 1.7, margin: 0 }}>{item.story}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY ── */}
      <section style={{ padding: '100px 40px', borderTop: `1px solid ${T.border}` }}>
        <div style={sectionWrap()}>
          <span style={kicker}>Dual identity</span>
          <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 300, color: '#fff', lineHeight: 1.05, marginBottom: '24px' }}>
            One login.<br /><em style={{ fontStyle: 'italic', color: T.purple }}>Two faces. Your rules.</em>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginBottom: '32px' }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.purple}`, padding: '32px' }}>
              <div style={{ fontFamily: font.mono, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: T.purple, marginBottom: '12px' }}>🔗 Linked</div>
              <p style={{ fontSize: '14px', color: 'rgba(242,242,240,0.7)', lineHeight: 1.7, margin: 0 }}>A Backstage badge appears on your Spotlight profile. Fans can navigate directly. Use it as an upsell — your exclusive world, one click away.</p>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.muted}`, padding: '32px' }}>
              <div style={{ fontFamily: font.mono, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: T.muted, marginBottom: '12px' }}>🔒 Unlinked</div>
              <p style={{ fontSize: '14px', color: 'rgba(242,242,240,0.7)', lineHeight: 1.7, margin: 0 }}>Zero trace on your Spotlight profile. Your Backstage is only discoverable through Backstage search or a direct link. Your employer will never know it exists unless you tell them.</p>
            </div>
          </div>
          <div style={{ borderLeft: `2px solid ${T.gold}`, background: `${T.gold}06`, padding: '24px 32px' }}>
            <p style={{ fontFamily: font.serif, fontSize: '20px', fontStyle: 'italic', fontWeight: 300, color: 'rgba(242,242,240,0.85)', margin: 0, lineHeight: 1.6 }}>
              "Your Spotlight and Backstage are invisible to each other unless you say so." — This single architecture decision unlocks careers that couldn't exist anywhere else.
            </p>
          </div>
        </div>
      </section>

      {/* ── CREATOR TIERS / MARQUEE ── */}
      <section style={{ padding: '100px 40px', borderTop: `1px solid ${T.border}` }}>
        <div style={sectionWrap()}>
          <span style={kicker}>The marquee</span>
          <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 300, color: '#fff', lineHeight: 1.05, marginBottom: '16px' }}>
            Every creator has<br /><em style={{ fontStyle: 'italic', color: T.gold }}>a place on the bill.</em>
          </h2>
          <p style={{ color: 'rgba(242,242,240,0.6)', fontSize: '16px', lineHeight: 1.8, maxWidth: '580px', marginBottom: '48px' }}>
            Your status on Spotlightly reflects what you earn — not what you post, not how long you've been here. 
            The top earners get top billing on the marquee. Something to work toward.
          </p>
          <div style={{ display: 'grid', gap: '2px', marginBottom: '16px' }}>
            {[
              { tier: 'Opening Act', range: 'Getting started', desc: 'You\'re on the stage. The crowd is watching. This is where every career begins.', color: T.muted },
              { tier: 'On the Rise', range: '$500–$2,500 / mo', desc: 'Momentum. You\'re building something real and the numbers are starting to show it.', color: T.mint },
              { tier: 'Spotlight', range: '$2,500–$10,000 / mo', desc: 'Center stage. You\'ve built an audience and a real business around your work.', color: T.gold },
              { tier: 'Headliner', range: '$10,000+ / mo', desc: 'Top billing on the marquee. Your name is the reason people show up.', color: T.purple },
            ].map(item => (
              <div key={item.tier} style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderLeft: `3px solid ${item.color}`,
                padding: '24px 32px',
                display: 'grid', gridTemplateColumns: '160px 1fr 240px', gap: '24px', alignItems: 'center',
              }}>
                <div style={{ fontFamily: font.serif, fontSize: '20px', fontWeight: 400, color: item.color }}>{item.tier}</div>
                <div style={{ fontSize: '14px', color: 'rgba(242,242,240,0.6)', lineHeight: 1.6 }}>{item.desc}</div>
                <div style={{ fontFamily: font.mono, fontSize: '11px', color: T.muted, textAlign: 'right' }}>{item.range}</div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: font.mono, fontSize: '10px', color: T.muted, letterSpacing: '0.08em' }}>
            * Status updates monthly based on earnings. Minimum posting activity required to maintain tier.
          </p>
        </div>
      </section>

      {/* ── SOCIAL POSTS ── */}
      <section style={{ padding: '100px 40px', borderTop: `1px solid ${T.border}` }}>
        <div style={sectionWrap()}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
            <div>
              <span style={kicker}>One page for everything</span>
              <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 300, color: '#fff', lineHeight: 1.1, marginBottom: '20px' }}>
                Paste a link.<br /><em style={{ fontStyle: 'italic', color: T.gold }}>It lives on your Spotlight.</em>
              </h2>
              <p style={{ color: 'rgba(242,242,240,0.6)', fontSize: '15px', lineHeight: 1.8, marginBottom: '24px' }}>
                Already posting on Instagram, TikTok, YouTube, or X? Paste those links into your 
                Spotlight dashboard. They pull into your feed automatically — caption, tags, and all — 
                alongside your native Spotlightly content. One page that shows everything you make, 
                everywhere you make it.
              </p>
              <p style={{ color: 'rgba(242,242,240,0.5)', fontSize: '14px', lineHeight: 1.8, margin: 0 }}>
                New creators can backfill their entire history on day one. Your page looks alive from the moment you claim it.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {['Instagram', 'TikTok', 'YouTube', 'X (Twitter)', 'Facebook'].map(platform => (
                <div key={platform} style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontFamily: font.mono, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted }}>{platform}</span>
                  <span style={{ fontFamily: font.mono, fontSize: '10px', color: T.mint }}>✓ Supported</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MONETIZATION ── */}
      <section style={{ padding: '100px 40px', borderTop: `1px solid ${T.border}` }}>
        <div style={sectionWrap()}>
          <span style={kicker}>The honest fee table</span>
          <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 300, color: '#fff', lineHeight: 1.05, marginBottom: '16px' }}>
            They take 20%.<br /><em style={{ fontStyle: 'italic', color: T.gold }}>We don't.</em>
          </h2>
          <p style={{ color: 'rgba(242,242,240,0.6)', fontSize: '16px', lineHeight: 1.8, maxWidth: '560px', marginBottom: '8px' }}>
            At 1,000 subscribers paying $10/month, a 20% platform cut is $2,000 a month leaving your pocket. 
            Every month. Forever.
          </p>
          <p style={{ color: 'rgba(242,242,240,0.4)', fontSize: '14px', lineHeight: 1.8, maxWidth: '560px', marginBottom: '48px' }}>
            Spotlightly takes a flat monthly creator fee. Everything else is yours minus Stripe's standard processing.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  {['Feature', 'How it works', 'Platform cut', 'Tier'].map(h => (
                    <th key={h} style={{ fontFamily: font.mono, fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: T.muted, textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Subscriptions', how: 'Monthly or annual fan subscriptions', cut: '0%', tier: 'Both', highlight: true },
                  { feature: 'Tips', how: 'Direct fan-to-creator. You keep all of it.', cut: '0%', tier: 'Both', highlight: true },
                  { feature: 'Digital products', how: 'Downloads, courses, files', cut: '0%', tier: 'Spotlight', highlight: true },
                  { feature: 'Merch', how: 'Printful fulfillment through your page', cut: '0%', tier: 'Spotlight', highlight: true },
                  { feature: 'Gift subscriptions', how: 'Fans gift your subscription to others', cut: '0%', tier: 'Both', highlight: true },
                  { feature: 'Social add-backs', how: 'Sell follow-backs on your social channels', cut: '0%', tier: 'Spotlight', highlight: true },
                  { feature: 'Super Tips', how: 'Gold border, pinned notification, supporter badge', cut: '15%', tier: 'Both', highlight: false },
                  { feature: 'Comment Boosts', how: 'Fan pins comment for 24 hours', cut: '100%', tier: 'Both', highlight: false },
                  { feature: 'Early Access Pass', how: '$2.99/mo — see posts 30 min early', cut: '100%', tier: 'Spotlight', highlight: false },
                ].map(row => (
                  <tr key={row.feature} style={{ background: row.highlight ? `${T.mint}05` : 'transparent' }}>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid rgba(255,255,255,0.03)`, color: '#fff', fontWeight: 500 }}>{row.feature}</td>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid rgba(255,255,255,0.03)`, color: 'rgba(242,242,240,0.6)' }}>{row.how}</td>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid rgba(255,255,255,0.03)`, fontFamily: font.mono, fontSize: '12px', color: row.cut === '0%' ? T.mint : T.gold }}>{row.cut}</td>
                    <td style={{ padding: '14px 16px', borderBottom: `1px solid rgba(255,255,255,0.03)`, color: T.muted, fontFamily: font.mono, fontSize: '11px' }}>{row.tier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderLeft: `2px solid ${T.mint}`, background: `${T.mint}06`, padding: '20px 28px', marginTop: '24px' }}>
            <p style={{ fontFamily: font.serif, fontSize: '16px', fontStyle: 'italic', color: 'rgba(242,242,240,0.8)', margin: 0 }}>
              0% on tips is both a business decision and a promise. "We don't take your tips" is part of who we are.
            </p>
          </div>
        </div>
      </section>

      {/* ── AUDIENCE TIERS ── */}
      <section style={{ padding: '100px 40px', borderTop: `1px solid ${T.border}` }}>
        <div style={sectionWrap()}>
          <span style={kicker}>Your audience</span>
          <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 300, color: '#fff', lineHeight: 1.05, marginBottom: '16px' }}>
            Not subscribers.<br /><em style={{ fontStyle: 'italic', color: T.gold }}>Audience members.</em>
          </h2>
          <p style={{ color: 'rgba(242,242,240,0.6)', fontSize: '16px', lineHeight: 1.8, maxWidth: '580px', marginBottom: '48px' }}>
            The people who show up for your work aren't just users in a database. They're your audience. 
            And the more they invest in you, the closer they get to the stage.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
            {[
              { tier: 'General Admission', desc: 'Free followers. The crowd at the door.', color: T.muted },
              { tier: 'Front Row', desc: 'Entry-level paid. Close enough to feel it.', color: '#60A5FA' },
              { tier: 'Mezzanine', desc: 'Mid-tier. The dedicated regulars.', color: T.gold },
              { tier: 'Suites', desc: 'Premium. The ones who never miss a show.', color: T.purple },
              { tier: 'Backstage Pass', desc: 'Top tier. They go where you go.', color: T.purple },
            ].map(item => (
              <div key={item.tier} style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${item.color}`, padding: '24px 20px' }}>
                <div style={{ fontFamily: font.serif, fontSize: '16px', color: item.color, marginBottom: '8px' }}>{item.tier}</div>
                <p style={{ fontSize: '12px', color: 'rgba(242,242,240,0.5)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLOSING CTA ── */}
      <section style={{ padding: '120px 40px', borderTop: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '1px', height: '40%', background: `linear-gradient(to bottom, ${T.gold}60, transparent)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '500px', height: '50%', background: `radial-gradient(ellipse 60% 100% at 50% 0%, ${T.gold}10, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={sectionWrap()}>
          <span style={kicker}>Your stage is waiting</span>
          <h2 style={{ fontFamily: font.serif, fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 300, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '24px' }}>
            Spot<span style={{ color: T.gold }}>light</span>ly
          </h2>
          <p style={{ fontFamily: font.serif, fontSize: '22px', fontStyle: 'italic', fontWeight: 300, color: 'rgba(242,242,240,0.5)', marginBottom: '48px' }}>
            Every creator deserves a spotlight. We built the whole venue.
          </p>
          <Link href="/signup" style={{
            display: 'inline-block',
            background: T.gold, color: T.bg,
            fontFamily: font.mono, fontSize: '12px', letterSpacing: '0.15em',
            textTransform: 'uppercase', fontWeight: 500,
            padding: '18px 48px', textDecoration: 'none', borderRadius: '4px',
          }}>
            Claim your handle
          </Link>
          <p style={{ fontFamily: font.mono, fontSize: '10px', color: T.muted, marginTop: '24px', letterSpacing: '0.08em' }}>
            No minimum followers. No approval. No waiting.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: '48px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
        <div style={{ fontFamily: font.serif, fontSize: '20px', fontWeight: 300, color: 'rgba(242,242,240,0.3)' }}>
          Spot<span style={{ color: T.gold }}>light</span>ly
        </div>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {['Terms', 'Privacy', 'About', '2257'].map(l => (
            <Link key={l} href={`/${l.toLowerCase()}`} style={{ fontFamily: font.mono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted, textDecoration: 'none' }}>{l}</Link>
          ))}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: '10px', color: T.muted, letterSpacing: '0.08em' }}>
          © 2025 Tahoma Systems LLC
        </div>
      </footer>

    </main>
  )
}

import React from 'react'

export default function StigmaSection() {
  return (
    <section style={{
      background: '#09090C',
      padding: '120px 40px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient light */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(ellipse, rgba(240,180,41,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '860px', margin: '0 auto', position: 'relative' }}>

        {/* Kicker */}
        <div style={{
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#71717A',
          marginBottom: '24px',
        }}>
          The platform problem
        </div>

        {/* Headline */}
        <h2 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(36px, 5vw, 60px)',
          fontWeight: 300,
          lineHeight: 1.05,
          color: '#fff',
          marginBottom: '24px',
          letterSpacing: '-0.01em',
        }}>
          Would you tell your employer<br />
          <em style={{ fontStyle: 'italic', color: '#F0B429' }}>you're on OnlyFans?</em>
        </h2>

        {/* Lede */}
        <p style={{
          fontSize: '18px',
          color: 'rgba(242,242,240,0.65)',
          lineHeight: 1.8,
          maxWidth: '640px',
          marginBottom: '64px',
        }}>
          You shouldn't have to think about that question. The platform you're on shouldn't define 
          what you do on it — but OnlyFans has a perception problem, and every creator on it 
          inherits that perception whether they post fitness content, music, or anything else.
        </p>

        {/* The contrast block */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2px',
          marginBottom: '64px',
        }}>
          {/* Them */}
          <div style={{
            background: '#111115',
            border: '1px solid rgba(255,255,255,0.07)',
            borderTop: '2px solid rgba(239,68,68,0.4)',
            padding: '36px',
          }}>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(239,68,68,0.5)',
              marginBottom: '20px',
            }}>
              Every other platform
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                'One brand. One reputation. You inherit all of it.',
                'Post yoga. Get associated with adult content anyway.',
                'Two platforms means two separate audiences forever.',
                'Your employer Googles you. They find your page.',
                'Leave when you grow. Start your audience over.',
              ].map((item, i) => (
                <li key={i} style={{
                  fontSize: '14px',
                  color: 'rgba(242,242,240,0.5)',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  paddingLeft: '20px',
                  position: 'relative',
                  lineHeight: 1.6,
                }}>
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    color: 'rgba(239,68,68,0.4)',
                    fontFamily: 'DM Mono, monospace',
                  }}>—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Us */}
          <div style={{
            background: '#111115',
            border: '1px solid rgba(255,255,255,0.07)',
            borderTop: '2px solid #F0B429',
            padding: '36px',
          }}>
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#F0B429',
              marginBottom: '20px',
            }}>
              Spotlightly
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                'Adult content lives in its own world. Your page stays clean.',
                'A fitness creator is a fitness creator. Full stop.',
                'One platform. Your whole career. Your audience follows.',
                'Your employer finds your Spotlight page — and that\'s it.',
                'Grow from new to established without starting over.',
              ].map((item, i) => (
                <li key={i} style={{
                  fontSize: '14px',
                  color: 'rgba(242,242,240,0.75)',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  paddingLeft: '20px',
                  position: 'relative',
                  lineHeight: 1.6,
                }}>
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    color: '#F0B429',
                    fontFamily: 'DM Mono, monospace',
                  }}>—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The architecture callout */}
        <div style={{
          borderLeft: '2px solid #A855F7',
          background: 'rgba(168,85,247,0.04)',
          padding: '32px 36px',
          marginBottom: '64px',
        }}>
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '9px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#A855F7',
            marginBottom: '12px',
          }}>
            How it actually works
          </div>
          <p style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '22px',
            fontWeight: 300,
            fontStyle: 'italic',
            color: 'rgba(242,242,240,0.9)',
            lineHeight: 1.6,
            margin: 0,
          }}>
            "Adult content exists here — but it lives in its own world. Your Spotlight page is yours, 
            clean, professional, with zero association to what happens in Backstage 
            unless <em style={{ color: '#F0B429' }}>you</em> choose otherwise."
          </p>
        </div>

        {/* Three proof points */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2px',
          marginBottom: '64px',
        }}>
          {[
            {
              who: 'The yoga instructor',
              truth: 'Posts fitness content. Has a Backstage for subscribers who want more. Her studio clients never know it exists.',
            },
            {
              who: 'The musician',
              truth: 'Sells exclusive tracks and merch on Spotlight. His Backstage has nothing to do with his music career — or everything. His call.',
            },
            {
              who: 'The educator',
              truth: 'Runs a paid course channel on Spotlight. Professional, searchable, shareable. Zero stigma attached.',
            },
          ].map((item, i) => (
            <div key={i} style={{
              background: '#111115',
              border: '1px solid rgba(255,255,255,0.07)',
              padding: '28px',
            }}>
              <div style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontSize: '18px',
                fontWeight: 400,
                color: '#fff',
                marginBottom: '12px',
              }}>
                {item.who}
              </div>
              <p style={{
                fontSize: '13px',
                color: 'rgba(242,242,240,0.6)',
                lineHeight: 1.7,
                margin: 0,
              }}>
                {item.truth}
              </p>
            </div>
          ))}
        </div>

        {/* Closing line */}
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: 'clamp(24px, 3vw, 36px)',
            fontWeight: 300,
            fontStyle: 'italic',
            color: 'rgba(242,242,240,0.5)',
            marginBottom: '32px',
          }}>
            Anyone can monetize. No stigma attached.
          </p>
          <a
            href="/signup"
            style={{
              display: 'inline-block',
              background: '#F0B429',
              color: '#09090C',
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 500,
              padding: '16px 36px',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            Claim your handle
          </a>
        </div>

      </div>
    </section>
  )
}

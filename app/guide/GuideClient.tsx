"use client";
import { useEffect } from "react";

const CSS = `  /* Map the guide's local tokens onto the site design system (theme-aware). */
  :root {
    --amber: var(--accent);
    --amber-dim: var(--accent-secondary);
    --amber-glow: var(--accent-soft);
    --surface2: var(--surface-2);
    --green: var(--accent-open);
    --purple: var(--accent-back);
    --pink: #EC4899;
    --blue: #5B9CF6;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }


  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    min-height: 100vh;
    background-image: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(242,184,75,0.10) 0%, transparent 70%);
    background-attachment: fixed;
  }

  /* ── Layout ── */
  .shell {
    display: flex;
    min-height: 100vh;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: 260px;
    flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 28px 0;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .sidebar-logo {
    padding: 0 24px 24px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
  }

  .sidebar-logo .wordmark {
    font-family: 'Cormorant Garamond', serif;
    font-size: 27px;
    font-weight: 400;
    color: var(--text);
    letter-spacing: -0.01em;
  }
  .sidebar-logo .wordmark span { color: var(--amber); }

  .sidebar-logo .sub {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .sidebar-section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--muted);
    padding: 0 24px 8px;
    margin-top: 12px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 24px;
    cursor: pointer;
    font-size: 13px;
    color: var(--muted);
    transition: color 0.15s, background 0.15s;
    border-left: 2px solid transparent;
  }

  .nav-item:hover { color: var(--text); background: var(--amber-glow); }
  .nav-item.active { color: var(--amber); border-left-color: var(--amber); background: var(--amber-glow); }
  .nav-item .icon { font-size: 15px; width: 18px; text-align: center; }
  .nav-item .check { margin-left: auto; font-size: 12px; color: var(--green); }

  .progress-bar-wrap {
    padding: 20px 24px 0;
    margin-top: auto;
    border-top: 1px solid var(--border);
  }

  .progress-label {
    font-size: 11px;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .progress-track {
    background: var(--border);
    border-radius: 99px;
    height: 4px;
  }

  .progress-fill {
    background: var(--amber);
    height: 4px;
    border-radius: 99px;
    transition: width 0.4s ease;
  }

  /* ── Main ── */
  .main {
    flex: 1;
    padding: 48px 56px;
    max-width: 800px;
  }

  /* ── Section ── */
  .section { display: none; }
  .section.visible { display: block; }

  .section-eyebrow {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--muted);
    margin-bottom: 10px;
  }

  .section-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    color: var(--text);
    margin-bottom: 12px;
  }

  .section-desc {
    font-size: 15px;
    color: var(--muted);
    max-width: 580px;
    margin-bottom: 36px;
    line-height: 1.7;
  }

  /* ── Steps ── */
  .steps { display: flex; flex-direction: column; gap: 4px; }

  .step {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    cursor: pointer;
    user-select: none;
  }

  .step-header:hover { background: var(--surface2); }

  .step-num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .step.done .step-num { background: var(--green); border-color: var(--green); color: #fff; }
  .step.open .step-num { background: var(--amber); border-color: var(--amber); color: #000; }

  .step-title-text {
    font-weight: 600;
    font-size: 14px;
    flex: 1;
  }

  .step-status {
    font-size: 11px;
    color: var(--muted);
  }

  .step.done .step-status { color: var(--green); }

  .step-chevron {
    color: var(--muted);
    font-size: 12px;
    transition: transform 0.2s;
  }

  .step.open .step-chevron { transform: rotate(90deg); color: var(--amber); }

  .step-body {
    display: none;
    padding: 0 20px 20px 62px;
    font-size: 14px;
    color: var(--muted);
    line-height: 1.75;
  }

  .step.open .step-body { display: block; }

  .step-body p { margin-bottom: 10px; }
  .step-body p:last-child { margin-bottom: 0; }

  .step-body ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 10px 0;
  }

  .step-body ul li::before {
    content: '→ ';
    color: var(--amber);
  }

  .step-body .tip {
    background: var(--amber-glow);
    border-left: 3px solid var(--amber);
    border-radius: 0 6px 6px 0;
    padding: 10px 14px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--text);
  }

  .step-body .tip strong { color: var(--amber); }

  .mark-done-btn {
    margin-top: 14px;
    padding: 8px 20px;
    background: transparent;
    border: 1px solid var(--amber);
    color: var(--amber);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }

  .mark-done-btn:hover { background: var(--amber-glow); }
  .step.done .mark-done-btn { opacity: 0.4; pointer-events: none; }

  /* ── Quiz Section ── */
  .quiz-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 16px;
  }

  .quiz-card h3 {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 8px;
  }

  .quiz-card p {
    color: var(--muted);
    font-size: 14px;
    margin-bottom: 20px;
  }

  .quiz-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .quiz-opt {
    padding: 11px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .quiz-opt:hover { border-color: var(--amber); background: var(--amber-glow); }
  .quiz-opt.selected { border-color: var(--amber); background: var(--amber-glow); color: var(--amber); }
  .quiz-opt .opt-icon { font-size: 18px; }

  .quiz-result {
    margin-top: 20px;
    padding: 16px 20px;
    border-radius: 8px;
    background: var(--surface2);
    border: 1px solid var(--border);
    font-size: 14px;
    display: none;
  }

  .quiz-result.show { display: block; }
  .quiz-result h4 { font-size: 15px; color: var(--amber); margin-bottom: 8px; }
  .quiz-result p { color: var(--muted); line-height: 1.7; }
  .quiz-result ul { list-style: none; margin-top: 8px; color: var(--muted); }
  .quiz-result ul li::before { content: '✦ '; color: var(--amber); }

  /* ── Monetization Grid ── */
  .mono-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
    margin-top: 8px;
  }

  .mono-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
    transition: border-color 0.2s;
  }

  .mono-card:hover { border-color: var(--amber); }

  .mono-icon { font-size: 24px; margin-bottom: 10px; }
  .mono-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
  .mono-desc { font-size: 13px; color: var(--muted); line-height: 1.6; }
  .mono-tag {
    display: inline-block;
    margin-top: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tag-free { background: rgba(76,175,125,0.15); color: var(--green); }
  .tag-spotlight { background: rgba(91,156,246,0.15); color: var(--blue); }
  .tag-backstage { background: rgba(167,139,250,0.15); color: var(--purple); }

  /* ── Nav Buttons ── */
  .nav-btns {
    display: flex;
    gap: 12px;
    margin-top: 40px;
    padding-top: 28px;
    border-top: 1px solid var(--border);
  }

  .btn-prev, .btn-next {
    padding: 12px 28px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Plus Jakarta Sans', sans-serif;
    transition: all 0.15s;
  }

  .btn-prev {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
  }

  .btn-prev:hover { border-color: var(--text); color: var(--text); }

  .btn-next {
    background: var(--amber);
    border: 1px solid var(--amber);
    color: #000;
  }

  .btn-next:hover { background: var(--amber-dim); }

  /* ── Highlight pill ── */
  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    vertical-align: middle;
  }

  .pill-free { background: rgba(76,175,125,0.15); color: var(--green); }
  .pill-spot { background: rgba(91,156,246,0.15); color: var(--blue); }
  .pill-back { background: rgba(167,139,250,0.15); color: var(--purple); }

  /* ── Responsive ── */
  @media (max-width: 720px) {
    .sidebar { display: none; }
    .main { padding: 28px 20px; }
    .section-title { font-size: 26px; }
  }`;

const HTML = `<div class="shell">

  <!-- Sidebar -->
  <nav class="sidebar">
    <div class="sidebar-logo">
      <a href="/" style="text-decoration:none;color:inherit;display:inline-block;"><div class="wordmark">Spot<span>light</span>ly</div></a>
      <div class="sub">Creator Onboarding Guide</div>
    </div>

    <div class="sidebar-section-label">Getting Started</div>
    <div class="nav-item active" data-sec="0"><span class="icon">👋</span> Welcome</div>
    <div class="nav-item" data-sec="1"><span class="icon">⚙️</span> Your Profile</div>
    <div class="nav-item" data-sec="2"><span class="icon">💳</span> Connect Stripe</div>

    <div class="sidebar-section-label">Posting Content</div>
    <div class="nav-item" data-sec="3"><span class="icon">📸</span> Instagram Posts</div>
    <div class="nav-item" data-sec="4"><span class="icon">🎬</span> TikTok Videos</div>
    <div class="nav-item" data-sec="5"><span class="icon">🤝</span> Follow-Backs</div>
    <div class="nav-item" data-sec="6"><span class="icon">⭐</span> Spotlightly Only Posts</div>

    <div class="sidebar-section-label">Monetize</div>
    <div class="nav-item" data-sec="7"><span class="icon">💰</span> How to Earn</div>
    <div class="nav-item" data-sec="8"><span class="icon">🤔</span> What's Your Niche?</div>

    <div class="progress-bar-wrap">
      <div class="progress-label">
        <span>Progress</span>
        <span id="prog-pct">0%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" id="prog-fill" style="width:0%"></div>
      </div>
    </div>
  </nav>

  <!-- Main -->
  <main class="main">

    <!-- ── 0. Welcome ── -->
    <div class="section visible" id="sec-0">
      <div class="section-eyebrow">Welcome to Spotlightly</div>
      <h1 class="section-title">You're in the right place.</h1>
      <p class="section-desc">This guide walks you through everything, setting up your profile, connecting payments, posting your first content, and actually making money. Work through each section at your own pace and check things off as you go.</p>

      <div class="steps">
        <div class="step open" id="w1">
          <div class="step-header" onclick="toggleStep('w1')">
            <div class="step-num">1</div>
            <div class="step-title-text">What is Spotlightly?</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Spotlightly is a creator platform where you control what fans see, and what they pay for. Your page is your Spotlight. You decide what is free for everyone and what is for paying subscribers.</p>
            <ul>
              <li><strong>Free posts.</strong> Your public content. Anyone can see it. Think of it as your front door.</li>
              <li><strong>Subscribers.</strong> Paying fans get deeper access. Behind the scenes, tutorials, exclusive drops.</li>
              <li><strong>Backstage.</strong> A separate, adult only space on Backstagely.app for creators who want it. Verified, private, and kept apart from your main page.</li>
            </ul>
            <div class="tip"><strong>Key difference from other platforms.</strong> You keep 100% of your listed price. Fans cover the card processing fee at checkout (2.9% plus 30 cents), so it never comes out of your earnings.</div>
            <button class="mark-done-btn" onclick="markDone('w1')">Got it ✓</button>
          </div>
        </div>

        <div class="step" id="w2">
          <div class="step-header" onclick="toggleStep('w2')">
            <div class="step-num">2</div>
            <div class="step-title-text">Your two public faces</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>You have one login, but two separate public profiles:</p>
            <ul>
              <li><strong>Your Spotlight page.</strong> Your main presence, where your free posts and subscriber posts live.</li>
              <li><strong>Your Backstage page</strong> (lives at Backstagely.app). Your separate, adult only space for your top supporters.</li>
            </ul>
            <p>You control the name, bio, and photo on each independently. Your real identity only needs to be on one if you prefer to stay semi anonymous on the other.</p>
            <button class="mark-done-btn" onclick="markDone('w2')">Got it ✓</button>
          </div>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-next" onclick="goTo(1)">Next: Set Up Your Profile →</button>
      </div>
    </div>

    <!-- ── 1. Profile ── -->
    <div class="section" id="sec-1">
      <div class="section-eyebrow">Step 1 of 8</div>
      <h1 class="section-title">Set up your profile.</h1>
      <p class="section-desc">Your profile is the first thing a potential fan sees. Spend 10 minutes here, it's worth it.</p>

      <div class="steps">
        <div class="step open" id="p1">
          <div class="step-header" onclick="toggleStep('p1')">
            <div class="step-num">1</div>
            <div class="step-title-text">Add your profile photo</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Go to <strong>Account → Edit Profile</strong>. Tap the photo circle to upload.</p>
            <ul>
              <li>Use a clear, well lit photo of your face or your brand logo.</li>
              <li>Square images work best. Minimum 400×400px.</li>
              <li>Avoid text heavy images. They don't scale well at small sizes.</li>
            </ul>
            <div class="tip"><strong>Tip:</strong> Creators with a real face photo convert 2 to 3 times better than those with logos or illustrations.</div>
            <button class="mark-done-btn" onclick="markDone('p1')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="p2">
          <div class="step-header" onclick="toggleStep('p2')">
            <div class="step-num">2</div>
            <div class="step-title-text">Write your bio</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Your bio appears on your public Spotlight page. Keep it to 2 to 3 sentences. Answer three questions:</p>
            <ul>
              <li>Who are you / what do you make?</li>
              <li>Why should someone follow you specifically?</li>
              <li>What do paying subscribers get that free followers don't?</li>
            </ul>
            <p><em>Example: "I teach woodworking to people who've never touched a saw. Every week I post a beginner project video free, subscribers get full plans, cut lists, and live Q&A."</em></p>
            <button class="mark-done-btn" onclick="markDone('p2')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="p3">
          <div class="step-header" onclick="toggleStep('p3')">
            <div class="step-num">3</div>
            <div class="step-title-text">Set your display name & handle</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Your handle becomes part of your public URL: <strong>spotlightly.app/yourhandle</strong></p>
            <ul>
              <li>Match it to your Instagram or TikTok handle if you have one. It makes cross promotion easier.</li>
              <li>Keep it short and lowercase. No spaces.</li>
              <li>You can use a pen name or brand name, it doesn't have to be your legal name.</li>
            </ul>
            <div class="tip"><strong>Tip:</strong> Once fans start linking to you, changing your handle breaks old links. Pick it carefully.</div>
            <button class="mark-done-btn" onclick="markDone('p3')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="p4">
          <div class="step-header" onclick="toggleStep('p4')">
            <div class="step-num">4</div>
            <div class="step-title-text">Set your subscription price</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Go to <strong>Account → Subscription Settings</strong>. Set your monthly price for the Spotlight tier.</p>
            <ul>
              <li>Most creators start between <strong>$3 and $10 a month</strong>.</li>
              <li>If you have a highly specialized skill (surveying, legal, medical, trading) you can charge $15 to $30 or more.</li>
              <li>You can always raise prices later. Subscribers on old plans are often grandfathered in.</li>
            </ul>
            <div class="tip"><strong>Remember.</strong> You keep 100% of your listed price. Fans cover the card processing fee at checkout (2.9% plus 30 cents). You never see it deducted.</div>
            <button class="mark-done-btn" onclick="markDone('p4')">Done ✓</button>
          </div>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-prev" onclick="goTo(0)">← Back</button>
        <button class="btn-next" onclick="goTo(2)">Next: Connect Stripe →</button>
      </div>
    </div>

    <!-- ── 2. Stripe ── -->
    <div class="section" id="sec-2">
      <div class="section-eyebrow">Step 2 of 8</div>
      <h1 class="section-title">Connect Stripe to get paid.</h1>
      <p class="section-desc">Stripe is how Spotlightly sends you money. It's free to set up and takes about 5 minutes. You won't receive payouts until this is complete.</p>

      <div class="steps">
        <div class="step open" id="s1">
          <div class="step-header" onclick="toggleStep('s1')">
            <div class="step-num">1</div>
            <div class="step-title-text">Go to Payments in your dashboard</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>From your creator dashboard, go to <strong>Payments → Connect Stripe</strong>. Tap the yellow "Connect with Stripe" button.</p>
            <p>You'll be taken to Stripe's website to create or connect your account.</p>
            <button class="mark-done-btn" onclick="markDone('s1')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="s2">
          <div class="step-header" onclick="toggleStep('s2')">
            <div class="step-num">2</div>
            <div class="step-title-text">Create or log into your Stripe account</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>If you already have a Stripe account (from another business or platform), log in. Otherwise, create a new one.</p>
            <p>Stripe will ask for:</p>
            <ul>
              <li>Your legal name and date of birth</li>
              <li>Your home address</li>
              <li>Your Social Security Number (last 4 digits, sometimes full)</li>
              <li>Your bank account or debit card for payouts</li>
            </ul>
            <div class="tip"><strong>Why does Stripe need this?</strong> U.S. law requires payment processors to verify the identity of anyone receiving money. This is standard, Stripe does not share your info with Spotlightly.</div>
            <button class="mark-done-btn" onclick="markDone('s2')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="s3">
          <div class="step-header" onclick="toggleStep('s3')">
            <div class="step-num">3</div>
            <div class="step-title-text">Authorize the connection</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>After entering your info, Stripe will ask if you want to authorize Spotlightly to process payments on your behalf. Tap <strong>Authorize</strong>.</p>
            <p>You'll be redirected back to Spotlightly with a green confirmation.</p>
            <div class="tip"><strong>Payouts:</strong> By default Stripe pays out to your bank on a 2 day rolling basis. You can adjust this in your Stripe dashboard under "Payouts."</div>
            <button class="mark-done-btn" onclick="markDone('s3')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="s4">
          <div class="step-header" onclick="toggleStep('s4')">
            <div class="step-num">4</div>
            <div class="step-title-text">Backstage payments (CCBill)</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>If you plan to offer <strong>Backstage</strong> content (your highest tier premium content), that tier uses CCBill, a separate payment processor built for adult or mature content platforms.</p>
            <ul>
              <li>CCBill setup is done from your <strong>Backstagely.app</strong> dashboard, not Spotlightly.</li>
              <li>You'll need to submit a short application. Approval usually takes 1 to 3 business days.</li>
              <li>Backstage uses CCBill, which adds its own processing fee at checkout. You still keep 100% of your listed price.</li>
            </ul>
            <div class="tip"><strong>Skip this for now</strong> if you're just getting started. Get your main page earning first, then layer in Backstage.</div>
            <button class="mark-done-btn" onclick="markDone('s4')">Done ✓</button>
          </div>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-prev" onclick="goTo(1)">← Back</button>
        <button class="btn-next" onclick="goTo(3)">Next: Instagram Posts →</button>
      </div>
    </div>

    <!-- ── 3. Instagram ── -->
    <div class="section" id="sec-3">
      <div class="section-eyebrow">Step 3 of 8</div>
      <h1 class="section-title">Show your Instagram on your page.</h1>
      <p class="section-desc">Add your Instagram and your latest posts show up on your page automatically, so it never looks empty.</p>

      <div class="steps">
        <div class="step open" id="ig1">
          <div class="step-header" onclick="toggleStep('ig1')">
            <div class="step-num">1</div>
            <div class="step-title-text">Connect your Instagram account</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Go to your <strong>profile editor</strong> and add your Instagram handle under social links.</p>
            <p>Your recent public posts then embed on your page. Spotlightly never posts to Instagram on your behalf.</p>
            <button class="mark-done-btn" onclick="markDone('ig1')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="ig2">
          <div class="step-header" onclick="toggleStep('ig2')">
            <div class="step-num">2</div>
            <div class="step-title-text">Decide what lives on Spotlightly</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Your embedded Instagram posts give visitors something to look at. To put work behind a subscription, post it directly in Spotlightly.</p>
            <ul>
              <li>Free posts are visible to everyone.</li>
              <li>Subscriber posts are visible only to paying fans.</li>
              <li>You choose the audience on every post you create.</li>
            </ul>
            <div class="tip"><strong>Strategy:</strong> Lead with your best free posts. This gives new visitors something to read before they decide to subscribe.</div>
            <button class="mark-done-btn" onclick="markDone('ig2')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="ig3">
          <div class="step-header" onclick="toggleStep('ig3')">
            <div class="step-num">3</div>
            <div class="step-title-text">Post new content directly</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>To post a photo or carousel directly (without pulling from Instagram):</p>
            <ul>
              <li>Tap <strong>+ New Post → Photo/Video</strong></li>
              <li>Upload your image(s), up to 10 in a carousel</li>
              <li>Write your caption</li>
              <li>Choose your audience tier</li>
              <li>Tap <strong>Publish</strong></li>
            </ul>
            <p>You can also schedule posts, set a date and time and Spotlightly publishes automatically.</p>
            <button class="mark-done-btn" onclick="markDone('ig3')">Done ✓</button>
          </div>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-prev" onclick="goTo(2)">← Back</button>
        <button class="btn-next" onclick="goTo(4)">Next: TikTok Videos →</button>
      </div>
    </div>

    <!-- ── 4. TikTok ── -->
    <div class="section" id="sec-4">
      <div class="section-eyebrow">Step 4 of 8</div>
      <h1 class="section-title">Show your TikTok on your page.</h1>
      <p class="section-desc">Vertical short form video is one of the fastest ways to grow. Here is how to feature your TikToks on Spotlightly.</p>

      <div class="steps">
        <div class="step open" id="tt1">
          <div class="step-header" onclick="toggleStep('tt1')">
            <div class="step-num">1</div>
            <div class="step-title-text">Connect your TikTok account</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Go to your <strong>profile editor</strong> and add your TikTok handle under social links.</p>
            <p>Your recent public TikToks then embed on your page. Spotlightly never posts to TikTok on your behalf.</p>
            <button class="mark-done-btn" onclick="markDone('tt1')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="tt2">
          <div class="step-header" onclick="toggleStep('tt2')">
            <div class="step-num">2</div>
            <div class="step-title-text">Post the full version on Spotlightly</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Post a teaser clip on TikTok publicly, then put the full length version on Spotlightly behind a subscription.</p>
            <ul>
              <li>Free posts are visible to everyone</li>
              <li>Subscriber posts are visible only to paying fans</li>
              <li>Videos play natively inside Spotlightly, so fans don't have to leave</li>
            </ul>
            <div class="tip"><strong>Pro move.</strong> "Full video on my Spotlightly" converts well. The teaser does the reach, the full cut does the earning.</div>
            <button class="mark-done-btn" onclick="markDone('tt2')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="tt3">
          <div class="step-header" onclick="toggleStep('tt3')">
            <div class="step-num">3</div>
            <div class="step-title-text">Upload video directly</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>To upload a video file from your phone or computer:</p>
            <ul>
              <li>Tap <strong>+ New Post → Video</strong></li>
              <li>Upload your .mp4 or .mov file (up to 500MB)</li>
              <li>Add a title, caption, and thumbnail</li>
              <li>Set the audience tier and publish</li>
            </ul>
            <p>Vertical (9:16) video works best. Landscape (16:9) is also supported.</p>
            <button class="mark-done-btn" onclick="markDone('tt3')">Done ✓</button>
          </div>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-prev" onclick="goTo(3)">← Back</button>
        <button class="btn-next" onclick="goTo(5)">Next: Follow-Backs →</button>
      </div>
    </div>

    <!-- ── 5. Follow-Backs ── -->
    <div class="section" id="sec-5">
      <div class="section-eyebrow">Step 5 of 8</div>
      <h1 class="section-title">Sell follow-backs.</h1>
      <p class="section-desc">A follow-back is something fans can buy: you follow them back on Instagram, TikTok, or another platform. A real listing, not a DM favor.</p>

      <div class="steps">
        <div class="step open" id="sn1">
          <div class="step-header" onclick="toggleStep('sn1')">
            <div class="step-num">1</div>
            <div class="step-title-text">How follow-backs work</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>You set a price for a follow-back on each platform you want to offer. A fan pays, then enters the handle they want followed.</p>
            <ul>
              <li>Set a price per platform (Instagram, TikTok, X, and more)</li>
              <li>The fan enters their handle at checkout</li>
              <li>You keep 100%. Fans cover the card fee at checkout</li>
            </ul>
            <div class="tip"><strong>Every order lands in your dashboard</strong> with exactly who to follow, so nothing depends on remembering a DM.</div>
            <button class="mark-done-btn" onclick="markDone('sn1')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="sn2">
          <div class="step-header" onclick="toggleStep('sn2')">
            <div class="step-num">2</div>
            <div class="step-title-text">Set up a follow-back listing</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Go to <strong>Social</strong> in your dashboard, open <strong>Sell Follow-Backs</strong>, and add a listing.</p>
            <ul>
              <li>Pick the platform and set your price</li>
              <li>Add a short note about what fans get, if you like</li>
              <li>Save the listing. It appears on your page for fans to buy</li>
              <li>When an order comes in, open <strong>Orders to fulfill</strong>, follow them, and mark it done</li>
            </ul>
            <p>You keep every dollar of the price. Spotlightly takes nothing on follow-backs.</p>
            <button class="mark-done-btn" onclick="markDone('sn2')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="sn3">
          <div class="step-header" onclick="toggleStep('sn3')">
            <div class="step-num">3</div>
            <div class="step-title-text">Follow-back strategy</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Price follow-backs so they feel like a small treat, not a big ask. Many creators start at $3 to $10.</p>
            <ul>
              <li>Mention follow-backs in a post or on live, so fans know they exist</li>
              <li>Fulfil orders quickly. A fast follow back is what people are paying for</li>
              <li>Offer the platforms you actually use and check often</li>
            </ul>
            <button class="mark-done-btn" onclick="markDone('sn3')">Done ✓</button>
          </div>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-prev" onclick="goTo(4)">← Back</button>
        <button class="btn-next" onclick="goTo(6)">Next: Spotlightly Only Posts →</button>
      </div>
    </div>

    <!-- ── 6. Spotlightly Only ── -->
    <div class="section" id="sec-6">
      <div class="section-eyebrow">Step 6 of 8</div>
      <h1 class="section-title">Spotlightly only posts.</h1>
      <p class="section-desc">This is your most powerful tool. Content that exists nowhere else is the reason fans pay you instead of just following you for free.</p>

      <div class="steps">
        <div class="step open" id="so1">
          <div class="step-header" onclick="toggleStep('so1')">
            <div class="step-num">1</div>
            <div class="step-title-text">What counts as Spotlightly only content?</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Any post you create directly in Spotlightly and set to subscribers only, without cross posting it to Instagram, TikTok, or anywhere else.</p>
            <p>Examples:</p>
            <ul>
              <li>Full length tutorials that you only tease on TikTok</li>
              <li>Extended Q&A sessions with subscribers</li>
              <li>Downloadable files (PDFs, templates, guides, presets)</li>
              <li>Polls and subscriber only discussions</li>
              <li>Personal updates you don't share publicly</li>
              <li>Early access to new work before it goes public</li>
            </ul>
            <button class="mark-done-btn" onclick="markDone('so1')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="so2">
          <div class="step-header" onclick="toggleStep('so2')">
            <div class="step-num">2</div>
            <div class="step-title-text">Create your first exclusive post</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Tap <strong>+ New Post</strong> and choose your format:</p>
            <ul>
              <li><strong>Text Post</strong>, Long form writing, announcements, opinion pieces</li>
              <li><strong>Photo Post</strong>, Gallery or single image</li>
              <li><strong>Video</strong>, Up to 500MB</li>
              <li><strong>File Download</strong>, PDF, ZIP, any file type</li>
              <li><strong>Poll</strong>, Ask your subscribers a question</li>
            </ul>
            <p>Set the audience to <strong>subscribers only</strong> before publishing. Free followers see a blurred preview and a prompt to subscribe.</p>
            <div class="tip"><strong>First post idea:</strong> Write a "subscriber welcome" post. Introduce yourself more personally, explain what you plan to share here, and thank them. It takes 5 minutes and sets a great tone.</div>
            <button class="mark-done-btn" onclick="markDone('so2')">Done ✓</button>
          </div>
        </div>

        <div class="step" id="so3">
          <div class="step-header" onclick="toggleStep('so3')">
            <div class="step-num">3</div>
            <div class="step-title-text">Sell individual posts (pay per view)</div>
            <div class="step-chevron">▶</div>
          </div>
          <div class="step-body">
            <p>Not everything needs to be behind a subscription. You can also sell individual posts at a fixed price.</p>
            <ul>
              <li>Set a post to <strong>Paid Unlock</strong> and enter a price</li>
              <li>Fans pay once to unlock that specific post permanently</li>
              <li>Great for one off guides, templates, tutorial packs, or digital downloads</li>
            </ul>
            <div class="tip"><strong>You keep 100%</strong> of the listed price. Fans cover the card fee at checkout (2.9% plus 30 cents). No subscription required, so this works for one time buyers too.</div>
            <button class="mark-done-btn" onclick="markDone('so3')">Done ✓</button>
          </div>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-prev" onclick="goTo(5)">← Back</button>
        <button class="btn-next" onclick="goTo(7)">Next: How to Earn →</button>
      </div>
    </div>

    <!-- ── 7. Monetize ── -->
    <div class="section" id="sec-7">
      <div class="section-eyebrow">Step 7 of 8</div>
      <h1 class="section-title">Here's how you earn.</h1>
      <p class="section-desc">Multiple ways to make money on Spotlightly. Pick the ones that fit how you create.</p>

      <div class="mono-grid">
        <div class="mono-card">
          <div class="mono-icon">📬</div>
          <div class="mono-title">Monthly Subscriptions</div>
          <div class="mono-desc">Fans pay monthly for access to your subscriber posts. Recurring revenue that grows as you post consistently.</div>
          <span class="mono-tag tag-spotlight">Subscribers</span>
        </div>
        <div class="mono-card">
          <div class="mono-icon">🔓</div>
          <div class="mono-title">Pay Per View Unlocks</div>
          <div class="mono-desc">Sell individual posts at a fixed price. One time purchase, permanent access. Great for guides, templates, and downloads.</div>
          <span class="mono-tag tag-spotlight">Subscribers</span>
        </div>
        <div class="mono-card">
          <div class="mono-icon">👑</div>
          <div class="mono-title">Backstage Premium</div>
          <div class="mono-desc">Your highest tier. Charge a premium monthly rate for your most exclusive content and most personal connection.</div>
          <span class="mono-tag tag-backstage">Backstage</span>
        </div>
        <div class="mono-card">
          <div class="mono-icon">💌</div>
          <div class="mono-title">Front Row Messages</div>
          <div class="mono-desc">Fans pay to send you a direct message. Great for coaching, advice, and custom requests. (A platform feature, so revenue is shared.)</div>
          <span class="mono-tag tag-spotlight">Subscribers</span>
        </div>
        <div class="mono-card">
          <div class="mono-icon">🎁</div>
          <div class="mono-title">Tips & Gifts</div>
          <div class="mono-desc">Fans can tip you any amount on any post. You keep all of it, Spotlightly takes 0% on tips. No subscription needed.</div>
          <span class="mono-tag tag-free">All fans</span>
        </div>
        <div class="mono-card">
          <div class="mono-icon">📦</div>
          <div class="mono-title">Digital Products</div>
          <div class="mono-desc">Upload and sell files directly, PDF guides, presets, templates, ebooks, courses, spreadsheets. Set your own price.</div>
          <span class="mono-tag tag-spotlight">Subscribers</span>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-prev" onclick="goTo(6)">← Back</button>
        <button class="btn-next" onclick="goTo(8)">Next: Find Your Niche →</button>
      </div>
    </div>

    <!-- ── 8. Quiz ── -->
    <div class="section" id="sec-8">
      <div class="section-eyebrow">Step 8 of 8</div>
      <h1 class="section-title">Let's figure out your angle.</h1>
      <p class="section-desc">Answer a few questions and we'll suggest the best way to structure your Spotlightly for what you actually do.</p>

      <!-- Q1 -->
      <div class="quiz-card" id="q1-card">
        <h3>What do you make or do?</h3>
        <p>Pick the one that fits best, you can always mix later.</p>
        <div class="quiz-options">
          <div class="quiz-opt" onclick="selectOpt(event, 'q1','fitness')"><span class="opt-icon">💪</span> Fitness / Health / Wellness</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q1','craft')"><span class="opt-icon">🛠️</span> Crafts / Art / Making things</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q1','education')"><span class="opt-icon">📚</span> Teaching / Tutorials / Expertise</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q1','entertainment')"><span class="opt-icon">🎭</span> Entertainment / Comedy / Personality</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q1','writing')"><span class="opt-icon">✍️</span> Writing / Storytelling / Author</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q1','lifestyle')"><span class="opt-icon">🌿</span> Lifestyle / Travel / Food</div>
        </div>
        <div class="quiz-result" id="q1-result"></div>
      </div>

      <!-- Q2 -->
      <div class="quiz-card" id="q2-card">
        <h3>How often can you realistically post?</h3>
        <p>Be honest, consistency matters more than volume.</p>
        <div class="quiz-options">
          <div class="quiz-opt" onclick="selectOpt(event, 'q2','daily')"><span class="opt-icon">⚡</span> Daily or near daily</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q2','weekly')"><span class="opt-icon">📅</span> A few times a week</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q2','biweekly')"><span class="opt-icon">🌙</span> Once or twice a week</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q2','monthly')"><span class="opt-icon">🏔️</span> A few times a month</div>
        </div>
        <div class="quiz-result" id="q2-result"></div>
      </div>

      <!-- Q3 -->
      <div class="quiz-card" id="q3-card">
        <h3>What's your main monetization goal?</h3>
        <p>Where do you want the money to actually come from?</p>
        <div class="quiz-options">
          <div class="quiz-opt" onclick="selectOpt(event, 'q3','recurring')"><span class="opt-icon">🔄</span> Steady monthly income I can count on</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q3','products')"><span class="opt-icon">🛒</span> Selling things, guides, templates, downloads</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q3','coaching')"><span class="opt-icon">🧑‍🏫</span> 1 on 1 access, coaching, DMs, consultation</div>
          <div class="quiz-opt" onclick="selectOpt(event, 'q3','tips')"><span class="opt-icon">💝</span> Tips and support from fans who like my work</div>
        </div>
        <div class="quiz-result" id="q3-result"></div>
      </div>

      <!-- Final CTA -->
      <div id="quiz-cta" style="display:none; margin-top:28px; background:var(--surface); border:1px solid var(--amber); border-radius:12px; padding:28px;">
        <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:var(--amber);margin-bottom:12px;">You're ready. Go post something.</div>
        <p style="color:var(--muted);font-size:14px;line-height:1.7;">The best thing you can do right now is publish one piece of real content, a post or a video. Don't wait until everything is perfect. Fans subscribe to real people, not polished brands.</p>
        <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;">
          <button onclick="goTo(6)" style="padding:10px 22px;background:var(--amber);color:#000;border:none;border-radius:7px;font-weight:600;font-size:14px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;">Post your first exclusive →</button>
          <button onclick="goTo(0)" style="padding:10px 22px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:7px;font-size:14px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;">Review from the start</button>
        </div>
      </div>

      <div class="nav-btns">
        <button class="btn-prev" onclick="goTo(7)">← Back</button>
      </div>
    </div>

  </main>
</div>`;

export default function GuideClient() {
  useEffect(() => {
    const completedSteps: Record<string, boolean> = {};
    const quizAnswers: Record<string, string> = {};
  const qResults: any = {
    q1: {
      fitness: { title: "Fitness Creator", body: "Your best content is video first. Use TikToks as free teasers, put full workout programs and meal plans behind a subscription. Front Row Messages for coaching questions.", tags: ["Video posts", "PDF meal/workout plans", "Paid DMs for coaching"] },
      craft: { title: "Maker / Artist", body: "Your fans want to see your process. Document builds on TikTok as free posts, then sell full tutorials and downloadable patterns or templates as subscriber posts.", tags: ["Process videos", "Downloadable files", "Project galleries"] },
      education: { title: "Expert / Teacher", body: "You can charge more per subscriber because your content has direct value. Subscriptions for course style content, paid unlocks for individual guides, Front Row Messages for direct questions.", tags: ["Long form tutorials", "PDF guides & templates", "Q&A posts"] },
      entertainment: { title: "Entertainer / Personality", body: "Volume and consistency is your engine. Post short updates daily, longer content a few times a week. Tips and personal access are your top earners.", tags: ["Daily posts", "Behind the scenes", "Backstage personal access"] },
      writing: { title: "Writer / Author", body: "Serialized content works incredibly well here. Post free opening chapters for everyone, put full books or chapters behind a subscription. Sell finished works as one time paid unlocks.", tags: ["Serialized chapters", "Digital downloads", "Early access posts"] },
      lifestyle: { title: "Lifestyle Creator", body: "Your subscribers pay to be in your world. Mix short and long posts freely. Authenticity drives retention more than production quality. Tips and monthly subscriptions are your core.", tags: ["Daily/weekly posts", "Location posts", "Subscriber tips"] }
    },
    q2: {
      daily: { title: "Daily Poster", body: "You can charge a lower subscription price and make it up in volume. Use short posts for the daily cadence, they take seconds each. Save your energy for one or two big posts per week." },
      weekly: { title: "Regular Poster", body: "Three to four posts per week is a strong, sustainable cadence. Mix short posts on lighter days with full posts on your main days. Set subscriber expectations clearly in your bio." },
      biweekly: { title: "Weekly Creator", body: "One or two quality posts per week works well if they're consistently good. Charge a mid range subscription price and make it clear you prioritize quality over quantity." },
      monthly: { title: "Infrequent Poster", body: "Consider a lower subscription price ($3 to $5 a month) and leaning on one time unlock purchases instead. Individual paid posts work well when you post fewer but bigger things." }
    },
    q3: {
      recurring: { title: "Subscription Focus", body: "Set a sustainable subscription price, post consistently, and treat your subscribers like a community. Monthly subscriptions compound fast once you pass 100 subscribers." },
      products: { title: "Product Sales Focus", body: "Use the Paid Unlock feature for every significant piece of content. Bundle related posts into collections. Treat Spotlightly like a digital storefront. Your feed is your product catalog." },
      coaching: { title: "1-on-1 / Coaching Focus", body: "Turn on Front Row Messages. Charge per message or per session. Keep your subscription price lower to attract people, then upsell them on personal access." },
      tips: { title: "Community / Tips Focus", body: "Enable tips on all your posts. Post freely and consistently to build loyalty. Even small but engaged audiences can generate meaningful tip revenue when fans feel personally connected to you." }
    }
  };

    function selectOpt(e: any, qId: string, value: string) {
      document.querySelectorAll(`#${qId}-card .quiz-opt`).forEach((o) => o.classList.remove("selected"));
      e.currentTarget.classList.add("selected");
      quizAnswers[qId] = value;
      const res = qResults[qId][value];
      const resultEl = document.getElementById(`${qId}-result`) as HTMLElement;
      let tagsHtml = "";
      if (res.tags) tagsHtml = "<ul>" + res.tags.map((t: string) => `<li>${t}</li>`).join("") + "</ul>";
      resultEl.innerHTML = `<h4>${res.title}</h4><p>${res.body}</p>${tagsHtml}`;
      resultEl.classList.add("show");
      if (Object.keys(quizAnswers).length === 3) (document.getElementById("quiz-cta") as HTMLElement).style.display = "block";
    }
    function updateProgress() {
      const done = Object.keys(completedSteps).length;
      const total = document.querySelectorAll(".mark-done-btn").length;
      const pct = Math.round((done / total) * 100);
      (document.getElementById("prog-fill") as HTMLElement).style.width = pct + "%";
      (document.getElementById("prog-pct") as HTMLElement).textContent = pct + "%";
    }
    function toggleStep(id: string) {
      const step = document.getElementById(id) as HTMLElement;
      const isOpen = step.classList.contains("open");
      step.closest(".steps")!.querySelectorAll(".step").forEach((s) => s.classList.remove("open"));
      if (!isOpen) step.classList.add("open");
    }
    function markDone(id: string) {
      const step = document.getElementById(id) as HTMLElement;
      step.classList.add("done");
      step.classList.remove("open");
      completedSteps[id] = true;
      updateProgress();
    }
    function goTo(idx: number) {
      document.querySelectorAll(".section").forEach((s) => s.classList.remove("visible"));
      document.getElementById("sec-" + idx)?.classList.add("visible");
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      document.querySelectorAll(".nav-item")[idx]?.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    (window as any).selectOpt = selectOpt;
    (window as any).toggleStep = toggleStep;
    (window as any).markDone = markDone;
    (window as any).goTo = goTo;

    const navItems = Array.from(document.querySelectorAll(".nav-item"));
    const offs = navItems.map((item, i) => {
      const h = () => goTo(i);
      item.addEventListener("click", h);
      return () => item.removeEventListener("click", h);
    });

    return () => {
      offs.forEach((o) => o());
      delete (window as any).selectOpt;
      delete (window as any).toggleStep;
      delete (window as any).markDone;
      delete (window as any).goTo;
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: HTML }} />
    </>
  );
}

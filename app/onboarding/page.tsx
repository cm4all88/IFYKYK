"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";
import { CREATOR_CATEGORIES } from "@/lib/categories";
import ImageUpload from "@/components/ImageUpload";

type Step = "stage" | "about" | "profile" | "stripe" | "done";

interface AIResponse {
  greeting: string;
  recommendations: { emoji: string; title: string; desc: string }[];
  suggestedTags: string[];
  suggestedBio: string;
  followUpAnswer?: string;
}

const SHARED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .onb-root {
    min-height: 100vh;
    min-height: 100dvh;
    background: #09090C;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 80px 20px 40px;
  }
  .onb-root.dark { background: #17181B; }

  .onb-logo {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px;
    font-weight: 300;
    color: rgba(255,255,255,0.45);
    text-decoration: none;
    white-space: nowrap;
    z-index: 10;
  }
  .onb-logo span { color: rgba(242,184,75,0.7); }

  .onb-glow-top {
    position: fixed; top: 0; left: 50%; transform: translateX(-50%);
    width: min(600px, 90vw); height: 60%;
    background: radial-gradient(ellipse 70% 100% at 50% 0%, rgba(242,184,75,0.11) 0%, transparent 65%);
    pointer-events: none; z-index: 0;
  }
  .onb-glow-bottom {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 70%; height: 180px;
    background: radial-gradient(ellipse 80% 60% at 50% 100%, rgba(242,184,75,0.07), transparent 70%);
    pointer-events: none; z-index: 0;
  }
  .onb-bg {
    position: fixed; inset: 0;
    background-image: url('/hero-bg.jpg');
    background-size: cover; background-position: center top;
    opacity: 0.06; pointer-events: none; z-index: 0;
  }

  /* ── STAGE ── */
  .stage-wrap {
    position: relative; z-index: 1;
    text-align: center; width: 100%; max-width: 520px;
  }
  .stage-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(44px, 12vw, 80px);
    font-weight: 300; line-height: 1;
    letter-spacing: -0.02em; color: #fff;
    margin-bottom: 8px; min-height: 1.1em;
    transition: all 0.1s;
  }
  .stage-line {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(242,184,75,0.6), transparent);
    margin: 0 auto 32px;
    transition: width 0.4s ease;
  }
  .stage-label {
    font-family: 'Cormorant Garamond', serif;
    font-size: 17px; font-style: italic;
    color: rgba(247,243,236,0.4);
    margin-bottom: 28px; line-height: 1.6;
  }
  .stage-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-bottom: 2px solid rgba(242,184,75,0.4);
    border-radius: 4px 4px 0 0;
    padding: 16px 20px;
    color: #F7F3EC; font-size: 17px;
    outline: none;
    font-family: 'Cormorant Garamond', serif;
    text-align: center; letter-spacing: 0.02em;
    margin-bottom: 16px;
    -webkit-appearance: none;
  }
  .stage-handle {
    font-family: 'DM Mono', monospace;
    font-size: 10px; color: rgba(255,255,255,0.2);
    letter-spacing: 0.1em; margin-top: 16px;
  }

  /* ── ABOUT ── */
  .about-wrap {
    position: relative; z-index: 1;
    width: 100%; max-width: 560px;
  }
  .about-loading {
    text-align: center; padding: 60px 0;
  }
  .about-loading-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px; font-style: italic;
    color: rgba(242,184,75,0.6); margin-bottom: 20px;
  }
  .pulse-dots { display: flex; gap: 8px; justify-content: center; }
  .pulse-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: rgba(242,184,75,0.45);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .pulse-dot:nth-child(2) { animation-delay: 0.2s; }
  .pulse-dot:nth-child(3) { animation-delay: 0.4s; }

  .about-fallback-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(28px, 7vw, 44px);
    font-weight: 300; color: #fff;
    line-height: 1.05; margin-bottom: 12px; text-align: center;
  }
  .about-fallback-sub {
    font-size: 14px; color: rgba(247,243,236,0.45);
    line-height: 1.8; margin-bottom: 24px; text-align: center;
  }
  .about-input {
    width: 100%;
    background: #232428;
    border: 1px solid rgba(255,255,255,0.08);
    border-bottom: 2px solid rgba(242,184,75,0.3);
    border-radius: 6px 6px 0 0;
    padding: 14px 18px; color: #F7F3EC;
    font-size: 15px; outline: none; font-family: inherit;
    margin-bottom: 14px; -webkit-appearance: none;
  }
  .about-greeting {
    border-left: 2px solid rgba(242,184,75,0.5);
    background: rgba(242,184,75,0.06);
    padding: 18px 20px; border-radius: 0 6px 6px 0;
    margin-bottom: 20px;
    font-size: 14px; color: rgba(247,243,236,0.85); line-height: 1.8;
  }
  .about-recs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
  .about-rec {
    display: flex; align-items: flex-start; gap: 14px;
    background: #232428; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 6px; padding: 14px 16px;
    animation: fadeUp 0.3s ease both;
  }
  .about-rec-emoji { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
  .about-rec-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 3px; }
  .about-rec-desc { font-size: 13px; color: rgba(247,243,236,0.5); line-height: 1.6; }
  .about-followup-answer {
    border-left: 2px solid rgba(168,85,247,0.5);
    background: rgba(168,85,247,0.06);
    padding: 14px 18px; border-radius: 0 6px 6px 0; margin-bottom: 18px;
    font-size: 13px; color: rgba(247,243,236,0.8); line-height: 1.75;
  }
  .about-followup-row { display: flex; gap: 8px; margin-bottom: 18px; }
  .about-followup-input {
    flex: 1; background: #232428;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px; padding: 12px 14px;
    color: #F7F3EC; font-size: 13px; font-family: inherit;
    outline: none; -webkit-appearance: none; min-width: 0;
  }
  .about-ask-btn {
    background: #2A2D33; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px; padding: 0 16px;
    color: rgba(255,255,255,0.5); font-family: 'DM Mono', monospace;
    font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; white-space: nowrap; flex-shrink: 0;
    min-height: 44px;
  }

  /* ── PROFILE ── */
  .profile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 100vh;
    min-height: 100dvh;
    background: #17181B;
    position: relative;
  }
  .profile-form {
    padding: 48px 44px 80px;
    overflow-y: auto;
    max-height: 100vh;
    max-height: 100dvh;
    border-right: 1px solid rgba(255,255,255,0.06);
    position: relative; z-index: 1;
  }
  .profile-preview {
    padding: 48px 36px;
    display: flex; flex-direction: column;
    max-height: 100vh; max-height: 100dvh;
    overflow: hidden;
  }
  .form-section { margin-bottom: 22px; }
  .form-label {
    display: block;
    font-family: 'DM Mono', monospace;
    font-size: 10px; letter-spacing: 0.18em;
    text-transform: uppercase; color: rgba(247,243,236,0.4);
    margin-bottom: 8px;
  }
  .form-input {
    width: 100%; background: #2A2D33;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px; padding: 13px 15px;
    color: #F7F3EC; font-size: 14px;
    outline: none; font-family: inherit; line-height: 1.6;
    -webkit-appearance: none;
    min-height: 44px;
  }
  .form-textarea {
    width: 100%; background: #2A2D33;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px; padding: 13px 15px;
    color: #F7F3EC; font-size: 14px;
    outline: none; font-family: inherit; line-height: 1.6;
    resize: none; -webkit-appearance: none;
  }
  .form-input:focus, .form-textarea:focus {
    border-color: rgba(242,184,75,0.4);
  }
  .tags-grid { display: flex; flex-wrap: wrap; gap: 7px; }
  .tag-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 7px 12px; border-radius: 4px; border: 1px solid;
    cursor: pointer; font-size: 13px; font-family: inherit;
    background: #2A2D33; color: rgba(247,243,236,0.45);
    border-color: rgba(255,255,255,0.07);
    transition: all 0.12s; min-height: 36px;
    -webkit-tap-highlight-color: transparent;
  }
  .tag-btn.active {
    background: rgba(242,184,75,0.1);
    color: #F2B84B; border-color: rgba(242,184,75,0.35);
  }
  .loc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-hint {
    font-family: 'DM Mono', monospace; font-size: 10px;
    color: rgba(255,255,255,0.2); margin-top: 6px; letter-spacing: 0.04em;
    line-height: 1.5;
  }
  .profile-logo {
    font-family: 'Cormorant Garamond', serif;
    font-size: 20px; font-weight: 300; color: rgba(255,255,255,0.4);
    text-decoration: none; display: block; margin-bottom: 36px;
  }
  .profile-logo span { color: rgba(242,184,75,0.5); }
  .profile-kicker {
    font-family: 'DM Mono', monospace; font-size: 9px;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: rgba(247,243,236,0.3); display: block; margin-bottom: 10px;
  }
  .profile-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 34px; font-weight: 300; color: #fff;
    margin-bottom: 6px; line-height: 1.05;
  }
  .profile-sub {
    font-size: 14px; color: rgba(247,243,236,0.4);
    margin-bottom: 32px; line-height: 1.7;
  }
  .preview-label {
    font-family: 'DM Mono', monospace; font-size: 9px;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: rgba(247,243,236,0.2); margin-bottom: 14px; text-align: center;
  }

  /* ── DONE ── */
  .done-wrap {
    position: relative; z-index: 1;
    text-align: center; max-width: 500px;
    animation: fadeUp 0.6s ease both;
    padding: 0 4px;
  }
  .done-live {
    font-family: 'Cormorant Garamond', serif;
    font-size: 13px; font-style: italic;
    color: rgba(242,184,75,0.6);
    margin-bottom: 20px; letter-spacing: 0.05em;
  }
  .done-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(48px, 12vw, 88px);
    font-weight: 300; color: #fff;
    line-height: 1; letter-spacing: -0.02em;
    margin-bottom: 14px;
    word-break: break-word;
  }
  .done-line {
    width: 60%; height: 1px; margin: 0 auto 28px;
    background: linear-gradient(90deg, transparent, rgba(242,184,75,0.5), transparent);
  }
  .done-sub {
    font-size: 15px; color: rgba(247,243,236,0.45);
    line-height: 1.8; margin-bottom: 28px;
  }
  .done-link-box {
    display: inline-flex; align-items: center; gap: 14px;
    background: rgba(242,184,75,0.07);
    border: 1px solid rgba(242,184,75,0.2);
    border-radius: 6px; padding: 13px 20px; margin-bottom: 28px;
    max-width: 100%; flex-wrap: wrap; justify-content: center;
  }
  .done-link-text {
    font-family: 'DM Mono', monospace; font-size: 12px;
    color: #F2B84B; letter-spacing: 0.05em;
    word-break: break-all;
  }
  .done-copy-btn {
    background: none; border: none;
    color: rgba(242,184,75,0.5); cursor: pointer;
    font-family: 'DM Mono', monospace; font-size: 10px;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 4px 0; min-height: 36px;
  }
  .done-actions { display: flex; flex-direction: column; gap: 10px; max-width: 340px; margin: 0 auto; }

  /* ── SHARED BUTTONS ── */
  .btn-primary {
    width: 100%; background: #F2B84B; color: #09090C;
    font-family: 'DM Mono', monospace; font-weight: 500;
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    padding: 0; height: 52px;
    border-radius: 4px; border: none; cursor: pointer;
    transition: all 0.15s; -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center;
  }
  .btn-primary:disabled { background: rgba(242,184,75,0.3); cursor: not-allowed; }
  .btn-ghost {
    width: 100%; background: transparent;
    color: rgba(247,243,236,0.35);
    font-family: 'DM Mono', monospace;
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    height: 48px; border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer; -webkit-tap-highlight-color: transparent;
    display: flex; align-items: center; justify-content: center;
  }
  .btn-back {
    display: block; width: 100%; text-align: center;
    background: none; border: none;
    color: rgba(255,255,255,0.2); cursor: pointer;
    font-family: 'DM Mono', monospace; font-size: 10px;
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 18px 0; -webkit-tap-highlight-color: transparent;
  }
  .err-text { font-size: 13px; color: #EF4444; margin-bottom: 14px; }

  /* ── STRIPE ── */
  .stripe-wrap { width: 100%; max-width: 440px; position: relative; z-index: 1; }
  .stripe-kicker {
    font-family: 'DM Mono', monospace; font-size: 9px;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: rgba(247,243,236,0.3); display: block;
    margin-bottom: 10px; text-align: center;
  }
  .stripe-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(32px, 8vw, 44px); font-weight: 300; color: #fff;
    margin-bottom: 8px; line-height: 1.05; text-align: center;
  }
  .stripe-sub {
    font-size: 14px; color: rgba(247,243,236,0.45);
    line-height: 1.8; margin-bottom: 28px; text-align: center;
  }
  .stripe-callout {
    border-left: 2px solid rgba(242,184,75,0.4);
    background: rgba(242,184,75,0.06);
    padding: 16px 20px; border-radius: 0 6px 6px 0; margin-bottom: 24px;
    font-size: 14px; color: rgba(247,243,236,0.75); line-height: 1.75;
  }

  /* ── MOBILE ── */
  @media (max-width: 768px) {
    .profile-grid { grid-template-columns: 1fr !important; }
    .profile-preview { display: none !important; }
    .profile-form {
      padding: 24px 20px 80px !important;
      border-right: none !important;
      max-height: none !important;
    }
    .loc-row { grid-template-columns: 1fr !important; gap: 14px !important; }
    .profile-title { font-size: 28px !important; }
    .profile-sub { margin-bottom: 24px !important; }
    .form-section { margin-bottom: 20px !important; }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.1); }
  }
`;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("stage");
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  const [stageName, setStageName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [autoFired, setAutoFired] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data } = await (supabase as any)
        .from("creator_profiles").select("*")
        .eq("user_id", user.id).eq("kind", "spotlight").maybeSingle();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
        setSelectedTags(data.tags ?? []);
        setStageName(data.display_name ?? "");
        if (data.onboarding_completed_at) router.push("/dashboard");
      }
    });
  }, []);

  useEffect(() => {
    if (step === "stage" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 600);
    }
    if (step === "about" && !autoFired && !aiResponse) {
      setAutoFired(true);
      const saved = localStorage.getItem("spotlightly_creator_context");
      if (saved) {
        setDescription(saved);
        void askAI(saved);
      }
    }
  }, [step]);

  async function askAI(desc?: string) {
    const text = (desc ?? description).trim();
    if (!text) return;
    setAiLoading(true);
    setErr(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: text }),
    });
    const data = await res.json();
    if (data.error) { setErr(data.error); setAiLoading(false); return; }
    setAiResponse(data);
    if (data.suggestedBio && !bio) setBio(data.suggestedBio);
    if (data.suggestedTags?.length) setSelectedTags(data.suggestedTags.slice(0, 5));
    localStorage.removeItem("spotlightly_creator_context");
    setAiLoading(false);
  }

  async function askFollowUp() {
    if (!followUp.trim() || !aiResponse) return;
    setFollowUpLoading(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, followUp, previousResponse: aiResponse }),
    });
    const data = await res.json();
    setFollowUpAnswer(data.followUpAnswer ?? data.greeting ?? "");
    setFollowUp("");
    setFollowUpLoading(false);
  }

  async function saveProfile() {
    if (!displayName.trim()) { setErr("Display name is required"); return; }
    setSaving(true); setErr(null);
    await (supabase as any).from("creator_profiles").update({
      display_name: displayName.trim(),
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
      tags: selectedTags,
      location_city: locationCity.trim() || null,
      location_country: locationCountry.trim() || null,
      booking_url: bookingUrl.trim() || null,
      offers_services: !!bookingUrl.trim(),
    }).eq("id", profile.id);
    setSaving(false);
    setStep("stripe");
  }

  async function completeOnboarding() {
    await (supabase as any).from("creator_profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", profile.id);
    router.push("/dashboard");
  }

  if (!mounted) return null;

  // ── STAGE ──────────────────────────────────────────────────────
  if (step === "stage") return (
    <main className="onb-root">
      <style>{SHARED_STYLES}</style>
      <div className="onb-bg" />
      <div className="onb-glow-top" />
      <div className="onb-glow-bottom" />
      <Link href="/" className="onb-logo">Spot<span>light</span>ly</Link>

      <div className="stage-wrap">
        <div className="stage-name">
          {stageName || <span style={{ color: "rgba(255,255,255,0.12)" }}>Your name</span>}
        </div>
        <div className="stage-line" style={{ width: stageName ? "80%" : "40%" }} />
        <p className="stage-label">What should the spotlight call you?</p>
        <input
          ref={inputRef}
          type="text"
          value={stageName}
          onChange={e => { setStageName(e.target.value); setDisplayName(e.target.value); }}
          onKeyDown={e => { if (e.key === "Enter" && stageName.trim()) setStep("about"); }}
          placeholder="Type your name or brand…"
          className="stage-input"
        />
        <button
          className="btn-primary"
          onClick={() => { if (stageName.trim()) setStep("about"); }}
          disabled={!stageName.trim()}
        >
          Step into the spotlight →
        </button>
        {profile?.handle && (
          <p className="stage-handle">spotlightly.app/{profile.handle}</p>
        )}
      </div>
    </main>
  );

  // ── ABOUT ──────────────────────────────────────────────────────
  if (step === "about") return (
    <main className="onb-root dark">
      <style>{SHARED_STYLES}</style>
      <div className="onb-bg" />
      <div className="onb-glow-top" />
      <Link href="/" className="onb-logo">Spot<span>light</span>ly</Link>

      <div className="about-wrap">
        {aiLoading && !aiResponse && (
          <div className="about-loading">
            <div className="about-loading-text">Reading your stage…</div>
            <div className="pulse-dots">
              <div className="pulse-dot" />
              <div className="pulse-dot" />
              <div className="pulse-dot" />
            </div>
          </div>
        )}

        {!aiLoading && !aiResponse && (
          <div>
            <h2 className="about-fallback-title">What do you create?</h2>
            <p className="about-fallback-sub">One line is enough. We&apos;ll show you how to make money on Spotlightly.</p>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && description.trim()) askAI(); }}
              placeholder="e.g. I'm a graphic artist"
              className="about-input"
              autoFocus
            />
            {err && <p className="err-text">{err}</p>}
            <button className="btn-primary" onClick={() => askAI()} disabled={!description.trim()}>
              Show me what&apos;s possible →
            </button>
          </div>
        )}

        {aiResponse && (
          <div>
            <div className="about-greeting">{aiResponse.greeting}</div>
            <div className="about-recs">
              {aiResponse.recommendations.map((rec, i) => (
                <div key={i} className="about-rec" style={{ animationDelay: `${i * 0.08}s` }}>
                  <span className="about-rec-emoji">{rec.emoji}</span>
                  <div>
                    <div className="about-rec-title">{rec.title}</div>
                    <div className="about-rec-desc">{rec.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            {followUpAnswer && (
              <div className="about-followup-answer">{followUpAnswer}</div>
            )}
            <div className="about-followup-row">
              <input
                type="text"
                placeholder="Any questions? Ask anything…"
                value={followUp}
                onChange={e => setFollowUp(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") askFollowUp(); }}
                className="about-followup-input"
              />
              <button
                className="about-ask-btn"
                onClick={askFollowUp}
                disabled={followUpLoading || !followUp.trim()}
                style={{ opacity: followUpLoading || !followUp.trim() ? 0.4 : 1 }}
              >
                {followUpLoading ? "…" : "Ask"}
              </button>
            </div>
            <button className="btn-primary" onClick={() => setStep("profile")}>
              Let&apos;s build your page →
            </button>
          </div>
        )}

        <button className="btn-back" onClick={() => {
          if (aiResponse) { setAiResponse(null); setDescription(""); setAutoFired(false); }
          else setStep("stage");
        }}>
          ← Back
        </button>
      </div>
    </main>
  );

  // ── PROFILE ────────────────────────────────────────────────────
  if (step === "profile") return (
    <div className="profile-grid">
      <style>{SHARED_STYLES}</style>
      <div className="onb-bg" />

      <div className="profile-form">
        <Link href="/" className="profile-logo">Spot<span>light</span>ly</Link>
        <span className="profile-kicker">Building your page</span>
        <h2 className="profile-title">Make it yours.</h2>
        <p className="profile-sub">Your audience sees this the moment they arrive.</p>

        <div className="form-section">
          <label className="form-label">Profile photo</label>
          <ImageUpload value={avatarUrl} onChange={setAvatarUrl} shape="circle"
            label="Upload photo" hint="JPG, PNG or WebP · Square works best" />
        </div>

        <div className="form-section">
          <label className="form-label">Display name</label>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name or brand" className="form-input" />
        </div>

        <div className="form-section">
          <label className="form-label">Bio <span style={{ color: "rgba(255,255,255,0.15)" }}>(optional)</span></label>
          <textarea value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Tell your audience who you are..." rows={3} maxLength={300}
            className="form-textarea" />
        </div>

        <div className="form-section">
          <label className="form-label">Categories <span style={{ color: "rgba(255,255,255,0.15)" }}>(up to 5)</span></label>
          <div className="tags-grid">
            {(CREATOR_CATEGORIES as readonly { id: string; label: string; emoji: string }[])
              .filter(c => c.id !== "adult")
              .map(cat => {
                const active = selectedTags.includes(cat.id);
                return (
                  <button key={cat.id} type="button"
                    className={`tag-btn${active ? " active" : ""}`}
                    onClick={() => {
                      if (active) setSelectedTags(p => p.filter(t => t !== cat.id));
                      else if (selectedTags.length < 5) setSelectedTags(p => [...p, cat.id]);
                    }}>
                    {cat.emoji} {cat.label}
                  </button>
                );
              })}
          </div>
        </div>

        <div className="form-section">
          <div className="loc-row">
            <div>
              <label className="form-label">City</label>
              <input type="text" value={locationCity} onChange={e => setLocationCity(e.target.value)}
                placeholder="Seattle" className="form-input" />
            </div>
            <div>
              <label className="form-label">Country</label>
              <input type="text" value={locationCountry} onChange={e => setLocationCountry(e.target.value)}
                placeholder="USA" className="form-input" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <label className="form-label">Booking link <span style={{ color: "rgba(255,255,255,0.15)" }}>(optional)</span></label>
          <input type="url" value={bookingUrl} onChange={e => setBookingUrl(e.target.value)}
            placeholder="https://calendly.com/you" className="form-input"
            style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }} />
          <p className="form-hint">Hairdressers, trainers, coaches — fans book directly from your page.</p>
        </div>

        {err && <p className="err-text">{err}</p>}

        <button className="btn-primary" onClick={saveProfile} disabled={saving || !displayName.trim()}
          style={{ marginBottom: 10 }}>
          {saving ? "Saving…" : "Save and continue →"}
        </button>
        <button className="btn-ghost" onClick={() => setStep("about")}>← Back</button>
      </div>

      {/* Desktop preview only */}
      <div className="profile-preview">
        <div className="preview-label">Live preview</div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <PagePreview handle={profile?.handle || ""} displayName={displayName}
            bio={bio} avatarUrl={avatarUrl} tags={selectedTags} />
        </div>
      </div>
    </div>
  );

  // ── STRIPE ─────────────────────────────────────────────────────
  if (step === "stripe") return (
    <main className="onb-root dark">
      <style>{SHARED_STYLES}</style>
      <div className="onb-bg" />
      <div className="onb-glow-top" />
      <Link href="/" className="onb-logo">Spot<span>light</span>ly</Link>

      <div className="stripe-wrap">
        <span className="stripe-kicker">Almost there</span>
        <h2 className="stripe-title">Open the box office.</h2>
        <p className="stripe-sub">Connect Stripe so your audience can pay you directly. Takes 2 minutes.</p>
        <div className="stripe-callout">
          Spotlightly takes <strong style={{ color: "#fff" }}>0%</strong> of your subscription revenue.
          You keep everything. Stripe charges their standard 2.9% + 30¢.
        </div>
        {err && <p className="err-text">{err}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn-primary" onClick={async () => {
            try {
              const res = await fetch("/api/stripe/connect/start", { method: "POST" });
              const data = await res.json();
              if (data.url) window.location.href = data.url;
              else setErr(data.error ?? "Could not start Stripe setup.");
            } catch { setErr("Something went wrong. Try again."); }
          }}>
            Connect Stripe →
          </button>
          <button className="btn-ghost" onClick={() => setStep("done")}>Skip for now</button>
        </div>
      </div>
    </main>
  );

  // ── DONE ───────────────────────────────────────────────────────
  if (step === "done") return (
    <main className="onb-root">
      <style>{SHARED_STYLES}</style>
      <div className="onb-bg" style={{ opacity: 0.08 }} />
      <div className="onb-glow-top" style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(242,184,75,0.14) 0%, transparent 65%)" }} />
      <div className="onb-glow-bottom" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(242,184,75,0.08), transparent)" }} />
      <Link href="/" className="onb-logo">Spot<span>light</span>ly</Link>

      <div className="done-wrap">
        <div className="done-live">You&apos;re live.</div>
        <div className="done-name">{displayName || "You're live."}</div>
        <div className="done-line" />
        <p className="done-sub">Your Spotlightly page is ready. Share your link and start building your audience.</p>
        {profile && (
          <div className="done-link-box">
            <span className="done-link-text">spotlightly.app/{profile.handle}</span>
            <button className="done-copy-btn"
              onClick={() => navigator.clipboard.writeText(`https://spotlightly.app/${profile.handle}`)}>
              Copy
            </button>
          </div>
        )}
        <div className="done-actions">
          <button className="btn-primary" onClick={completeOnboarding}>Go to my dashboard →</button>
          {profile && (
            <a href={`/${profile.handle}`} target="_blank" rel="noopener noreferrer"
              className="btn-ghost" style={{ textDecoration: "none" }}>
              Preview my page ↗
            </a>
          )}
        </div>
      </div>
    </main>
  );

  return null;
}

// ── Page Preview (desktop only) ────────────────────────────────────
function PagePreview({ handle, displayName, bio, avatarUrl, tags }: {
  handle: string; displayName: string; bio: string; avatarUrl: string; tags: string[];
}) {
  const cats = CREATOR_CATEGORIES as readonly { id: string; label: string; emoji: string }[];
  return (
    <div style={{
      background: "#17181B", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 8, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        background: "#111115", borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#EF4444","#F0B429","#34D399"].map(c => (
            <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.5 }} />
          ))}
        </div>
        <div style={{
          flex: 1, background: "#17181B", borderRadius: 3, padding: "4px 10px",
          fontFamily: "DM Mono, monospace", fontSize: 10, color: "rgba(255,255,255,0.3)",
        }}>
          spotlightly.app/{handle || "your-handle"}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>
        <div style={{ height: 90, background: "linear-gradient(135deg, #1c1c22 0%, #232428 100%)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 120% at 50% -20%, rgba(242,184,75,0.12), transparent 60%)" }} />
        </div>
        <div style={{ padding: "0 20px", marginTop: -26 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: avatarUrl ? "transparent" : "rgba(242,184,75,0.15)", border: "2px solid #17181B", overflow: "hidden", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 18, opacity: 0.4 }}>✦</span>}
          </div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: 18, fontWeight: 400, color: "#fff", marginBottom: 3 }}>
            {displayName || <span style={{ color: "rgba(255,255,255,0.15)" }}>Your name</span>}
          </div>
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "rgba(242,184,75,0.6)", letterSpacing: "0.08em", marginBottom: 8 }}>@{handle || "your-handle"}</div>
          {bio ? (
            <p style={{ fontSize: 11, color: "rgba(242,242,240,0.55)", lineHeight: 1.65, marginBottom: 10, maxHeight: 55, overflow: "hidden" }}>{bio}</p>
          ) : (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.1)", marginBottom: 10, fontStyle: "italic" }}>Your bio will appear here</p>
          )}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
              {tags.slice(0, 4).map(t => {
                const cat = cats.find(c => c.id === t);
                return cat ? (
                  <span key={t} style={{ fontFamily: "DM Mono, monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 3, background: "rgba(242,184,75,0.08)", border: "1px solid rgba(242,184,75,0.15)", color: "rgba(242,184,75,0.7)" }}>
                    {cat.emoji} {cat.label}
                  </span>
                ) : null;
              })}
            </div>
          )}
          <div style={{ background: "rgba(242,184,75,0.12)", border: "1px solid rgba(242,184,75,0.2)", borderRadius: 4, padding: "9px 0", textAlign: "center", fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,184,75,0.7)", marginBottom: 14 }}>Subscribe</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 4, padding: "9px 12px", opacity: 1 - (i * 0.2) }}>
                <div style={{ height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 5, width: `${80 - i * 15}%` }} />
                <div style={{ height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 2, width: "55%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

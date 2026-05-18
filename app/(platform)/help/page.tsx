import Link from "next/link";

const SECTIONS = [
  {
    title: "Getting paid — Stripe Connect",
    content: `You need to connect Stripe before fans can subscribe or tip you. Go to Dashboard → Payments → Connect Stripe. You'll be redirected to Stripe's form — it takes about 3 minutes. They'll ask for your legal name, address, SSN (last 4 or full), and bank account. When you're done, you come back to Spotlightly and your payment button goes live.

You do NOT create your own Stripe account separately. Spotlightly creates a sub-account for you. Your payouts go to your bank on the schedule you set in Stripe's dashboard.`,
  },
  {
    title: "Your subscription price",
    content: `Go to Dashboard → Profile → Subscription Price. Set the monthly price fans pay to access your paid content. Most creators charge between $9–$25/month.

Spotlightly takes 0% of this. Stripe takes 2.9% + 30¢ per transaction. Everything else is yours. A $9.99 subscription means $9.40 lands in your bank.`,
  },
  {
    title: "Creating channels",
    content: `Channels are the subscription tiers visible on your public page. Go to Dashboard → Profile → Channels → Add Channel.

Most creators have two: a free channel for public content that builds their audience, and one paid channel for premium content at their subscription price. Fans see your channels on your page and can subscribe to specific ones.`,
  },
  {
    title: "Posting content",
    content: `Dashboard → Posts → New Post. Write a caption and upload media (image or video). Choose a channel to assign it to. Set the tier: Free (visible to all) or Premium (subscribers only).

Free posts build your audience. Premium posts are shown blurred with a subscribe gate to non-subscribers — they see the title and a preview but have to subscribe to read or watch.`,
  },
  {
    title: "Going live",
    content: `Dashboard → Go Live. Enter a title and click Start. You'll receive an RTMP URL and stream key.

Open OBS Studio (free, download at obsproject.com). Go to Settings → Stream → Custom. Paste your RTMP URL and stream key. Click Apply then Start Streaming.

Your first hour every stream is always free. After that, $0.01 per active viewer per hour.`,
  },
  {
    title: "Opening a Backstage",
    content: `Backstage is a completely separate public profile for adult content. It can be linked to your Spotlight or kept invisible — your call. Your employer, family, and mainstream followers will never see the connection unless you choose to show it.

To open a Backstage: Dashboard → Open a Backstage. You'll need to complete age verification (Veriff, 5 minutes) and submit your 2257 records (legal name + ID). You'll also need your own CCBill merchant account for Backstage payments — apply at ccbill.com.`,
  },
  {
    title: "Backstage — CCBill setup",
    content: `CCBill handles adult content payments. Unlike Stripe, you need your own CCBill merchant account — not a sub-account through Spotlightly. This is because Mastercard rules require it.

Go to ccbill.com → apply for a merchant account. They'll review in 3–7 business days. Once approved, they give you an Account Number and Sub-Account Number. Enter these in Dashboard → Payments → Backstage.

CCBill charges their own processing fee (typically 10–14%). This comes out before you receive anything. Spotlightly's cut comes on top of what CCBill settles.`,
  },
  {
    title: "Merch",
    content: `Sell branded merchandise from your page through Printful. No inventory, no upfront cost — Printful prints and ships when a fan orders.

Create a Printful account at printful.com, design your products, then connect it to your Spotlightly account via Dashboard → Merch. Spotlightly takes 10–15% of your margin per sale.`,
  },
  {
    title: "Messages — Front Row",
    content: `Fans can message you through your Spotlightly page. Standard messages arrive in your inbox at Dashboard → Messages.

Front Row Messages are paid priority messages that surface above regular messages. The fan pays a fee to send one — you receive 50% of that fee. They're capped at 3 per fan per creator per 24 hours. Visibility only — replying is never guaranteed and always your choice.`,
  },
  {
    title: "What Spotlightly costs you",
    content: `Flat monthly fee based on subscriber count: Starter $29/mo (up to 100 subscribers) through Legend $3,499/mo (unlimited). You pay nothing until you earn. Spotlightly takes 0% of your subscription revenue and 0% of tips.

Stripe takes 2.9% + 30¢ per transaction — that's their fee, not ours. We disclose it so you're never surprised.

OnlyFans takes 20% of everything. At 1,000 subscribers, that's $2,000/month they keep. On Spotlightly at 1,000 subscribers, you'd pay $249/month and keep the rest.`,
  },
];

export default function HelpPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 300 }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky" as const, top: 0, zIndex: 10, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", textDecoration: "none" }}>Spot<span style={{ color: "var(--accent)" }}>light</span>ly</Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>/ Help</span>
        </div>
        <Link href="/dashboard" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "var(--muted)", textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 28px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".25em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 12 }}>Creator Help</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontWeight: 300, color: "#fff", lineHeight: 1, letterSpacing: "-.02em", marginBottom: 8 }}>
          How to <em style={{ fontStyle: "italic", color: "var(--accent)" }}>get live.</em>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-soft)", lineHeight: 1.75, marginBottom: 48, maxWidth: 560 }}>
          Everything you need to know about setting up and running your Spotlightly presence. Plain language, no fluff.
        </p>

        <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
          {SECTIONS.map((s, i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "28px 32px" }}>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400, color: "#fff", marginBottom: 14, lineHeight: 1.15 }}>{s.title}</h2>
              <div style={{ fontSize: 14, color: "var(--text-soft)", lineHeight: 1.85, whiteSpace: "pre-line" as const }}>{s.content}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid rgba(245,200,66,.2)", padding: "24px 32px", marginTop: 2, textAlign: "center" as const }}>
          <p style={{ fontSize: 14, color: "var(--text-soft)", marginBottom: 12 }}>Still need help? We actually respond.</p>
          <a href="mailto:help@spotlightly.app" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase" as const, color: "var(--accent)" }}>help@spotlightly.app</a>
        </div>
      </div>
    </div>
  );
}

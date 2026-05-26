import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Spotlightly",
};

const EFFECTIVE = "May 1, 2026";

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-inner">
          <p className="kicker">Legal</p>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-date">Effective: {EFFECTIVE} · Tahoma Systems LLC</p>

          <div className="legal-body">

            <h2>1. About these Terms</h2>
            <p>These Terms of Service ("Terms") govern your access to and use of Spotlightly, operated by Tahoma Systems LLC ("Spotlightly," "we," "us," or "our"). By creating an account or using the platform, you agree to these Terms. If you do not agree, do not use Spotlightly.</p>

            <h2>2. Eligibility</h2>
            <p>You must be at least 18 years old to use Spotlightly. By using the platform, you represent and warrant that you are 18 or older. We do not knowingly allow minors to use the platform. If we discover that a user is under 18, their account will be immediately terminated.</p>

            <h2>3. Creator Accounts</h2>
            <p>Creators are individuals or entities who publish content on Spotlightly. Creator accounts are subject to a monthly subscription fee based on subscriber count, as described on our Pricing page. By becoming a creator, you agree that:</p>
            <ul>
              <li>You are responsible for all content you publish.</li>
              <li>You have the rights to all content you upload, or have obtained appropriate licenses.</li>
              <li>Your content complies with all applicable laws and our Content Policy.</li>
              <li>You will maintain accurate payment and identity information.</li>
            </ul>

            <h2>4. Fan Accounts</h2>
            <p>Fans are users who subscribe to, tip, or otherwise interact with creator content. Fan accounts are free. Fans agree to use the platform only for lawful purposes and to not engage in harassment, fraud, or abuse toward creators or other users.</p>

            <h2>5. Content Policy</h2>
            <p><strong>Prohibited content.</strong> You may not post, upload, or distribute content that:</p>
            <ul>
              <li>Depicts, promotes, or facilitates the sexual exploitation of minors (CSAM) in any form. We report all such content to NCMEC and relevant law enforcement immediately and without exception.</li>
              <li>Facilitates or promotes sex trafficking, prostitution, or other conduct prohibited by 18 U.S.C. § 1591 (FOSTA-SESTA).</li>
              <li>Constitutes harassment, threats, doxxing, or targeted abuse of any individual.</li>
              <li>Violates the intellectual property rights of any third party.</li>
              <li>Contains non-consensual intimate imagery (NCII) of any person.</li>
              <li>Promotes violence, terrorism, or hate speech targeting individuals or groups based on protected characteristics.</li>
              <li>Is deceptive, fraudulent, or constitutes spam.</li>
            </ul>
            <p><strong>Adult content (Backstage).</strong> Creators who have completed age verification and 2257 compliance may publish adult content exclusively within the Backstage tier. All performers depicted in adult content must be 18 or older, and records must be maintained in compliance with 18 U.S.C. § 2257. Adult content is strictly prohibited outside the Backstage tier.</p>
            <p><strong>AI moderation.</strong> All content is reviewed by automated systems before and after publication. Flagged content is reviewed by our moderation team. We reserve the right to remove content and suspend accounts at our discretion.</p>

            <h2>6. Payments and Fees</h2>
            <p>Creator subscription fees are billed monthly based on your subscriber tier. Fan subscriptions and tips are processed by Stripe (for Spotlight content) or CCBill (for Backstage content). Spotlightly is not responsible for third-party payment processor errors, delays, or failures.</p>
            <p>We take no percentage of creator subscription revenue or standard tips. Revenue sharing applies to Fan Extras features (Super Tips, Front Row Messages, Gift Subscriptions) as described in our pricing documentation. All fees are non-refundable except as required by applicable law.</p>

            <h2>7. Intellectual Property</h2>
            <p>You retain ownership of content you create. By posting content on Spotlightly, you grant us a non-exclusive, worldwide, royalty-free license to host, display, transmit, and distribute your content for the purpose of operating the platform. This license terminates when you delete the content or close your account.</p>

            <h2>8. DMCA / Copyright</h2>
            <p>We comply with the Digital Millennium Copyright Act (DMCA). To report copyright infringement, see our <a href="/dmca">DMCA policy</a>. Repeat infringers will have their accounts terminated.</p>

            <h2>9. Privacy</h2>
            <p>Your use of Spotlightly is subject to our <a href="/privacy">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>

            <h2>10. Disclaimers</h2>
            <p>Spotlightly is provided "as is" without warranties of any kind, express or implied. We do not guarantee uptime, data retention, or uninterrupted service. We are not liable for content posted by users.</p>

            <h2>11. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Tahoma Systems LLC's total liability to you for any claims arising from or related to these Terms or the platform shall not exceed the greater of (a) $100 or (b) the total fees you paid to Spotlightly in the 12 months preceding the claim.</p>

            <h2>12. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Tahoma Systems LLC, its officers, directors, employees, and agents from any claims, losses, liabilities, and expenses (including legal fees) arising from your use of the platform, your content, or your violation of these Terms.</p>

            <h2>13. Governing Law and Dispute Resolution</h2>
            <p>These Terms are governed by the laws of the State of Washington, USA, without regard to conflict of law principles. Any disputes shall be resolved through binding arbitration in King County, Washington, except that either party may seek injunctive relief in court for intellectual property disputes.</p>

            <h2>14. Termination</h2>
            <p>We may suspend or terminate your account at any time for violation of these Terms. You may close your account at any time through your dashboard settings. Upon termination, your content will be removed within 30 days, subject to our legal obligations to retain records.</p>

            <h2>15. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of material changes by email or through the platform. Continued use after changes take effect constitutes acceptance of the updated Terms.</p>

            <h2>16. Contact</h2>
            <p>Questions about these Terms: <a href="mailto:legal@spotlightly.app">legal@spotlightly.app</a><br />
            Tahoma Systems LLC · PO Box 4444 · Seattle, WA 98104</p>
            <p>Tahoma Systems LLC · Seattle, Washington, USA</p>

          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        .legal-page { min-height: 100vh; }
        .legal-inner { max-width: 760px; margin: 0 auto; padding: var(--s-16) var(--s-6) var(--s-20); }
        .legal-title { font-family: var(--font-serif); font-size: clamp(36px,5vw,56px); font-weight: 300; color: #fff; margin: var(--s-3) 0 var(--s-2); line-height: 1.05; letter-spacing: -.01em; }
        .legal-date { font-family: var(--font-mono); font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: var(--muted); margin-bottom: var(--s-12); }
        .legal-body h2 { font-family: var(--font-serif); font-size: 22px; font-weight: 400; color: #fff; margin: var(--s-10) 0 var(--s-3); }
        .legal-body p { font-size: 14px; line-height: 1.85; color: var(--text-soft); margin-bottom: var(--s-4); }
        .legal-body ul { padding-left: var(--s-5); margin-bottom: var(--s-4); }
        .legal-body ul li { font-size: 14px; line-height: 1.85; color: var(--text-soft); margin-bottom: var(--s-2); }
        .legal-body a { color: var(--accent); }
        .legal-body strong { color: var(--text); font-weight: 500; }
      `}</style>
    </>
  );
}

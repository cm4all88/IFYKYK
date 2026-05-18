import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy · Spotlightly" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-inner">
          <p className="kicker">Legal</p>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-date">Effective: May 1, 2026 · Tahoma Systems LLC</p>

          <div className="legal-body">
            <h2>1. Who we are</h2>
            <p>Spotlightly is operated by Tahoma Systems LLC, a Washington state LLC. This Privacy Policy explains how we collect, use, and protect your personal information. Contact us at <a href="mailto:privacy@spotlightly.app">privacy@spotlightly.app</a> with any questions.</p>

            <h2>2. Information we collect</h2>
            <p><strong>Account information.</strong> When you create an account: email address, password (hashed — we never store plaintext passwords), and if you're a creator, your display name and handle.</p>
            <p><strong>Payment information.</strong> We do not store credit card numbers. Payment processing is handled by Stripe and CCBill. We store transaction IDs, amounts, and subscription status for your records.</p>
            <p><strong>Content.</strong> Posts, captions, images, and videos you upload to the platform.</p>
            <p><strong>Identity documents.</strong> For Backstage (adult content) creators, age verification is conducted by Veriff. We receive a pass/fail result — we do not store copies of your ID. 2257 records (legal name, date of birth, ID type) are stored securely and are only accessible to compliance staff.</p>
            <p><strong>Usage data.</strong> Page views, feature usage, and error logs for platform improvement. We do not sell this data.</p>
            <p><strong>Communications.</strong> Messages sent through the platform's messaging system.</p>

            <h2>3. How we use your information</h2>
            <ul>
              <li>To operate and provide the platform</li>
              <li>To process payments and payouts</li>
              <li>To send transactional emails (receipts, password reset, account notices)</li>
              <li>To enforce our Terms of Service and Content Policy</li>
              <li>To comply with legal obligations</li>
              <li>To improve the platform through aggregate, anonymized analytics</li>
            </ul>
            <p>We do not sell your personal information to third parties. We do not use your data for advertising.</p>

            <h2>4. Third parties</h2>
            <p><strong>Stripe</strong> — payment processing. <a href="https://stripe.com/privacy" target="_blank" rel="noopener">Stripe Privacy Policy</a></p>
            <p><strong>CCBill</strong> — adult content payment processing. <a href="https://ccbill.com/privacy" target="_blank" rel="noopener">CCBill Privacy Policy</a></p>
            <p><strong>Supabase</strong> — database and authentication. Hosted in AWS US-East.</p>
            <p><strong>BunnyCDN</strong> — media hosting and delivery (Bunny.net)</p>
            <p><strong>Veriff</strong> — age/identity verification for Backstage creators</p>
            <p><strong>Resend</strong> — transactional email delivery</p>

            <h2>5. Data retention</h2>
            <p>Account data is retained while your account is active. If you delete your account, your profile and posts are removed within 30 days. Payment records and 2257 compliance records are retained for 7 years as required by law. Messages may be retained for up to 2 years for trust and safety purposes.</p>

            <h2>6. Your rights</h2>
            <p><strong>Access and portability.</strong> You can request a copy of your data by emailing <a href="mailto:privacy@spotlightly.app">privacy@spotlightly.app</a>.</p>
            <p><strong>Correction.</strong> You can update most account information directly in your dashboard settings.</p>
            <p><strong>Deletion.</strong> You can delete your account in dashboard settings. Some data may be retained as described above.</p>
            <p><strong>Opt-out of communications.</strong> You can unsubscribe from non-transactional emails via the link in any email we send.</p>

            <h2>7. California residents (CCPA)</h2>
            <p>California residents have the right to know what personal information we collect, to delete personal information, and to opt out of the sale of personal information. We do not sell personal information. To exercise your rights, contact <a href="mailto:privacy@spotlightly.app">privacy@spotlightly.app</a>.</p>

            <h2>8. European residents (GDPR)</h2>
            <p>If you are located in the European Economic Area, you have additional rights including the right to access, rectify, erase, restrict, or object to processing of your personal data. Our legal basis for processing is contract performance (operating the platform you've signed up for) and legitimate interests. To exercise your rights, contact <a href="mailto:privacy@spotlightly.app">privacy@spotlightly.app</a>. You also have the right to lodge a complaint with your local data protection authority.</p>

            <h2>9. Cookies</h2>
            <p>We use strictly necessary cookies for authentication (session management). We do not use third-party tracking cookies or advertising cookies.</p>

            <h2>10. Security</h2>
            <p>We use industry-standard security measures including encryption in transit (HTTPS), encrypted passwords, and access controls. No system is perfectly secure. If you discover a security vulnerability, please report it to <a href="mailto:security@spotlightly.app">security@spotlightly.app</a>.</p>

            <h2>11. Children</h2>
            <p>Spotlightly is not intended for anyone under 18. We do not knowingly collect information from minors. If you believe a minor has created an account, contact us immediately.</p>

            <h2>12. Changes</h2>
            <p>We may update this policy from time to time. We will notify you of material changes by email. Continued use after changes constitutes acceptance.</p>

            <h2>13. Contact</h2>
            <p><a href="mailto:privacy@spotlightly.app">privacy@spotlightly.app</a><br />Tahoma Systems LLC · Seattle, Washington, USA</p>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        .legal-page{min-height:100vh;}
        .legal-inner{max-width:760px;margin:0 auto;padding:var(--s-16) var(--s-6) var(--s-20);}
        .legal-title{font-family:var(--font-serif);font-size:clamp(36px,5vw,56px);font-weight:300;color:#fff;margin:var(--s-3) 0 var(--s-2);line-height:1.05;letter-spacing:-.01em;}
        .legal-date{font-family:var(--font-mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:var(--s-12);}
        .legal-body h2{font-family:var(--font-serif);font-size:22px;font-weight:400;color:#fff;margin:var(--s-10) 0 var(--s-3);}
        .legal-body p{font-size:14px;line-height:1.85;color:var(--text-soft);margin-bottom:var(--s-4);}
        .legal-body ul{padding-left:var(--s-5);margin-bottom:var(--s-4);}
        .legal-body ul li{font-size:14px;line-height:1.85;color:var(--text-soft);margin-bottom:var(--s-2);}
        .legal-body a{color:var(--accent);}
        .legal-body strong{color:var(--text);font-weight:500;}
      `}</style>
    </>
  );
}

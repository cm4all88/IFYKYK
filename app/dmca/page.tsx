import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "DMCA Policy · Spotlightly" };

export default function DmcaPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-inner">
          <p className="kicker">Legal</p>
          <h1 className="legal-title">DMCA Policy</h1>
          <p className="legal-date">Effective: May 1, 2026 · Tahoma Systems LLC</p>

          <div className="legal-body">
            <h2>Our commitment to copyright</h2>
            <p>Spotlightly respects the intellectual property rights of others and expects our users to do the same. We comply with the Digital Millennium Copyright Act (DMCA) and respond promptly to valid copyright infringement notices.</p>

            <h2>Designated Copyright Agent</h2>
            <p>To file a DMCA notice, contact our designated agent:</p>
            <p style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "20px 24px", borderRadius: "var(--r-2)", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 2 }}>
              Tahoma Systems LLC<br />
              ATTN: Copyright Agent<br />
              PO Box 472<br />
              Black Diamond, WA 98010<br />
              legal@spotlightly.app
            </p>

            <h2>Filing a DMCA Takedown Notice</h2>
            <p>To submit a valid DMCA takedown notice, you must provide all of the following:</p>
            <ul>
              <li>Your full legal name, address, phone number, and email address.</li>
              <li>A description of the copyrighted work you claim has been infringed.</li>
              <li>The specific URL(s) on Spotlightly where the infringing content appears.</li>
              <li>A statement that you have a good faith belief that the use is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on their behalf.</li>
              <li>Your physical or electronic signature.</li>
            </ul>
            <p>Send your complete notice to <a href="mailto:legal@spotlightly.app">legal@spotlightly.app</a>. Incomplete notices will not be processed.</p>

            <h2>Counter-Notice</h2>
            <p>If your content was removed due to a DMCA notice you believe was made in error, you may file a counter-notice. Your counter-notice must include:</p>
            <ul>
              <li>Your full legal name, address, phone number, and email address.</li>
              <li>Identification of the content that was removed and the URL where it previously appeared.</li>
              <li>A statement under penalty of perjury that you have a good faith belief the content was removed as a result of mistake or misidentification.</li>
              <li>Your consent to jurisdiction of the Federal District Court for your district (or, if outside the US, any judicial district in which Spotlightly may be found).</li>
              <li>Your physical or electronic signature.</li>
            </ul>
            <p>Upon receiving a valid counter-notice, we will forward it to the original complainant. If the complainant does not file a court action within 10 business days, we may restore the content.</p>

            <h2>Repeat Infringers</h2>
            <p>We terminate accounts of users who repeatedly infringe copyrights. Accounts that accumulate two or more substantiated DMCA notices will be reviewed for termination.</p>

            <h2>Good Faith</h2>
            <p>We take DMCA abuse seriously. Filing a false or bad-faith DMCA claim may result in legal liability under 17 U.S.C. § 512(f) and account termination.</p>
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
      `}</style>
    </>
  );
}

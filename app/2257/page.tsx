import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
export const metadata = { title: "18 U.S.C. § 2257 Compliance · Spotlightly" };
export default function Page2257() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-inner">
          <p className="kicker">Legal</p>
          <h1 className="legal-title">18 U.S.C. § 2257 Statement</h1>
          <p className="legal-date">Tahoma Systems LLC · Spotlightly</p>
          <div className="legal-body">
            <h2>Records Custodian</h2>
            <p>In compliance with the Federal Labeling and Record-Keeping Law (18 U.S.C. § 2257), all models, actors, actresses and other persons who appear in any visual depictions of sexually explicit conduct appearing or otherwise contained in this website were over the age of eighteen (18) years at the time of the creation of such depictions.</p>
            <p>Records required by Section 2257 of Title 18, United States Code, with respect to all performers depicted in content on this website are maintained by the designated records custodian:</p>
            <p style={{ background:"var(--surface)", border:"1px solid var(--border)", padding:"20px 24px", borderRadius:"var(--r-2)", fontFamily:"var(--font-mono)", fontSize:12, lineHeight:2 }}>
              Custodian of Records<br />
              Tahoma Systems LLC<br />
              legal@spotlightly.app<br />
              Seattle, Washington, USA
            </p>
            <h2>Verification</h2>
            <p>All Backstage creators on Spotlightly are required to complete age and identity verification through Veriff before posting any content. Verification records and 2257-compliant documentation are maintained on file and available for inspection as required by law.</p>
            <p>Content depicting persons under 18 years of age in a sexually explicit manner is strictly prohibited and will be immediately reported to the National Center for Missing and Exploited Children (NCMEC) and relevant law enforcement.</p>
            <h2>Exemption</h2>
            <p>Spotlightly operates as a secondary producer as defined in 28 C.F.R. § 75.1. For content uploaded by creators, records are maintained by the primary producer (the creator). Spotlightly maintains secondary records as required.</p>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`.legal-page{min-height:100vh;} .legal-inner{max-width:760px;margin:0 auto;padding:var(--s-16) var(--s-6) var(--s-20);} .legal-title{font-family:var(--font-display);font-size:clamp(36px,5vw,56px);font-weight:800;letter-spacing:-0.04em;color:#fff;margin:var(--s-3) 0 var(--s-2);line-height:1.05;} .legal-date{font-family:var(--font-mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:var(--s-12);} .legal-body h2{font-family:var(--font-display);font-size:20px;font-weight:700;color:#fff;margin:var(--s-10) 0 var(--s-3);} .legal-body p{font-size:14px;line-height:1.85;color:var(--text-soft);margin-bottom:var(--s-4);} .legal-body a{color:var(--accent);}`}</style>
    </>
  );
}

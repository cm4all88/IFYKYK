import { createServiceClient } from "@/lib/supabase-server";
import ClaimForm from "./ClaimForm";

export const dynamic = "force-dynamic";

export default async function ClaimPage(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  const admin = await createServiceClient();
  const { data: profile } = await (admin as any)
    .from("creator_profiles")
    .select("handle, display_name, claimed_at")
    .eq("claim_code", code)
    .maybeSingle();

  const valid = profile && !profile.claimed_at;

  return (
    <div style={{ minHeight: "100vh", background: "#09090C", color: "#F2F2F0", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 300, marginBottom: 8, letterSpacing: "-0.01em" }}>
          Spot<span style={{ color: "#F0B429" }}>light</span>ly
        </div>
        {valid ? (
          <>
            <p style={{ color: "rgba(242,242,240,0.7)", fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
              Your page <strong style={{ color: "#F2F2F0" }}>@{profile.handle}</strong> is ready. Set your email and a password to claim it and make it yours.
            </p>
            <ClaimForm code={code} />
          </>
        ) : (
          <p style={{ color: "rgba(242,242,240,0.7)", fontSize: 15, lineHeight: 1.7 }}>
            This link is invalid or has already been used. If you already claimed your page, head to the login page. Otherwise, ask for a fresh link.
          </p>
        )}
      </div>
    </div>
  );
}

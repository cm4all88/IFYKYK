import { createServiceClient } from "@/lib/supabase-server";
import ClaimForm from "./ClaimForm";
import { claimRejection, isValidClaimCodeFormat } from "@/lib/claim";

export const dynamic = "force-dynamic";

// Claim links are private invitations, never search results.
export const metadata = {
  title: "Claim your page · Spotlightly",
  robots: { index: false, follow: false },
};

const REFUSALS: Record<string, string> = {
  malformed: "This link is not valid. It may have been copied incompletely — try the full link from your invitation.",
  not_found: "This link is not valid. It may have been copied incompletely — try the full link from your invitation.",
  already_claimed: "This page has already been claimed. If that was you, head to the login page.",
  expired: "This invitation has expired. Reply to the email that sent you here and we'll send a fresh link.",
};

export default async function ClaimPage(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;

  // Check the shape before querying: this page is unauthenticated and runs
  // with the service role, so /claim/<junk> must not reach the database.
  const profile = isValidClaimCodeFormat(code)
    ? (
        await (await createServiceClient() as any)
          .from("creator_profiles")
          .select("handle, display_name, claimed_at, claim_expires_at")
          .eq("claim_code", code)
          .maybeSingle()
      ).data
    : null;

  const rejection = claimRejection(code, profile);
  const valid = rejection === null;

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
            {REFUSALS[rejection ?? "not_found"]}
          </p>
        )}
      </div>
    </div>
  );
}

import UnsubscribeForm from "./UnsubscribeForm";
import { decodeUnsubEmail, verifyUnsubscribeSignature } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Unsubscribe · Spotlightly",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage(props: {
  searchParams: Promise<{ e?: string; s?: string }>;
}) {
  const sp = await props.searchParams;
  const encoded = sp.e ?? "";
  const sig = sp.s ?? "";
  const email = encoded ? decodeUnsubEmail(encoded) : null;
  const valid = !!email && !!sig && verifyUnsubscribeSignature(email, sig);

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px" }}>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>
        Spotlightly
      </p>
      {valid && email ? (
        <UnsubscribeForm email={email} e={encoded} s={sig} />
      ) : (
        <>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 300, fontSize: 28, margin: "0 0 12px" }}>
            This unsubscribe link isn&apos;t valid.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--muted)" }}>
            It may have been copied incompletely. Email{" "}
            <a href="mailto:support@spotlightly.app" style={{ color: "var(--accent, #F0B429)" }}>
              support@spotlightly.app
            </a>{" "}
            and we&apos;ll take care of it for you.
          </p>
        </>
      )}
    </main>
  );
}

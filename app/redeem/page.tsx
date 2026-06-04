import { Suspense } from "react";
import RedeemForm from "./RedeemForm";

export default function RedeemPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight:"100vh", background:"#09090C", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <p style={{ color:"var(--muted)", fontFamily:"monospace", fontSize:13 }}>Loading…</p>
      </main>
    }>
      <RedeemForm />
    </Suspense>
  );
}

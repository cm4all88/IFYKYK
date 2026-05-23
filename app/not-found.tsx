import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight:"100vh", background:"#09090C", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center" }}>
      <Link href="/" style={{ fontFamily:"Georgia,serif", fontSize:24, color:"#fff", textDecoration:"none", marginBottom:64 }}>
        Spot<span style={{ color:"#F0B429" }}>light</span>ly
      </Link>
      <p style={{ fontFamily:"monospace", fontSize:10, letterSpacing:".25em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", marginBottom:16 }}>404</p>
      <h1 style={{ fontFamily:"Georgia,serif", fontSize:48, fontWeight:300, color:"#fff", marginBottom:16, lineHeight:1.1 }}>
        This page<br /><em style={{ color:"#F0B429" }}>isn&apos;t here.</em>
      </h1>
      <p style={{ fontSize:15, color:"rgba(255,255,255,0.4)", lineHeight:1.7, maxWidth:360, marginBottom:48 }}>
        The creator page or link you followed doesn&apos;t exist — or it may have moved.
      </p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        <Link href="/" style={{ background:"#F0B429", color:"#09090C", fontWeight:700, fontSize:13, padding:"12px 24px", borderRadius:999, textDecoration:"none" }}>
          Go home
        </Link>
        <Link href="/explore" style={{ background:"transparent", color:"rgba(255,255,255,0.5)", fontWeight:500, fontSize:13, padding:"12px 24px", borderRadius:999, textDecoration:"none", border:"1px solid rgba(255,255,255,0.1)" }}>
          Explore creators
        </Link>
      </div>
    </main>
  );
}

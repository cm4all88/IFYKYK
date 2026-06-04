// The signature Spotlightly surface: a cone of light pooling in darkness.
// Drop <StageBackground /> as the first child of any full-page surface.
export default function StageBackground() {
  return (
    <>
      {/* layered stage: cone + floor pool + ambient corners + vignette over base */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: [
            // tight spotlight cone from above
            "radial-gradient(ellipse 34% 55% at 50% -6%, rgba(242,184,75,0.22), rgba(242,184,75,0.06) 40%, transparent 68%)",
            // wider warm wash near the top
            "radial-gradient(ellipse 72% 48% at 50% 0%, rgba(242,184,75,0.07), transparent 60%)",
            // pool of light where the beam lands on the floor
            "radial-gradient(ellipse 44% 15% at 50% 94%, rgba(242,184,75,0.06), transparent 72%)",
            // ambient purple (Backstage) — lower left
            "radial-gradient(circle 440px at 6% 90%, rgba(168,85,247,0.08), transparent 70%)",
            // ambient mint (growth) — upper right
            "radial-gradient(circle 400px at 94% 10%, rgba(110,231,183,0.05), transparent 70%)",
            // vignette: edges fall into shadow so the centre reads as light
            "radial-gradient(ellipse 88% 92% at 50% 32%, transparent 42%, rgba(0,0,0,0.55) 100%)",
            // base stage floor
            "var(--bg, #17181B)",
          ].join(", "),
        }}
      />
      {/* soft beam shaft — blurred so it reads as a light column, never a hard line */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 220,
          height: "52vh",
          zIndex: 0,
          pointerEvents: "none",
          background: "linear-gradient(to bottom, rgba(242,184,75,0.12), transparent 82%)",
          filter: "blur(34px)",
          opacity: 0.9,
        }}
      />
    </>
  );
}

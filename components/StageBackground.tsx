// The signature Spotlightly surface — the SAME layers as the marketing hero
// (.hero-bg-img + .hero-spotlight + .hero-ambient in app/design.css), so every
// page shares one stage instead of a parallel look.
//
// Requirements on the consuming page:
//   • import "@/app/design.css"
//   • the parent element is position: relative (these layers are absolute inset:0)
//   • page content sits above with position: relative; z-index: 1
export default function StageBackground() {
  return (
    <>
      <div className="hero-bg-img" aria-hidden />
      <div className="hero-spotlight" aria-hidden />
      <div className="hero-ambient" aria-hidden />
    </>
  );
}

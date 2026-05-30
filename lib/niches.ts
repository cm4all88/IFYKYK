// ──────────────────────────────────────────────────────────────────
// lib/niches.ts
// Creator niche landing page data.
// To add a new niche: copy one entry, change the slug and content.
// ──────────────────────────────────────────────────────────────────

export interface NicheFeature {
  icon: string;
  title: string;
  desc: string;
}

export interface Niche {
  slug: string;
  name: string;           // Short name for tags
  pageName: string;       // Full name for page title
  emoji: string;
  headline: string;
  subhead: string;
  lede: string;
  pain: string;           // The platform they're fleeing
  painDetail: string;     // Specific pain point with numbers
  features: NicheFeature[];
  earningExample: {
    scenario: string;
    them: { platform: string; take: string; youGet: string };
    us: { fee: string; youGet: string };
  };
  cta: string;
  metaTitle: string;
  metaDesc: string;
}

const NICHES: Niche[] = [
  {
    slug: "3d-designers",
    name: "3D Designers",
    pageName: "3D Print Designers",
    emoji: "🖨️",
    headline: "Stop giving your STL files away for free.",
    subhead: "Your designs take hours. Your audience should pay for them.",
    lede: "You design for hours. You post to Cults3D, MyMiniFactory, Thingiverse. The downloads pile up. The money doesn't. Your most loyal followers want more from you — exclusive designs, early access, behind-the-scenes of your design process. Spotlightly is where they come to actually support you.",
    pain: "Cults3D / MyMiniFactory",
    painDetail: "Cults3D takes 8–20% of every sale depending on your tier. MyMiniFactory takes 10%. Your Patreon supporters pay monthly but have no real reason to stay. Your best fans download your free files and never come back.",
    features: [
      { icon: "📁", title: "Sell STL files directly", desc: "Upload any file — STL, 3MF, OBJ. Fans pay once, download instantly. Spotlightly takes 0%. You keep 100% minus Stripe's small fee." },
      { icon: "🔒", title: "Exclusive subscriber designs", desc: "New designs drop for subscribers first — 30 days before they go public. Give subscribers a reason to stay every single month." },
      { icon: "🎥", title: "Design process content", desc: "Screen recordings of your CAD work, failed print compilations, material tests. Lock this for subscribers — it's exactly what other designers want." },
      { icon: "📡", title: "Live design sessions", desc: "Stream yourself designing in Fusion 360, Blender, or CAD. Subscribers watch live, VOD saves automatically." },
      { icon: "🛍️", title: "Sell finished prints", desc: "List your physical prints in the marketplace. One-offs, custom runs, display pieces. Fans who follow you want pieces made by you." },
      { icon: "📦", title: "Early access passes", desc: "Superfans pay a small extra fee to see your designs 30 minutes before other subscribers. Platform revenue, not your cut." },
    ],
    earningExample: {
      scenario: "200 subscribers at $9.99/mo + 50 STL file sales at $4.99 each",
      them: { platform: "Cults3D + Patreon", take: "$598/mo in fees and cuts", youGet: "$2,247/mo" },
      us: { fee: "$79/mo flat (Growth plan)", youGet: "$2,766/mo" },
    },
    cta: "Claim your designer handle",
    metaTitle: "Spotlightly for 3D Print Designers — Sell STL Files, Build Subscribers",
    metaDesc: "Stop giving away STL files for free. Sell your designs directly, build a subscriber base, and keep 100% of digital sales. No Cults3D cut. No Patreon middleman.",
  },
  {
    slug: "etsy-sellers",
    name: "Etsy Sellers",
    pageName: "Etsy Sellers & Makers",
    emoji: "🧶",
    headline: "Etsy raised their fees again. Own your audience instead.",
    subhead: "Your customers already love you. Stop renting them from Etsy.",
    lede: "You built something on Etsy. Your reviews are real, your products are handmade, your customers keep coming back. And every year, Etsy takes more — higher fees, mandatory ad spend, algorithm changes that bury you unless you pay to be seen. Spotlightly gives you a direct line to the customers who already love your work. No algorithm. No listing fees. Just you and the people who want what you make.",
    pain: "Etsy",
    painDetail: "Etsy charges a 6.5% transaction fee + 3% + $0.25 payment processing + $0.20 per listing + 15% for offsite ads you can't opt out of above a threshold. A $50 sale costs you $5–$10 in fees before you've paid for materials or shipping.",
    features: [
      { icon: "🛍️", title: "Your own marketplace", desc: "List your handmade items directly on your Spotlightly page. Photos, video, personal notes. Fans buy from you directly. Spotlightly takes 5% — not 15%." },
      { icon: "🔒", title: "Subscriber-only drops", desc: "New items available to subscribers 48 hours before anyone else. Creates urgency. Rewards your most loyal customers. Sells out faster." },
      { icon: "💛", title: "Digital patterns & templates", desc: "Sell your knitting patterns, SVG files, crochet guides, printables. Fans buy once, download instantly. You keep 100% minus Stripe's fee." },
      { icon: "🎥", title: "Making-of content", desc: "The dyeing process, the glazing session, the cutting and sewing. Lock this for subscribers — it's the content that makes fans feel connected to you and what you make." },
      { icon: "📡", title: "Live craft sessions", desc: "Stream yourself making. Subscribers watch, ask questions, get first dibs on what you're creating. Your Etsy shop meets your community." },
      { icon: "💌", title: "Direct fan relationships", desc: "Front Row messages let your best customers reach you directly. You control who you respond to, and you earn from the connection." },
    ],
    earningExample: {
      scenario: "150 subscribers at $7.99/mo + $2,000/mo in marketplace sales",
      them: { platform: "Etsy alone", take: "$300–400/mo in fees on marketplace sales alone", youGet: "$1,600/mo" },
      us: { fee: "$29/mo flat (Starter plan) + 5% on sales", youGet: "$3,098/mo" },
    },
    cta: "Claim your maker handle",
    metaTitle: "Spotlightly for Etsy Sellers — Own Your Audience, Cut the Fees",
    metaDesc: "Etsy takes up to 15% of every sale. Spotlightly charges a flat monthly fee and takes 5% on marketplace sales. Keep your customers. Own your audience.",
  },
  {
    slug: "authors",
    name: "Authors",
    pageName: "Authors & Writers",
    emoji: "📚",
    headline: "Your readers want more than a book every two years.",
    subhead: "Give them the story behind the story.",
    lede: "Your readers finished your book and wanted more. They followed you on social media, but Instagram only shows your posts to 3% of your followers. Your newsletter has open rates dropping. Spotlightly is where your readers come to go deeper — deleted scenes, early chapters, the research behind the world you built. Direct access to you, for people who genuinely care about your work.",
    pain: "Newsletter platforms / Patreon",
    painDetail: "Substack takes 10% of paid subscriptions. Patreon takes 5–12% depending on your plan. Your social media reach is algorithmically throttled. Your email list is owned by a platform that can change its terms anytime.",
    features: [
      { icon: "📖", title: "Exclusive chapters & drafts", desc: "Share chapters before publication, early drafts, alternate endings. Subscribers get access — everyone else waits for the book." },
      { icon: "🗂️", title: "Research & world-building", desc: "The maps you drew, the research you did, the characters who got cut. This is the content superfans pay for." },
      { icon: "📁", title: "Digital downloads", desc: "Sell your backlist as ebooks, sell companion guides, character bibles, writing craft guides. You keep 100% minus Stripe's fee." },
      { icon: "✍️", title: "Signed copies in the marketplace", desc: "List personalized signed copies directly. Your readers want something that came from you specifically — not Amazon." },
      { icon: "📡", title: "Reader Q&A live streams", desc: "Live sessions with your subscribers. Book club discussions, writing advice, AMA sessions. Your most engaged readers, in one place." },
      { icon: "🔒", title: "ARC distribution", desc: "Give advance reader copies to your subscriber tier before publication. Build buzz, get reviews, reward your most loyal readers." },
    ],
    earningExample: {
      scenario: "500 reader subscribers at $5.99/mo + 100 ebook/guide sales at $9.99",
      them: { platform: "Substack", take: "$299/mo (10% of subscription revenue)", youGet: "$2,696/mo" },
      us: { fee: "$79/mo flat (Growth plan)", youGet: "$2,916/mo" },
    },
    cta: "Claim your author handle",
    metaTitle: "Spotlightly for Authors — Build a Reader Community, Earn Beyond the Book",
    metaDesc: "Your readers want more than a book every two years. Give them exclusive content, early chapters, and a direct connection. Keep 100% of ebook sales.",
  },
  {
    slug: "fitness",
    name: "Fitness Creators",
    pageName: "Fitness & Wellness Creators",
    emoji: "💪",
    headline: "Your followers work out because of you. Get paid for it.",
    subhead: "Every PT, coach, and trainer with an audience should be earning from it.",
    lede: "You post workouts. You share nutrition advice. Your followers get results. TikTok pays you $0.03 per 1,000 views. Instagram shows your posts to 8% of your audience. Meanwhile, your knowledge is genuinely changing people's lives. Spotlightly is where your audience comes to pay you directly — for the programming, the check-ins, the exclusive content that actually gets them results.",
    pain: "TikTok / Instagram",
    painDetail: "A fitness video with 500,000 TikTok views pays roughly $15. Instagram pays nothing for Reels unless you're in a limited creator program. Your followers use your free content without any path to becoming paying clients.",
    features: [
      { icon: "📁", title: "Sell training programs", desc: "Upload your programming as PDFs, spreadsheets, or video series. Fans buy once, get instant access. You keep 100% minus Stripe's fee." },
      { icon: "🔒", title: "Subscriber-only workouts", desc: "Daily or weekly workout content locked for subscribers. Give them a reason to pay — and a reason to stay." },
      { icon: "📡", title: "Live training sessions", desc: "Stream live workouts, form checks, Q&As. Your subscribers train with you in real time." },
      { icon: "💬", title: "Check-in messages", desc: "Front Row messages let your most dedicated clients reach you directly with questions. You set the terms. You earn from the interaction." },
      { icon: "🛍️", title: "Gear recommendations & marketplace", desc: "Sell your own branded gear or equipment you've tested and recommend. Your followers trust your opinion — monetize it." },
      { icon: "📊", title: "Nutrition guides & meal plans", desc: "Sell your meal plans, macro guides, recipe books as digital products. Set your price. You keep everything." },
    ],
    earningExample: {
      scenario: "300 subscribers at $12.99/mo + 200 program sales at $49",
      them: { platform: "Instagram + Patreon", take: "$585+/mo in Patreon fees + zero from Instagram", youGet: "$9,195/mo" },
      us: { fee: "$79/mo flat (Growth plan)", youGet: "$9,701/mo" },
    },
    cta: "Claim your fitness handle",
    metaTitle: "Spotlightly for Fitness Creators — Sell Programs, Build Subscribers, Train Online",
    metaDesc: "Stop earning $0.03 per 1,000 TikTok views. Build a subscriber base, sell your training programs directly, and keep 100% of digital product sales.",
  },
  {
    slug: "musicians",
    name: "Musicians",
    pageName: "Musicians & Artists",
    emoji: "🎵",
    headline: "Streaming pays fractions of a cent. Your fans will pay more.",
    subhead: "The people who actually care about your music want a direct connection to you.",
    lede: "Spotify pays $0.003 per stream. Apple Music pays $0.01. YouTube shows your music to whoever their algorithm decides. Meanwhile, your real fans — the ones who come to every show, who know every lyric — have nowhere to go to actually support you. Spotlightly is that place. Direct access to you, for the people who genuinely love what you make.",
    pain: "Spotify / streaming platforms",
    painDetail: "A song needs 250,000 streams to earn $1,000 on Spotify. Artists with 10,000 monthly listeners earn roughly $30-50/month from streaming. The same audience on Spotlightly at $7.99/mo would earn $79,900/mo.",
    features: [
      { icon: "🎵", title: "Exclusive tracks & demos", desc: "Upload unreleased music, demo recordings, acoustic versions. Subscribers get it first — sometimes exclusively." },
      { icon: "📁", title: "Sell music directly", desc: "Sell your albums, singles, stems, sample packs as digital downloads. You keep 100% minus Stripe's fee. No streaming split." },
      { icon: "📡", title: "Live sessions & performances", desc: "Stream intimate performances for your subscribers. The kind of show that doesn't happen at venues." },
      { icon: "🎥", title: "Studio & recording content", desc: "The writing process, the studio sessions, the direction changes. This is what your biggest fans will pay for." },
      { icon: "🛍️", title: "Merch through Loudcap", desc: "Your designs, your brand, fulfilled worldwide. You set the price. No upfront inventory cost." },
      { icon: "✍️", title: "Signed items & personal pieces", desc: "Signed vinyl, handwritten lyrics, instrument picks. In your marketplace, directly to the fan who wants it." },
    ],
    earningExample: {
      scenario: "500 subscribers at $7.99/mo",
      them: { platform: "Spotify", take: "You'd need 1.3 million streams/month to match this", youGet: "$3,995/mo" },
      us: { fee: "$79/mo flat (Growth plan)", youGet: "$3,916/mo" },
    },
    cta: "Claim your music handle",
    metaTitle: "Spotlightly for Musicians — Build a Fan Base That Actually Pays",
    metaDesc: "Spotify pays $0.003 per stream. Your fans will pay $7.99/mo for direct access to you. Build subscribers, sell music directly, keep 100% of digital sales.",
  },
  {
    slug: "artists",
    name: "Artists",
    pageName: "Visual Artists & Illustrators",
    emoji: "🎨",
    headline: "Instagram stole your audience. Take them back.",
    subhead: "Your work built their platform. Spotlightly builds yours.",
    lede: "You post your art. Instagram shows it to 6% of your followers — unless you boost it. The algorithm buries your best work if it doesn't perform in the first hour. The people who genuinely love your art have no way to support you beyond a like. Spotlightly is where your real audience goes to actually invest in you — subscriptions, prints, originals, tutorials, process videos.",
    pain: "Instagram / DeviantArt",
    painDetail: "Instagram organic reach has dropped to 5-8% for most artists. DeviantArt takes a percentage of digital downloads. Society6 and Redbubble take 70-80% of each sale. You're doing all the creative work and keeping almost nothing.",
    features: [
      { icon: "🖼️", title: "Sell prints & originals", desc: "Your art in the marketplace — prints, originals, commissions. Spotlightly takes 5%. You keep 95%." },
      { icon: "📁", title: "Digital downloads", desc: "Brushes, textures, reference packs, print-ready files. Fans buy once, download instantly. You keep 100% minus Stripe's fee." },
      { icon: "🔒", title: "Subscriber-only process content", desc: "Speed paints, WIP screenshots, timelapse recordings. The content that builds the deepest fan loyalty." },
      { icon: "📡", title: "Live drawing sessions", desc: "Stream your process in real time. Your subscribers watch, ask questions, commission pieces." },
      { icon: "🛍️", title: "Loudcap merch", desc: "Your illustrations on t-shirts, totes, posters, mugs. Your design, worldwide fulfillment, no upfront cost." },
      { icon: "💬", title: "Commission requests", desc: "Front Row messages let fans request commissions directly. You set the terms. You earn from the conversation." },
    ],
    earningExample: {
      scenario: "200 subscribers at $9.99/mo + $800/mo in print and digital sales",
      them: { platform: "Redbubble + Instagram", take: "Redbubble keeps 80% of print sales. Instagram pays $0.", youGet: "$2,158/mo" },
      us: { fee: "$79/mo flat + 5% on sales", youGet: "$2,719/mo" },
    },
    cta: "Claim your artist handle",
    metaTitle: "Spotlightly for Artists — Sell Your Art Directly, Keep What You Earn",
    metaDesc: "Redbubble takes 80%. Society6 takes 70%. Spotlightly takes 5% on marketplace sales and a flat monthly fee. Your art. Your audience. Your money.",
  },
];

export default NICHES;

export function getNiche(slug: string): Niche | undefined {
  return NICHES.find(n => n.slug === slug);
}

export function getAllNicheSlugs(): string[] {
  return NICHES.map(n => n.slug);
}

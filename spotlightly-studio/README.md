# Spotlightly Studio

A hosted page to build and preview Spotlightly marketing videos from any computer.

## Run locally
    npm install
    npm run dev        # http://localhost:3000

## Deploy
Vercel, with Root Directory set to this folder. Optional login via STUDIO_USER and
STUDIO_PASS env vars. To wire the MP4 export, set NEXT_PUBLIC_RENDER_URL to your
render service URL (or paste it into the studio at runtime).

See ../DEPLOY.md for the full walkthrough.

## How it works
- The form on the left edits one data object (see components/video/types.ts).
- The preview on the right is the real video, running in the browser via
  @remotion/player. No server render needed to preview.
- The composition lives in components/video/ and is the same code used by the
  standalone renderer and the render service, so previews match exports.

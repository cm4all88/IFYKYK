# Spotlightly Render Service

Turns a video data object into an MP4. Deploy from GitHub to Render.com.

## Deploy (no terminal)
1. Render.com, New, Web Service, connect the repo.
2. Root Directory: this folder. Render detects the Dockerfile.
3. Instance with 2 GB RAM or more. Deploy.
4. Copy the service URL into the studio (Render service url), or set it as
   NEXT_PUBLIC_RENDER_URL in the studio's Vercel project.

## API
    POST /render
    body: { "data": <VideoData> }
    -> streams back an MP4

    GET /health -> { ok: true } once the bundle is ready

## Notes
- For export, screenshots must be hosted urls. blob: urls (studio uploads) are skipped.
- First boot downloads the headless browser, so the first render is slower.
- See ../DEPLOY.md for the full walkthrough and the Remotion license note.

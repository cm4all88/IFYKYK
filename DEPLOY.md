# Spotlightly Video Studio (hosted)

Two pieces that together let you build and export marketing videos from any computer:

- `spotlightly-studio/` — a web app (Next.js). Build and preview videos live in the
  browser. Deploys to Vercel from GitHub, just like the main site. This is the part
  you open from any computer.
- `render-service/` — a small server that turns a video into an MP4 file. Deploys to
  Render.com from GitHub (no terminal needed). The studio calls it when you click
  Export.

You can deploy just the studio and use it to preview and design videos (then screen
record if you want a quick clip). Add the render service when you want real MP4 files.

## 1. Deploy the studio (preview from any computer)

1. Put this whole folder in a GitHub repo (or its own repo).
2. In Vercel: New Project, import the repo, set the Root Directory to
   `spotlightly-studio`, deploy.
3. Optional password: in Vercel project settings add env vars `STUDIO_USER` and
   `STUDIO_PASS`. With both set, the site asks for that login. Leave them unset to
   keep it open.
4. Open the deployed URL on any computer. Edit the form, watch the preview update,
   done.

That is the whole "use it from any computer" loop for building and previewing.

## 2. Deploy the render service (to export MP4)

1. In Render.com: New, Web Service, connect the same repo.
2. Set Root Directory to `render-service`. Render will detect the Dockerfile.
3. Pick an instance with at least 2 GB RAM (more RAM renders faster). Deploy.
4. When it is live, copy its URL (e.g. `https://spotlightly-render.onrender.com`).
5. In the studio, paste that URL into the Render service url field (or set it once
   for everyone as `NEXT_PUBLIC_RENDER_URL` in Vercel and redeploy the studio).
6. Click Export MP4. The file downloads when it is done (about one to three minutes).

### Export notes

- For export, screenshots must be hosted urls (for example BunnyCDN links). Files you
  upload in the studio are preview only and are skipped on export; those scenes fall
  back to the native cards.
- The render service is stateless. It bundles the video once at boot and renders on
  request. On Render's free tier it sleeps when idle, so the first render after a nap
  takes longer.

## 3. Render locally instead (no service)

If you would rather not host the render service, use the standalone
`spotlightly-video-generator` project (delivered separately). Click Copy JSON in the
studio, paste it into a file in that project's `data/` folder, and run
`npm run render`. Same output, no server.

## License note

Remotion is free for individuals and small companies but a company above its free
threshold needs a paid license. Check remotion.dev/license to confirm Tahoma is in
the free tier before using this commercially.

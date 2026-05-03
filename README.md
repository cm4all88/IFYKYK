# Spotlightly Deploy Tool

One-time setup, then every batch deploys with one command.

## One-time setup

1. Save `deploy.ps1` to your repo at `tools/deploy.ps1`:
   ```powershell
   New-Item -ItemType Directory -Force -Path ".\tools" | Out-Null
   # then move deploy.ps1 from Downloads into .\tools\
   ```

2. Allow scripts to run (PowerShell defaults block local scripts). Run ONCE in any PowerShell:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```
   Answer `Y` when asked. This lets you run scripts you wrote, but still blocks unsigned scripts from the internet.

3. Done. You only do steps 1–2 once.

## How to deploy a batch (every time)

When I send you a batch, it'll be a folder of files including a `manifest.json`. Drop the whole folder into your `Downloads`. Then:

```powershell
cd C:\Users\cmm2s\OneDrive\Documents\GitHub\IFYKYK
.\tools\deploy.ps1
```

That's it. The script:
- Finds the newest folder in Downloads with a `manifest.json`
- Places every file at its correct destination (creates folders as needed)
- Forces UTF-8-no-BOM encoding (avoids the encoding bug we hit before)
- Applies any post-deploy text patches the manifest specifies
- Reports what it did
- Tells you what to do next (usually `npm run build`)

Optional flags:

- `-From "C:\path\to\folder"` — deploy from a specific folder instead of auto-finding
- `-DryRun` — show what would happen without changing any files

## For v3 specifically (your current batch)

The v3 batch I sent you didn't include a `manifest.json` because the deploy tool didn't exist yet. To deploy v3 with this tool:

1. Put all 16 v3 files PLUS the `manifest.json` from this bundle into a single folder, e.g. `Downloads\spotlightly-v3\`
2. From your repo root:
   ```powershell
   cd C:\Users\cmm2s\OneDrive\Documents\GitHub\IFYKYK
   .\tools\deploy.ps1
   ```
3. Run the SQL migration manually in Supabase SQL Editor (`01-migrations.sql` doesn't go in the repo)
4. `npm run build` to verify
5. `git add -A && git commit -m "feat: v3 batch" && git push`

If any file is missing, the script tells you exactly which one. If a patch can't find its target text, it skips and tells you (means it's already applied or the file changed).

## What goes in future batches

Every batch from here will be a folder containing:
- All the `.ts` / `.tsx` / `.css` / `.json` source files
- A `manifest.json` that knows where each one goes
- Optionally `01-migrations.sql` or similar — these you still run manually in Supabase, they don't go in the repo
- A `README.md` for context

Drop the folder in Downloads, run `.\tools\deploy.ps1`, you're done in 5 seconds.

## What it doesn't do

- Doesn't run SQL — that's still on you, paste into Supabase
- Doesn't `npm run build` — runs after, you call it
- Doesn't `git push` — you decide when to push
- Doesn't manage env vars — that's `vercel env` and the `/admin` page
- Doesn't deploy to production — Vercel does that on git push

It's a file-placer, not a CI/CD pipeline. The thing that was eating an hour per batch was placing files. That's the part it solves.

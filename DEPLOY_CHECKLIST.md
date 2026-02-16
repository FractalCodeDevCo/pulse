# Pulse Deploy Checklist (No 404)

## 1) Repo / Branch
- Confirm latest code is pushed to GitHub.
- Confirm branch selected in Vercel is the same one you want to deploy.

## 2) Vercel Project Settings
- Framework Preset: `Next.js`
- Root Directory: `.`
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: leave empty

## 3) Environment Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`)
- `SUPABASE_STORAGE_BUCKET=pulse-evidence`

Set for: `Production`, `Preview`, and `Development`.

## 4) Supabase SQL
- Run `/supabase/schema.sql` in SQL Editor.
- Verify tables exist: `zones`, `rollos`, `rollos_photos`, `compactacion`, `compactacion_photos`.

## 5) Pre-deploy Local Check
- Run `npm run build`.
- Build must finish with no errors.

## 6) Deploy Validation
- Open `/` and confirm Home renders.
- Open `/projects`.
- Open `/capture?project=test`.
- Open `/capture/rollos?project=test` and submit one record.
- Open `/capture/compactacion?project=test` and submit one record.

## 7) If 404 appears
- Check deployed project is the correct repository.
- Check custom domain is attached to this exact Vercel project.
- Redeploy using "Use Project Settings".

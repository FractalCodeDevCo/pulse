# Supabase Setup (Vercel)

## 1) Create Supabase project
- Create a new project in Supabase.
- Copy Project URL.

## 2) Get the backend key
Supabase has 2 possible key systems:

- Legacy projects: use `service_role` key.
- New projects: use `sb_secret_...` key.

Use **only one** in Vercel:
- `SUPABASE_SERVICE_ROLE_KEY` (legacy), or
- `SUPABASE_SECRET_KEY` (new)

Also copy:
- `SUPABASE_ANON_KEY` (required for user login/auth endpoints)

## 3) Create DB table + storage bucket
- Open Supabase SQL Editor.
- Run `/Users/tiro/fractalbuild/supabase/schema.sql`.

## 4) Set Vercel environment variables
In Vercel Project Settings > Environment Variables, set:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` OR `SUPABASE_SECRET_KEY`
- `SUPABASE_STORAGE_BUCKET` (use `pulse-evidence`)
- `SUPABASE_BACKUP_BUCKET` (use `pulse-backups`)
- `PULSE_BOOTSTRAP_ADMIN_EMAIL` (first admin email for bootstrap)
- `PULSE_BOOTSTRAP_ADMIN_EMAILS` (optional comma-separated emails forced as admin)
- `PULSE_ALLOW_SELF_SERVE_ADMIN=0` (keep disabled in production)

## 5) Deploy
- Redeploy project.
- API route `/api/records` saves records to table `field_records`.
- Any base64 image in payload is uploaded to storage and replaced with public URL.
- Login uses `/api/auth/login` and role checks from `public.app_user_roles`.
- Protected pages: `/projects/*`, `/capture/*`.

## 6) Verify
- Capture one record from app.
- Check Supabase table `field_records`.
- Check storage bucket `pulse-evidence` for uploaded images.

## Notes
- Modules saving to cloud: `compactacion`, `rollos`, `pegada`, `material`.
- If cloud save fails, app still stores local backup.
- Backups:
  - Create/list: `/api/admin/backups` (`POST` create, `GET` list; roles `admin|pm`)
  - Restore dry-run/apply: `/api/admin/backups/restore` (`admin` only)

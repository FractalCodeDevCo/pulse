# Backup and Recovery Runbook

## Scope
- This backup is a logical JSON snapshot from operational tables.
- It is intended for rapid recovery of app data and cross-device continuity.

## Prerequisites
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`
- `SUPABASE_BACKUP_BUCKET` (default: `pulse-backups`)
- Auth role:
  - `admin` or `pm` can create backups
  - only `admin` can apply restore

## Create backup
- Endpoint: `POST /api/admin/backups`
- Result:
  - uploads snapshot JSON to bucket `pulse-backups`
  - writes metadata row in `public.backup_snapshots`

## List backups
- Endpoint: `GET /api/admin/backups`
- Returns latest snapshots with row counts and checksum.

## Restore (safe flow)
1. Dry run:
   - `POST /api/admin/backups/restore`
   - body: `{ "backupId": "<id>", "apply": false }`
2. Validate table counts from response.
3. Apply:
   - `POST /api/admin/backups/restore`
   - body: `{ "backupId": "<id>", "apply": true }`

## Restore behavior
- Uses upsert by `id` when available.
- Non-destructive by default (does not truncate tables).
- If a table restore fails, response includes table-level errors.

## Recommended cadence
- Daily backup during active installation windows.
- Pre-release backup before any schema or app deployment.

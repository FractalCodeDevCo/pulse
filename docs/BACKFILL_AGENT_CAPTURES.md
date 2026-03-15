# Backfill Agent Captures

## Goal

Move historical project evidence into the new agent-friendly capture model without losing the original metadata.

## Step 1

Run [`agent_capture_upgrade.sql`](C:\Users\sigma\lab-ai\fractalbuild\supabase\agent_capture_upgrade.sql) in the Supabase SQL Editor.

This adds the flat columns on `public.captures` and creates the `public.agent_capture_facts` view.

## Step 2

Run a dry-run locally:

```bash
npm run backfill:agent-captures
```

This only reads Supabase and reports:

- existing capture rows
- rows that need flat-column updates
- historical rows that can be inserted from previous operational tables

## Step 3

Apply the backfill:

```bash
npm run backfill:agent-captures:apply
```

## What the script migrates

- `field_records`
- `roll_installation`
- `material_records`

## Safety

- The script is idempotent by fingerprinting `project_id + phase + capture_session_id + image_url`.
- Existing `captures` rows are enriched with flat columns instead of losing metadata.
- Historical rows are only inserted when they are not already represented in `captures`.

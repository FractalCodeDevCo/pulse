create extension if not exists "pgcrypto";

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  phase text not null,
  image_url text not null,
  timestamp timestamptz not null default now(),
  crew text,
  project_zone_id text,
  capture_session_id text,
  capture_status text,
  field_type text,
  macro_zone text,
  micro_zone text,
  zone_type text,
  zone text,
  notes text,
  feet_installed numeric,
  rolls_used integer,
  glue_buckets numeric,
  seams integer,
  roll_length_fit text,
  compaction_method text,
  compaction_surface_firm boolean,
  quality_label text,
  source_table text,
  source_id text,
  photo_type text,
  metadata jsonb not null default '{}'::jsonb
);

alter table if exists public.captures add column if not exists project_zone_id text;
alter table if exists public.captures add column if not exists capture_session_id text;
alter table if exists public.captures add column if not exists capture_status text;
alter table if exists public.captures add column if not exists field_type text;
alter table if exists public.captures add column if not exists macro_zone text;
alter table if exists public.captures add column if not exists micro_zone text;
alter table if exists public.captures add column if not exists zone_type text;
alter table if exists public.captures add column if not exists zone text;
alter table if exists public.captures add column if not exists notes text;
alter table if exists public.captures add column if not exists feet_installed numeric;
alter table if exists public.captures add column if not exists rolls_used integer;
alter table if exists public.captures add column if not exists glue_buckets numeric;
alter table if exists public.captures add column if not exists seams integer;
alter table if exists public.captures add column if not exists roll_length_fit text;
alter table if exists public.captures add column if not exists compaction_method text;
alter table if exists public.captures add column if not exists compaction_surface_firm boolean;
alter table if exists public.captures add column if not exists quality_label text;
alter table if exists public.captures add column if not exists source_table text;
alter table if exists public.captures add column if not exists source_id text;
alter table if exists public.captures add column if not exists photo_type text;
alter table if exists public.captures add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_captures_project on public.captures(project_id);
create index if not exists idx_captures_phase on public.captures(phase);
create index if not exists idx_captures_zone on public.captures(zone);
create index if not exists idx_captures_timestamp on public.captures(timestamp desc);
create index if not exists idx_captures_project_zone on public.captures(project_zone_id);
create index if not exists idx_captures_macro_micro on public.captures(macro_zone, micro_zone);
create index if not exists idx_captures_source on public.captures(source_table, source_id);

create extension if not exists "pgcrypto";

-- Generic storage for modules already in production
create table if not exists public.field_records (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  module text not null,
  field_type text,
  macro_zone text,
  micro_zone text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table if exists public.field_records add column if not exists macro_zone text;
alter table if exists public.field_records add column if not exists micro_zone text;
create index if not exists idx_field_records_project on public.field_records(project_id);
create index if not exists idx_field_records_module on public.field_records(module);
create index if not exists idx_field_records_created_at on public.field_records(created_at desc);

-- Material module table
create table if not exists public.material_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id text not null,
  field_type text,
  tipo_material text not null,
  tipo_pasada text not null,
  valvula integer not null check (valvula between 1 and 6),
  bolsas_esperadas numeric not null,
  bolsas_utilizadas numeric not null,
  desviacion numeric not null,
  status_color text not null check (status_color in ('verde', 'amarillo', 'rojo')),
  sugerencia text,
  fotos jsonb not null default '[]'::jsonb,
  observaciones text
);

create index if not exists idx_material_records_project on public.material_records(project_id);
create index if not exists idx_material_records_created_at on public.material_records(created_at desc);

-- Independent incidence log table (separate from production records)
create table if not exists public.incidences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id text not null,
  field_type text,
  macro_zone text not null,
  micro_zone text not null,
  type_of_incidence text not null,
  priority_level text not null,
  impact_level text,
  photos jsonb not null default '[]'::jsonb,
  note text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_incidences_project on public.incidences(project_id);
create index if not exists idx_incidences_created_at on public.incidences(created_at desc);
create index if not exists idx_incidences_type on public.incidences(type_of_incidence);

-- Roll installation (rolls + compaction simplified)
create table if not exists public.roll_installation (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  zone text not null,
  roll_length_fit text not null,
  total_rolls_used integer not null,
  total_seams integer not null,
  compaction_surface_firm boolean not null,
  compaction_moisture_ok boolean not null,
  compaction_double boolean not null,
  compaction_method text not null,
  photos jsonb not null
);

create index if not exists idx_roll_installation_created_at on public.roll_installation(created_at desc);
create index if not exists idx_roll_installation_zone on public.roll_installation(zone);

-- Roll verification module
create table if not exists public.roll_verification (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  zone text not null,
  length_ft integer,
  color_letter text,
  status text not null,
  notes text,
  photo_url text not null
);

create index if not exists idx_roll_verification_created_at on public.roll_verification(created_at desc);
create index if not exists idx_roll_verification_zone on public.roll_verification(zone);

-- Sports hierarchical zone catalog (sport -> macro -> micro)
create table if not exists public.sport_zone_catalog (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  macro_zone text not null,
  micro_zone text not null,
  unique (sport, macro_zone, micro_zone)
);

insert into public.sport_zone_catalog (sport, macro_zone, micro_zone)
values
  ('baseball', 'Infield', 'Pitcher''s Mound'),
  ('baseball', 'Infield', 'Circle interior pitch'),
  ('baseball', 'Infield', 'Batters Box (Left)'),
  ('baseball', 'Infield', 'Batters Box (Right)'),
  ('baseball', 'Infield', 'Home Plate area'),
  ('baseball', 'Infield', 'Base Path - 1st Base'),
  ('baseball', 'Infield', 'Base Path - 2nd Base'),
  ('baseball', 'Infield', 'Base Path - 3rd Base'),
  ('baseball', 'Infield', 'Shortstop area'),
  ('baseball', 'Outfield', 'Center Field'),
  ('baseball', 'Outfield', 'Left Field'),
  ('baseball', 'Outfield', 'Right Field'),
  ('baseball', 'Foul Territory', 'Foul Left'),
  ('baseball', 'Foul Territory', 'Foul Right'),
  ('baseball', 'Foul Territory', 'On-Deck Circles'),
  ('baseball', 'Foul Territory', 'Dugouts'),
  ('baseball', 'Warning Track', 'Warning Track - Left'),
  ('baseball', 'Warning Track', 'Warning Track - Center'),
  ('baseball', 'Warning Track', 'Warning Track - Right'),
  ('baseball', 'Borders', 'Perimeter Turf Strip'),
  ('baseball', 'Borders', 'Sidelines adjacentes'),
  ('softball', 'Infield', 'Circle interior - Pitcher'),
  ('softball', 'Infield', 'Batters Box (Left)'),
  ('softball', 'Infield', 'Batters Box (Right)'),
  ('softball', 'Infield', 'Base Path - 1st Base'),
  ('softball', 'Infield', 'Base Path - 2nd Base'),
  ('softball', 'Infield', 'Base Path - 3rd Base'),
  ('softball', 'Infield', 'Home Plate complex'),
  ('softball', 'Outfield', 'Left Field'),
  ('softball', 'Outfield', 'Center Field'),
  ('softball', 'Outfield', 'Right Field'),
  ('softball', 'Foul Territory', 'Foul Left'),
  ('softball', 'Foul Territory', 'Foul Right'),
  ('softball', 'Warning Track', 'Warning Track'),
  ('softball', 'Borders', 'Perimeter adjacent'),
  ('softball', 'Borders', 'Sidelines'),
  ('football', 'End Zones', 'Left End Zone'),
  ('football', 'End Zones', 'Right End Zone'),
  ('football', 'Field Interior', 'Hash Marks Inside'),
  ('football', 'Field Interior', 'Flank (Sideline) Left'),
  ('football', 'Field Interior', 'Flank (Sideline) Right'),
  ('football', 'Field Interior', 'Center Stripes'),
  ('football', 'Numbers / Logos', 'Field Numbers'),
  ('football', 'Numbers / Logos', 'Midfield Logo'),
  ('football', 'Numbers / Logos', 'Yardage Markings'),
  ('football', 'Borders', 'Sideline buffer'),
  ('football', 'Borders', 'Team area / bench zones'),
  ('soccer', 'Field Interior', 'Left Half'),
  ('soccer', 'Field Interior', 'Right Half'),
  ('soccer', 'Field Interior', 'Center Circle'),
  ('soccer', 'Field Interior', 'Penalty Box Left'),
  ('soccer', 'Field Interior', 'Penalty Box Right'),
  ('soccer', 'Goals', 'Goal Box Left'),
  ('soccer', 'Goals', 'Goal Box Right'),
  ('soccer', 'Sidelines', 'Touchline Left'),
  ('soccer', 'Sidelines', 'Touchline Right'),
  ('soccer', 'Borders', 'Endline Left'),
  ('soccer', 'Borders', 'Endline Right'),
  ('soccer', 'Borders', 'Technical Area')
on conflict (sport, macro_zone, micro_zone) do nothing;

create index if not exists idx_sport_zone_catalog_sport on public.sport_zone_catalog(sport);

-- Roll verification table (control before installation)
create table if not exists public.roll_verifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id text not null,
  field_type text not null,
  macro_zone text not null,
  micro_zone text not null,
  roll_color text not null,
  roll_feet_total numeric not null,
  roll_lot_id text,
  label_photo_url text not null,
  status text not null check (status in ('pending', 'confirmed', 'rejected')),
  rejection_reason text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_roll_verifications_project on public.roll_verifications(project_id);
create index if not exists idx_roll_verifications_zone on public.roll_verifications(project_id, macro_zone, micro_zone);
create index if not exists idx_roll_verifications_created_at on public.roll_verifications(created_at desc);

-- Zones catalog
create table if not exists public.zones (
  id text primary key,
  name text not null unique
);

insert into public.zones (id, name)
values
  ('CENTRAL', 'Central'),
  ('SIDELINE_RIGHT', 'Sideline Derecho'),
  ('SIDELINE_LEFT', 'Sideline Izquierdo'),
  ('CABECERAS', 'Cabeceras')
on conflict (id) do update set name = excluded.name;

-- Unified Rollos + Compactacion phase (zone-based)
create table if not exists public.rollos (
  id uuid primary key default gen_random_uuid(),
  zone_id text not null references public.zones(id),
  project_id text,
  field_type text,
  total_rolls integer not null check (total_rolls >= 0),
  total_seams integer not null check (total_seams >= 0),
  phase_status text not null check (phase_status in ('COMPACTING', 'IN_PROGRESS', 'COMPLETED')),
  compaction_type text not null check (compaction_type in ('PLATE', 'ROLLER', 'MANUAL')),
  surface_firm boolean not null default false,
  moisture_ok boolean not null default false,
  double_compaction boolean not null default false,
  roll_length_status text not null check (roll_length_status in ('NORMAL', 'JUSTO', 'MAJOR_MISMATCH')),
  observations text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rollos_project on public.rollos(project_id);
create index if not exists idx_rollos_zone on public.rollos(zone_id);
create index if not exists idx_rollos_created_at on public.rollos(created_at desc);

create table if not exists public.rollos_photos (
  id uuid primary key default gen_random_uuid(),
  rollos_id uuid not null references public.rollos(id) on delete cascade,
  image_url text not null
);

create index if not exists idx_rollos_photos_rollos on public.rollos_photos(rollos_id);

-- Compatibility migration for previous rollos schema
alter table if exists public.rollos add column if not exists total_rolls integer;
alter table if exists public.rollos add column if not exists total_seams integer;
alter table if exists public.rollos add column if not exists phase_status text;
alter table if exists public.rollos add column if not exists compaction_type text;
alter table if exists public.rollos add column if not exists surface_firm boolean;
alter table if exists public.rollos add column if not exists moisture_ok boolean;
alter table if exists public.rollos add column if not exists double_compaction boolean;
alter table if exists public.rollos add column if not exists roll_length_status text;

-- Keep compactacion table for backward compatibility
create table if not exists public.compactacion (
  id uuid primary key default gen_random_uuid(),
  zone_id text not null references public.zones(id),
  project_id text,
  field_type text,
  compactacion_type text not null check (compactacion_type in ('GENERAL', 'AJUSTE')),
  direction_aligned_to_rolls boolean not null,
  surface_firm boolean not null,
  moisture_ok boolean not null,
  traffic_light_status text not null check (traffic_light_status in ('GREEN', 'YELLOW', 'RED')),
  observations text,
  crew_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_compactacion_project on public.compactacion(project_id);
create index if not exists idx_compactacion_zone on public.compactacion(zone_id);
create index if not exists idx_compactacion_created_at on public.compactacion(created_at desc);

create table if not exists public.compactacion_photos (
  id uuid primary key default gen_random_uuid(),
  compactacion_id uuid not null references public.compactacion(id) on delete cascade,
  image_url text not null
);

create index if not exists idx_compactacion_photos_compactacion on public.compactacion_photos(compactacion_id);

-- Storage bucket for evidence photos
insert into storage.buckets (id, name, public)
values ('pulse-evidence', 'pulse-evidence', true)
on conflict (id) do nothing;

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

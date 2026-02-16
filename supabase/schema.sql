create extension if not exists "pgcrypto";

-- Generic storage for modules already in production
create table if not exists public.field_records (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  module text not null,
  field_type text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

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
  valvula integer not null check (valvula between 1 and 5),
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

-- Zones catalog used by Rollos + Compactacion
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

-- Rollos module (zone-based record)
create table if not exists public.rollos (
  id uuid primary key default gen_random_uuid(),
  zone_id text not null references public.zones(id),
  project_id text,
  field_type text,
  total_rolls_installed integer not null check (total_rolls_installed >= 0),
  seams_completed integer not null check (seams_completed >= 0),
  waste_estimated numeric,
  zone_status text not null check (zone_status in ('IN_PROGRESS', 'COMPLETED')),
  observations text,
  crew_id text not null,
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

-- Compactacion module (general / ajuste per zone)
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

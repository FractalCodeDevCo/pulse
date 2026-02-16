create extension if not exists "pgcrypto";

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

-- Storage bucket for evidence photos
insert into storage.buckets (id, name, public)
values ('pulse-evidence', 'pulse-evidence', true)
on conflict (id) do nothing;

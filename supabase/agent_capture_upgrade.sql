alter table if exists public.captures add column if not exists module text;
alter table if exists public.captures add column if not exists field_type text;
alter table if exists public.captures add column if not exists project_zone_id text;
alter table if exists public.captures add column if not exists capture_session_id text;
alter table if exists public.captures add column if not exists capture_status text not null default 'complete';
alter table if exists public.captures add column if not exists macro_zone text;
alter table if exists public.captures add column if not exists micro_zone text;
alter table if exists public.captures add column if not exists flow_step_key text;
alter table if exists public.captures add column if not exists condition_label text;
alter table if exists public.captures add column if not exists feet_installed numeric;
alter table if exists public.captures add column if not exists glue_buckets numeric;
alter table if exists public.captures add column if not exists total_rolls_used numeric;
alter table if exists public.captures add column if not exists total_seams numeric;
alter table if exists public.captures add column if not exists roll_length_fit text;
alter table if exists public.captures add column if not exists compaction_method text;
alter table if exists public.captures add column if not exists compaction_surface_firm boolean;
alter table if exists public.captures add column if not exists compaction_moisture_ok boolean;
alter table if exists public.captures add column if not exists compaction_double boolean;

create index if not exists idx_captures_project_zone_id on public.captures(project_zone_id);
create index if not exists idx_captures_macro_micro on public.captures(project_id, macro_zone, micro_zone);

create or replace view public.agent_capture_facts as
select
  c.id as capture_id,
  c.project_id,
  c.timestamp as captured_at,
  (c.timestamp at time zone 'utc')::date as capture_date,
  c.phase,
  coalesce(c.module, c.metadata ->> 'module') as module,
  coalesce(c.field_type, c.metadata ->> 'fieldType', c.metadata ->> 'field_type') as field_type,
  coalesce(c.project_zone_id, c.metadata ->> 'projectZoneId', c.metadata ->> 'project_zone_id') as project_zone_id,
  coalesce(c.capture_session_id, c.metadata ->> 'captureSessionId', c.metadata ->> 'capture_session_id') as capture_session_id,
  coalesce(c.capture_status, c.metadata ->> 'captureStatus', c.metadata ->> 'capture_status', 'complete') as capture_status,
  c.zone,
  coalesce(
    c.macro_zone,
    c.metadata ->> 'macroZone',
    c.metadata ->> 'macro_zone',
    c.metadata -> 'payload' ->> 'macroZone',
    c.metadata -> 'payload' ->> 'macro_zone'
  ) as macro_zone,
  coalesce(
    c.micro_zone,
    c.metadata ->> 'microZone',
    c.metadata ->> 'micro_zone',
    c.metadata -> 'payload' ->> 'microZone',
    c.metadata -> 'payload' ->> 'micro_zone'
  ) as micro_zone,
  c.image_url,
  c.crew,
  c.notes,
  coalesce(c.flow_step_key, c.metadata ->> 'stepKey', c.metadata ->> 'step_key', c.metadata -> 'payload' ->> 'step_key') as flow_step_key,
  coalesce(c.condition_label, c.metadata -> 'payload' ->> 'condicion', c.metadata -> 'payload' ->> 'condition') as condition_label,
  coalesce(c.feet_installed, nullif(c.metadata ->> 'feetInstalled', '')::numeric, nullif(c.metadata ->> 'feet_installed', '')::numeric, nullif(c.metadata -> 'payload' ->> 'ftTotales', '')::numeric, nullif(c.metadata -> 'payload' ->> 'ft_totales', '')::numeric, nullif(c.metadata -> 'payload' ->> 'ft', '')::numeric) as feet_installed,
  coalesce(c.glue_buckets, nullif(c.metadata ->> 'glueBuckets', '')::numeric, nullif(c.metadata ->> 'glue_buckets', '')::numeric, nullif(c.metadata -> 'payload' ->> 'botesUsados', '')::numeric, nullif(c.metadata -> 'payload' ->> 'botes_usados', '')::numeric, nullif(c.metadata -> 'payload' ->> 'botes', '')::numeric) as glue_buckets,
  coalesce(c.total_rolls_used, nullif(c.metadata ->> 'totalRollsUsed', '')::numeric, nullif(c.metadata ->> 'total_rolls_used', '')::numeric, nullif(c.metadata -> 'payload' ->> 'totalRollsUsed', '')::numeric, nullif(c.metadata -> 'payload' ->> 'total_rolls_used', '')::numeric, nullif(c.metadata -> 'payload' ->> 'totalRolls', '')::numeric) as total_rolls_used,
  coalesce(c.total_seams, nullif(c.metadata ->> 'totalSeams', '')::numeric, nullif(c.metadata ->> 'total_seams', '')::numeric, nullif(c.metadata -> 'payload' ->> 'totalSeams', '')::numeric, nullif(c.metadata -> 'payload' ->> 'total_seams', '')::numeric, nullif(c.metadata -> 'payload' ->> 'seams', '')::numeric) as total_seams,
  coalesce(c.roll_length_fit, c.metadata ->> 'rollLengthFit', c.metadata ->> 'roll_length_fit', c.metadata -> 'payload' ->> 'rollLengthFit', c.metadata -> 'payload' ->> 'roll_length_fit') as roll_length_fit,
  coalesce(c.compaction_method, c.metadata ->> 'compactionMethod', c.metadata ->> 'compaction_method', c.metadata -> 'compaction' ->> 'method') as compaction_method,
  coalesce(c.compaction_surface_firm, nullif(c.metadata ->> 'compactionSurfaceFirm', '')::boolean, nullif(c.metadata ->> 'compaction_surface_firm', '')::boolean, nullif(c.metadata -> 'compaction' ->> 'surfaceFirm', '')::boolean) as compaction_surface_firm,
  coalesce(c.compaction_moisture_ok, nullif(c.metadata ->> 'compactionMoistureOk', '')::boolean, nullif(c.metadata ->> 'compaction_moisture_ok', '')::boolean, nullif(c.metadata -> 'compaction' ->> 'moistureOk', '')::boolean) as compaction_moisture_ok,
  coalesce(c.compaction_double, nullif(c.metadata ->> 'compactionDouble', '')::boolean, nullif(c.metadata ->> 'compaction_double', '')::boolean, nullif(c.metadata -> 'compaction' ->> 'doubleCompaction', '')::boolean) as compaction_double,
  c.metadata as raw_metadata,
  'captures'::text as source_table
from public.captures c;

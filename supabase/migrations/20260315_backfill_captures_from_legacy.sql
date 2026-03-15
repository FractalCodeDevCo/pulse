insert into public.captures (
  project_id,
  phase,
  image_url,
  timestamp,
  project_zone_id,
  capture_session_id,
  capture_status,
  field_type,
  macro_zone,
  micro_zone,
  zone,
  notes,
  feet_installed,
  glue_buckets,
  quality_label,
  source_table,
  source_id,
  metadata
)
select
  fr.project_id,
  case
    when fr.module = 'pegada' then 'glue'
    when fr.module = 'compactacion' then 'compaction'
    when fr.module = 'rollos' then 'roll_install'
    else coalesce(fr.module, 'capture')
  end as phase,
  photo.image_url,
  fr.created_at,
  fr.project_zone_id,
  fr.capture_session_id,
  fr.capture_status,
  fr.field_type,
  fr.macro_zone,
  fr.micro_zone,
  coalesce(fr.macro_zone, fr.micro_zone),
  coalesce(fr.payload ->> 'notes', fr.payload ->> 'observaciones'),
  nullif(coalesce(fr.payload ->> 'ftTotales', fr.payload ->> 'ft_totales', fr.payload ->> 'ft'), '')::numeric,
  nullif(coalesce(fr.payload ->> 'botesUsados', fr.payload ->> 'botes_usados', fr.payload ->> 'botes'), '')::numeric,
  lower(coalesce(fr.payload -> 'metadata' ->> 'visionLabel', fr.payload ->> 'visionLabel')),
  'field_records',
  fr.id::text,
  coalesce(fr.payload -> 'metadata', fr.payload, '{}'::jsonb)
from public.field_records fr
cross join lateral (
  select jsonb_array_elements_text(
    case
      when jsonb_typeof(fr.payload -> 'photosUrls') = 'array' then fr.payload -> 'photosUrls'
      else '[]'::jsonb
    end
  ) as image_url
) photo
where not exists (
  select 1
  from public.captures c
  where c.source_table = 'field_records'
    and c.source_id = fr.id::text
    and c.image_url = photo.image_url
);

insert into public.captures (
  project_id,
  phase,
  image_url,
  timestamp,
  project_zone_id,
  capture_session_id,
  capture_status,
  field_type,
  macro_zone,
  micro_zone,
  zone_type,
  zone,
  rolls_used,
  seams,
  roll_length_fit,
  compaction_method,
  compaction_surface_firm,
  source_table,
  source_id,
  metadata
)
select
  ri.project_id,
  'roll_install',
  coalesce(photo.value ->> 'url', photo.value::text),
  ri.created_at,
  ri.project_zone_id,
  ri.capture_session_id,
  ri.capture_status,
  ri.field_type,
  ri.macro_zone,
  ri.micro_zone,
  ri.zone_type,
  coalesce(ri.zone, ri.macro_zone, ri.micro_zone),
  ri.total_rolls_used,
  ri.total_seams,
  ri.roll_length_fit,
  ri.compaction_method,
  ri.compaction_surface_firm,
  'roll_installation',
  ri.id::text,
  jsonb_build_object(
    'totalRollsUsed', ri.total_rolls_used,
    'totalSeams', ri.total_seams,
    'rollLengthFit', ri.roll_length_fit,
    'compactionMethod', ri.compaction_method,
    'surfaceFirm', ri.compaction_surface_firm
  )
from public.roll_installation ri
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(ri.photos) = 'array' then ri.photos
    else '[]'::jsonb
  end
) photo(value)
where not exists (
  select 1
  from public.captures c
  where c.source_table = 'roll_installation'
    and c.source_id = ri.id::text
    and c.image_url = coalesce(photo.value ->> 'url', photo.value::text)
);

insert into public.captures (
  project_id,
  phase,
  image_url,
  timestamp,
  project_zone_id,
  capture_session_id,
  capture_status,
  field_type,
  notes,
  source_table,
  source_id,
  metadata
)
select
  mr.project_id,
  'material',
  photo.image_url,
  mr.created_at,
  mr.project_zone_id,
  mr.capture_session_id,
  mr.capture_status,
  mr.field_type,
  mr.observaciones,
  'material_records',
  mr.id::text,
  jsonb_build_object(
    'tipoMaterial', mr.tipo_material,
    'tipoPasada', mr.tipo_pasada,
    'valvula', mr.valvula,
    'bolsasEsperadas', mr.bolsas_esperadas,
    'bolsasUtilizadas', mr.bolsas_utilizadas,
    'desviacion', mr.desviacion,
    'statusColor', mr.status_color
  )
from public.material_records mr
cross join lateral (
  select jsonb_array_elements_text(
    case
      when jsonb_typeof(mr.fotos) = 'array' then mr.fotos
      else '[]'::jsonb
    end
  ) as image_url
) photo
where not exists (
  select 1
  from public.captures c
  where c.source_table = 'material_records'
    and c.source_id = mr.id::text
    and c.image_url = photo.image_url
);

insert into public.captures (
  project_id,
  phase,
  image_url,
  timestamp,
  project_zone_id,
  field_type,
  macro_zone,
  micro_zone,
  zone_type,
  zone,
  notes,
  quality_label,
  source_table,
  source_id,
  metadata
)
select
  i.project_id,
  'incident',
  photo.image_url,
  i.created_at,
  i.project_zone_id,
  i.field_type,
  i.macro_zone,
  i.micro_zone,
  i.zone_type,
  coalesce(i.micro_zone, i.macro_zone),
  i.note,
  'rework',
  'incidences',
  i.id::text,
  jsonb_build_object(
    'typeOfIncidence', i.type_of_incidence,
    'priorityLevel', i.priority_level,
    'impactLevel', i.impact_level
  )
from public.incidences i
cross join lateral (
  select jsonb_array_elements_text(
    case
      when jsonb_typeof(i.photos) = 'array' then i.photos
      else '[]'::jsonb
    end
  ) as image_url
) photo
where not exists (
  select 1
  from public.captures c
  where c.source_table = 'incidences'
    and c.source_id = i.id::text
    and c.image_url = photo.image_url
);

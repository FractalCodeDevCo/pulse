# Agent Capture Model

Pulse already captures operational evidence well. What the agents need is a flatter contract that keeps one row per image and still preserves the original metadata.

## Recommended contract

Use `public.captures` as the write table and `public.agent_capture_facts` as the read model for agents.

Each row represents one image captured in the field and should answer:

- Which project?
- Which zone?
- Which flow or phase?
- What happened in that flow?
- What measurable values came with that image?

## Core fields

- `project_id`
- `captured_at`
- `capture_date`
- `capture_id`
- `image_url`
- `phase`
- `module`
- `project_zone_id`
- `capture_session_id`
- `capture_status`
- `zone`
- `macro_zone`
- `micro_zone`
- `field_type`
- `flow_step_key`
- `condition_label`
- `feet_installed`
- `glue_buckets`
- `total_rolls_used`
- `total_seams`
- `roll_length_fit`
- `compaction_method`
- `compaction_surface_firm`
- `compaction_moisture_ok`
- `compaction_double`
- `crew`
- `notes`
- `raw_metadata`

## Why this model helps

- It keeps Pulse flexible for operations.
- It gives agents a simple Excel-like table per project.
- It allows comparison across projects because the columns stay stable.
- It preserves full metadata for future models and audits.

## Query pattern

For a single project:

```sql
select *
from public.agent_capture_facts
where project_id = 'test'
order by captured_at asc;
```

For project-to-project comparison:

```sql
select
  project_id,
  macro_zone,
  micro_zone,
  phase,
  sum(coalesce(feet_installed, 0)) as total_feet,
  sum(coalesce(glue_buckets, 0)) as total_glue_buckets,
  sum(coalesce(total_rolls_used, 0)) as total_rolls,
  sum(coalesce(total_seams, 0)) as total_seams,
  count(*) as image_events
from public.agent_capture_facts
group by project_id, macro_zone, micro_zone, phase
order by project_id, macro_zone, micro_zone, phase;
```

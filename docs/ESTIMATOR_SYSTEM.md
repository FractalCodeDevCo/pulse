# FractalBuild Estimator System

## Core idea

You are not building a generic construction app.

You are building an estimator-focused operating system for sports field projects:

- Pulse captures field evidence.
- Supabase stores the operational record.
- `captures` keeps one unified write model.
- `agent_capture_facts` gives agents a simple read table.
- Estimator agents convert metadata into spend, productivity, and margin signals.

## Working model

One image equals one field event.

Each event should be traceable to:

- project
- zone
- workflow phase
- image
- timestamp
- operational metadata

## Flat table goal

Agents should be able to read one simple project table with:

- `project_id`
- `capture_id`
- `capture_date`
- `zone`
- `macro_zone`
- `micro_zone`
- `phase`
- `module`
- `feet_installed`
- `rolls_used`
- `glue_buckets`
- `seams`
- `material_units_used`
- `material_units_expected`
- `material_type`
- `material_pass_type`
- `valve_setting`
- `image_url`

## Active estimator agents

- `DataIngestAgent`
  - loads normalized project evidence
- `MetricsAgent`
  - aggregates project, phase, and zone totals
- `ZoneMetricsAgent`
  - builds zone scorecards
- `CostAgent`
  - estimates spend by zone and project
- `ProductivityAgent`
  - computes efficiency ratios from field output
- `ProcessInsightAgent`
  - raises alerts for waste, overuse, and process drift
- `EstimatorAgent`
  - orchestrates the estimator snapshot

## What matters most

The system should answer these questions fast:

- How much did this zone consume?
- How much did this project likely cost?
- Where are we overusing glue, rolls, or material?
- Which zone is drifting away from plan?
- What is our cost per installed foot?
- Where can we save money on the next project?

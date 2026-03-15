# Pulse Audit - 2026-03-15

## Current direction

The product is now centered on:

- Projects
- Base setup
- Zones
- Unified captures
- Project overview
- Estimator agents

## What was cleaned

- Removed roll verification routes and APIs
- Removed dead redirect capture pages
- Removed unused capture hub component
- Reduced backup and backfill logic to active workflows
- Kept debug-style operational feedback in the UI

## What remains intentionally

- `roll-installation`
- `pegada`
- `material`
- `incidences`
- unified `flow` capture sessions

These still exist because they either power live capture or preserve operational compatibility while writing into unified captures.

## Remaining technical debt

- Core Pulse screens are still partially mixed-language
- Some older APIs like `rollos`, `compactacion`, and `records` still exist as compatibility layers
- Cost assumptions are currently agent-side defaults and should later move to project-level settings

## Recommended next moves

1. Finish the English pass on the operational UI
2. Add project-level estimator settings in Supabase
3. Expose estimator agent outputs in the project overview
4. Add CSV export for project cost and zone cost summaries

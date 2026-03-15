# Plan Intelligence MVP Skeleton

## Goal
Create a stable contract for future AI processing of uploaded plan PDFs, without blocking current capture flow.

## Implemented now
- `POST /api/plan-intelligence/analyze`
- `lib/planIntelligence/types.ts` shared contract
- `lib/planIntelligence/scaffold.ts` filename-based scaffold inference
- `lib/planIntelligence/client.ts` client helper

## Input contract
```json
{
  "projectId": "PROJECT_CODE",
  "files": [
    { "name": "Baseball_Outfield_RollLayout.pdf", "url": "https://..." }
  ]
}
```

## Output contract
```json
{
  "analysis": {
    "projectId": "PROJECT_CODE",
    "status": "scaffold",
    "version": "v0",
    "createdAt": "ISO_DATE",
    "pages": [
      {
        "id": "page_1",
        "sourceFile": "Baseball_Outfield_RollLayout.pdf",
        "pageIndex": 1,
        "kind": "roll_layout",
        "confidence": 0.72,
        "signals": ["roll/layout keyword"]
      }
    ],
    "rollZoneMap": [
      { "zoneKey": "outfield", "labels": ["A", "B"] }
    ],
    "notes": [],
    "nextActions": []
  }
}
```

## Future phases
1. OCR and per-page PDF parsing.
2. Detect "roll layout page" vs "dimension page" from content.
3. Build persistent `rollZoneMap` per project.
4. Connect `rollZoneMap` to `Roll Placement` suggestions by selected zone.
5. Add interactive plan canvas with multi-roll selection -> open capture questionnaire.

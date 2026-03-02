# Turf Plan PDF Parser (v0)

## Goal
Extract roll layout data from installation PDFs:
- roll list by zone
- roll id and length
- approximate bbox
- adjacency graph
- next-roll suggestions by spatial order

## Scripts
- Parser module: `scripts/turf_plan_parser.mjs`
- Test runner: `scripts/test_turf_plan_parser.mjs`

## Run
```bash
npm run plan:parse:test
```

Or provide custom paths:
```bash
node scripts/test_turf_plan_parser.mjs "/path/to/plan.pdf" "/path/to/output.json"
```

## Output shape
```json
{
  "rolls": [
    {
      "instance_id": "roll_1",
      "id": "A",
      "length": { "raw": "47'-9\"", "feet": 47.75 },
      "bbox": { "page": 4, "x0": 100, "y0": 200, "x1": 240, "y1": 230 },
      "zone": "infield",
      "flags": ["split_roll"]
    }
  ],
  "pile_direction": null,
  "orientation": "left_to_right",
  "adjacency": [
    {
      "instance_id": "roll_1",
      "id": "A",
      "neighbors": [{ "instance_id": "roll_2", "id": "B", "distance": 15.3 }]
    }
  ]
}
```

## OCR fallback
- Direct extraction uses `pdfjs` text+coordinates first.
- OCR fallback runs only if text is too low and both binaries are available:
  - `pdftoppm`
  - `tesseract` (hOCR mode)
- If unavailable, parser returns a note in `notes`.

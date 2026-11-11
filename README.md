# TCG standings site

Weekly locals standings and per-player stats, built from the results Google Sheet.

## Data

The sheet's `Weekly_Input` tab is published to the web as CSV (the sheet itself stays private).
Each row is one player's final record at one event, entered in finishing order:

| Week | Player | P | W | L | D | OWP | OOWP |
|------|--------|---|---|---|---|-----|------|

- **Rank** is the row's position within its week (the sheet order is the official standings).
- **Win rate** = W / (W + L + D); **tie rate** = D / (W + L + D).
- **Points** = 3 × W + D.
- Name variants are merged via [`data/aliases.json`](data/aliases.json) (`"variant": "canonical"`).

`src/data` parses and validates the CSV and computes stats. It's lenient: obvious typos
(`72,22`, `44..44`) are fixed, and anything odd is reported so it can be corrected in the sheet.

## Commands

```sh
npm test                                   # unit + real-data tests
npm run typecheck
npm run data:check                         # validate the live published sheet
npm run data:check -- path/to/export.csv   # validate a local export
```

`SHEET_CSV_URL` / `SHEET_CSV_FILE` override the data source.

# Data Analyzer

Data Analyzer is a local-first desktop and web app for exploring Excel and CSV files. It can profile fields, identify common data quality issues, clean rows, create charts and dashboards, and export results. Files are parsed in the app; importing a workbook does not upload it to a server.

## Current capabilities

- Read `.xlsx`, `.xls`, and `.csv` files, choose a worksheet, and set the header row.
- Inspect rows and column profiles, then correct detected field types.
- Remove duplicate or empty rows and columns, trim text, and undo or redo edits.
- Create calculated fields, charts, dashboards, and simple time-series forecasts.
- Review automated statistical insights and ask natural-language questions about the loaded data.
- Save and reopen `.dvis` project files; export data and chart images.

Automated insights and query suggestions are heuristic assistance. Check the displayed fields, filters, and calculations before using a result for a business decision. Forecasts are estimates based on the selected date and measure fields.

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm start
```

Open `http://localhost:4200/` in a browser.

## Build and desktop app

```bash
npm run build:prod
npm run electron:dev
```

To package the desktop app for Windows, run `npm run electron:build:win`.

## Checks

```bash
npm test -- --watch=false
npm run build:prod
```

The unit tests use Angular's Vitest-based test runner. No end-to-end test runner is currently configured.

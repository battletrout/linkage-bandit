<h1><img src="logo.png" alt="Linkage Bandit logo" width="56" align="absmiddle"> Linkage Bandit</h1>

[![Deploy Linkage Bandit to GitHub Pages](https://github.com/battletrout/linkage-bandit/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/battletrout/linkage-bandit/actions/workflows/deploy-pages.yml)

Linkage Bandit is a browser-based workspace for comparing two datasets, visualizing and editing simple relationships, and safely recording changes. It runs entirely in your browser: source files remain local, and your work is stored in portable sidecar files. 

I created Linkage Bandit wanted a fast tool to visualize traceability between software test cases and the requirements they satisfy on exports between two systems to guide test case development. As I add new records to the test cases dataset, I use API calls to push the new cases captured in the "changes" file to our test case management system, and requirement IDs as references in the test cases. I couldn't find something simple or open-source enough out the box, so here we are. 

## Getting started

1. Open `index.html` in a modern browser, or use the GitHub Pages site at https://battletrout.github.io/linkage-bandit/.
2. Load a CSV or Linkage Bandit JSON file into **Data A** and **Data B**.
3. For CSV imports, choose Auto-detect or specify the delimiter.
4. Open **Workspace settings**, then select the fields that identify relationships between the datasets.
5. Save your changes and configuration as sidecar files when you are ready to keep your work.

Linkage Bandit never overwrites a source CSV. Record edits, added records, deletion markers, and manual links live in a `.changes` file; workspace preferences live in a `.config` file.

## What it can do

- **Visualize relationships.** Matching fields create black pre-existing linkages. Create blue manual linkages for exceptions, corrections, or newly established relationships.
- **Focus on what matters.** Hover a record to emphasize its visible connections and fade unrelated records. Group and anchor linked records to make one-to-many structures easier to read.
- **Maintain a safe change layer.** Edit visible fields, add records, or mark source records for deletion without touching the original file. Edits are blue, new records are light blue, and deletion markers are gray with a red border.
- **Export a reconciled dataset.** Export Data A or Data B as CSV or structured JSON. An integrated export applies changes and writes linked values into the selected linkage field. One-to-many links are represented as Python-style lists.
- **Recover from source drift.** Undo and redo recent changes, receive unsaved-work warnings, and use ghost records plus the unresolved-changes panel to resolve sidecar entries that no longer match a source dataset.
- **Reuse a workspace.** Save a configuration containing visible fields, filters, sorting, linkage layout, delimiter choices, hotkeys, and expected filenames.
- **Import flexible CSV files.** Auto-detect comma, semicolon, tab, and pipe delimiters, or enter a custom one-character delimiter.

## Feature tour

### See and edit relationships quickly

Black connectors show relationships inferred from matching fields. Blue connectors represent new linkages in the change layer. Use the configured hotkeys to create, inspect, or delete relationships.

![Two datasets with visible black and blue relationship connectors](<documentation/quickly%20visualize%20and%20edit%20linkages.png>)

### Edit source records without changing the source file

Field edits are recorded separately and shown in blue while changes are visible. The original source data stays untouched until you deliberately create an integrated export.

![Existing record edits highlighted in blue](<documentation/Edit%20existing%20records,%20changes%20highlighted.png>)

### Add records and connect them immediately

Add a light-blue record directly in either dataset. The linked-record action creates a record on the opposite side and automatically connects it to the selected record.

![Adding a new record to Data B](<documentation/add%20new%20record%20to%20data%20B.png>)

### Export integrated CSV or structured JSON

Integrated export applies edits, additions, deletion markers, and relationship values to a new file. Before exporting, Linkage Bandit shows the selected linkage fields for confirmation.

![Export controls for a CSV or JSON with integrated changes](<documentation/export%20versions%20of%20new%20csv%20or%20json%20files%20with%20changes%20integrated.png>)

### Resolve orphaned edits and links

If a source file changes and a sidecar refers to a missing row, Linkage Bandit displays a red ghost record and dashed red connector. The Changes panel lets you inspect or dismiss each unresolved entry.

![Orphaned linkage detection with ghost records](<documentation/orphaned%20link%20detection.png>)

## Files Linkage Bandit creates

### Changes sidecar

`left-file--right-file.changes` stores manual links, field edits, added records, and deletion markers.

### Configuration sidecar

`left-file--right-file.config` stores display choices, filters, sorting, linkage settings, hotkeys, delimiters, and expected source filenames.

### Structured JSON export

JSON exports use ordered headers and record dictionaries:

```json
{
  "format": "csv-json-lossless-v1",
  "sourceFileName": "requirements.csv",
  "delimiter": ",",
  "headers": ["Requirement ID", "Shall Statement"],
  "data": [
    {
      "Requirement ID": "X-SW-REQ-001",
      "Shall Statement": "The system shall authenticate users."
    }
  ]
}
```

Small, non-sensitive sample files are available in [`examples/`](examples/).

## Browser behavior and limitations

Browsers do not allow webpages to reopen arbitrary local files without your involvement. A configuration can remember expected filenames and report a non-blocking warning, but you must select the files in each browser session.

Use **Save changes** and **Save config** to download the current sidecars. Linkage Bandit warns before leaving a page with unsaved work. For detailed error explanations and operating guidance, use the in-app **Help** dialog.

## Development and deployment

No dependencies or build step are required. The included GitHub Actions workflow deploys the repository root to GitHub Pages. In the repository's Pages settings, choose **GitHub Actions** as the deployment source.

## License

MIT. See [LICENSE](LICENSE).

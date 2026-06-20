# Relationship Linkage Web App

A browser-only workspace for comparing two CSV datasets, visualizing relationships, and recording non-destructive changes.

## Use it

Open `index.html` in a modern browser, or use the GitHub Pages deployment. Load a CSV or lossless JSON file into each panel, then open **Workspace settings** to select matching fields, load/save sidecars, and configure the workspace.

The app never modifies the source CSV files. Manual links, record edits, and added records are saved in a `.changes` sidecar. UI preferences are saved in a `.config` sidecar.

## Sidecar files

- `.changes` stores manual linkages, field edits, and added records.
- `.config` stores display fields, filters, sorting, linkage options, hotkeys, and expected filenames.

The default names are `left-file--right-file.changes` and `left-file--right-file.config`.

Small, non-sensitive sample files are available in [`examples/`](examples/).

## Important browser behavior

Browsers do not allow a webpage to silently reopen arbitrary local files. A configuration remembers expected filenames and reports a non-blocking warning if a selected file does not match.

Use **Save changes** and **Save config** to download the current sidecars. The workspace warns before leaving with unsaved changes.

## Development and deployment

No dependencies or build step are required. GitHub Pages publishes the repository root through the included workflow.

Before enabling Pages, choose **GitHub Actions** as the deployment source under the repository’s Pages settings.

## License

MIT. See [LICENSE](LICENSE).

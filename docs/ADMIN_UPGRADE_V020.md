# Backroom Admin v0.20 — reporting and editing

This upgrade retains the static GitHub Pages architecture and the existing `listings.json` and `events.json` schema. It adds `admin-upgrade.js` and `admin-reporting.js` to the existing admin modules.

## Using the admin

- **Venues** shows all listings except records whose `Category` is exactly `Cruising Area`; **Cruising Areas** shows those records. Both views edit and save the **same complete** `listings.json`.
- **Events** continues to use `events.json`.
- **Archived Functions** contains the original pending/old review controls, page editor, standalone import preview, CSV Save As, JSON Save As, and venue ID audit. The existing **Merge JSON preview stays in the toolbar**.
- **View / Edit Record** opens a small selected-record preview (with related records only). The Edit button saves into the working admin draft, not GitHub. Save the corresponding JSON from Admin to publish changes through your usual GitHub workflow.
- **Merge JSON** treats missing and blank incoming values as *no change*. `__CLEAR__` explicitly clears a field. `Last_Updated` is assigned to new or content-changed records only.

## Reporting

The **Reporting & Statistics** navigation contains dataset totals, country totals, monthly coverage (stored records and projected weekly occurrences), database-growth history, completeness overview, an advanced condition builder, and completeness-check history.

The builder starts with `OR / Status is Live`. Events are exclusive of the Venues/Cruising Areas checkboxes. Venues and Cruising Areas can be selected together. Add conditions using `AND`, `OR`, or `EXCLUDE`, review the generated left-to-right parenthesised query, and press **Execute Query**. Only an execution performs a search and creates a history measurement.

The results contain unique matching records. **Download JSON of Identified Records** exports the full matching objects. **Split into Groups** dynamically distributes records into named `Group A.json`, `Group B.json`, etc. In supported browsers, it asks for a folder once and writes separate JSON files without a ZIP.

Reporting history is stored in browser IndexedDB and includes only dates, operations, queries, counts, and export metadata — never lists of matched record IDs or copies of matching records. **Save Report** exports a portable JSON backup, and **Restore Report** reloads one. When unsaved history becomes older than seven days, a reminder appears on opening Reporting.

## Browser and storage notes

The intended browser is desktop Chrome/Chromium. Choosing a destination folder and saving repeatedly to an existing report file use the browser File System Access API, which can request permission again after a restart. Other browsers receive a multiple-download fallback for research groups and a standard downloaded history JSON.

Local Reporting history is browser/profile-specific until backed up. GitHub database changes remain separate: the admin still only edits locally until you save and commit the JSON through GitHub.

## Validation and manual acceptance checklist

Automated syntax compilation was checked for all changed JavaScript scripts and the inline record-preview script. In-memory smoke checks covered reporting totals, condition predicates and generated queries, preview-to-draft editing, and splitting eight event records into three files (3, 3, 2; all eight unique IDs preserved). These are **not** substitutes for a real-browser acceptance test.

In desktop Chrome, verify:

1. Existing Load / Clear, Merge JSON preview, Remove JSON, Remove Old and Save JSON workflows.
2. Switch Venues → Cruising Areas → Events; confirm the first two share the same entire listings draft on Save.
3. Select a row → View / Edit Record, edit one field, save, and confirm `Last_Updated` changes in the working draft.
4. Search and sort for a record beyond the initial 250 rows.
5. In Reporting, select Events → Missing Start Time; execute and download results.
6. Add `AND Status is Live` and `EXCLUDE City is Berlin`; compare individual and combined counts.
7. Split non-empty results into three groups; check filenames and contents.
8. Save the Reporting history and restore it from the downloaded backup.
9. Check the country and monthly coverage figures, and ensure archived functions remain accessible.

## Scope boundaries

No automatic URL checking, server-side account, duplicate undo/snapshot system, or research-record IDs stored in Reporting. Existing legacy date strings can be read; new and edited `Last_Updated` values use ISO 8601 timestamps.

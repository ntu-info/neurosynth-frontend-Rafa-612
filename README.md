

# Neurosynth Frontend — Quick Navigation Guide

This README explains how to navigate and use the Neurosynth frontend web app. It describes the UI panels, common workflows, and helpful tips for finding, saving, and exporting study results.

Principles
- Lightweight single-page UI with several functional panels.
- Interactions are immediate: clicking terms appends them to the query and triggers searches.
- Saved studies persist in your browser (localStorage).

Panels (what they are and how to use them)

1) Panel A — Terms
- Purpose: browse and filter available search terms.
- Controls:
  - Search box: type to filter terms (prefix matching). Press Enter to apply immediately.
  - "Run" button: refresh the full term list from the server.
  - Infinite scroll: the list loads in chunks; scroll near the bottom to load more.
- Interaction: click any term to append it to the Query box (Panel B) and trigger a new search + update related terms.

2) Panel B — Query
- Purpose: compose and edit search queries (space-separated terms supported).
- Controls:
  - Typing triggers a debounced search (see Panel C) and updates related terms.
  - Press Enter to run an immediate search.
  - Clicking terms from Panel A or related-term chips appends them to the query (preserves spacing).

3) Panel C — Studies (search results)
- Purpose: show the list of studies matching the query.
- Behavior:
  - Shows a loading indicator while searching.
  - Displays a result count badge in the panel header when results are available.
  - Each result shows title, authors, journal, year and a "Save" button.
- Save: click "Save" to store a study in the Saved panel (Panel D). Saved items are kept in localStorage.

4) Panel REL — Related Terms (chips)
- Purpose: show terms that co-occur with the current query.
- Behavior:
  - Chips show "term count" and optionally Jaccard info in a tooltip.
  - Click a chip to append that term to the query and immediately re-run the search and refresh related terms.

5) Panel D — Saved
- Purpose: persistent (browser) storage of saved studies.
- Controls:
  - Delete button per saved item removes it from storage.
  - Clear button wipes all saved items (confirmation required).
  - Export button writes a plain-text file of saved studies; you are prompted for the filename.
- Data: saved items are serialized under the key `neurosynth_saved_studies_v1` in localStorage.

Common Workflows (quick examples)
- Quick search
  1. Open Panel A and click a term (or type in Panel B).
  2. Press Enter or wait for the debounced search to finish.
  3. Browse Panel C for results.

- Build a complex query
  1. Click multiple terms in Panel A or related-term chips; they append to Panel B.
  2. Edit the query text directly if needed.
  3. Press Enter to run.

- Save and export studies
  1. In Panel C click "Save" on items of interest; they appear in Panel D.
  2. Open Panel D, then export or delete items as needed.

Troubleshooting and tips
- If terms or results fail to load, check the browser console for network errors.
- Use the "Run" button in Panel A to refresh the server-side term list.
- Saved data is stored locally—clearing browser storage will remove saved items.
- Search endpoints may return different shapes; the UI normalizes study objects for display.

Developer notes (brief)
- API base URL is set in app.js (constant `API_BASE`).
- The UI performs client-side filtering of the terms list and paginates rendering for performance.

License & contact
- This README is a navigation guide only. For questions about the backend or data, contact the project owner or check server logs.

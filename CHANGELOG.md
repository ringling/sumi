# Changelog

Sumi has no release process: the version number in the help panel (⌘/) and
in the `generator` meta of exported pages moves with this file. Dates are the
commit dates.

## 0.5.0 — 2026-09-26

- The Documents and History drawers stay open or closed across reloads.
- Share a document as a link: File ▸ Copy share link packs the document,
  compressed, into the URL fragment; opening it in Sumi creates the document
  or reopens an identical one. Nothing goes through a server.
- Version number shown in the help panel and written into exports and backups.

## 0.4.0 — 2026-09-17

- Tables tidy themselves when the caret leaves them (Page ▸ Tidy tables to
  switch off).
- Rename documents: File ▸ Rename, or double-click a row in the Documents
  drawer.
- README.

## 0.3.0 — 2026-09-12

- Slash commands: `/` on an empty line inserts any block from a popup.
- Copy as rich text: the selection or document as HTML on the clipboard, for
  Word, Outlook and mail.
- Section folding from the chevron beside a heading, ⌘⇧. or Edit ▸ Fold.
- Demo document extended to the new features.

## 0.2.0 — 2026-09-10

- Find and replace (⌘F, ⌘G, ⌘⇧G) painted with the CSS highlight API, searching
  the source so folded tables and code are included.
- Auto-pairing of brackets, quotes and emphasis markers, with wrap on selection.
- Table commands: tidy, add and delete rows and columns, Tab between cells.
- Emoji shortcodes with a completion popup.
- `demo.md` with every supported construct and a harness that round-trips it.
- Heading numbers rendered after the marker instead of before it.
- Fixed: footnote definitions grew a space on every edit; images with a title
  were not shown in the editor; the caret slid under the text for 120 ms
  after each keystroke; an empty first page when front matter preceded the
  title with page breaks on.

## 0.1.0 — 2026-09-09

- Page margins visible on screen; Width labelled; Typora-like compact print.
- Seven themes with a menu, custom CSS themes, persisted settings; the export
  follows the theme.
- Syntax highlighting of fenced code with highlight.js.
- Code line numbers, heading numbers with a lone title unnumbered, equation
  numbers, YAML front matter, footnote hover, list cycling.
- Table of contents with internal links and numbering; outline hints for a
  second h1 or a skipped level.
- Source code mode; toolbar regrouped into View, Theme, Page and File menus.
- Multiple documents in IndexedDB with a Documents drawer; version history
  with thinning, diff, restore, backup and import; two-tab conflict guard.
- GitHub alerts applied to the whole block, marker only on the first line.
- Initial import of the single-file editor.

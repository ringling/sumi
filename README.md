# Sumi

A single-file live markdown editor in the spirit of Typora. One HTML file, no
build step, no dependencies to install. Open `sumi.html` in a browser and
write.

The document is always raw markdown. Sumi renders it line by line and folds
the syntax away until your caret lands on a line, so `**bold**` keeps its
asterisks and shows them only while you edit that line. Tables, maths,
diagrams, front matter and the table of contents fold to a rendered block and
reopen as source when you click into them. Export is the text you typed.

## Running it

Open the file directly, or serve the folder and open it from there:

```bash
python3 -m http.server 8765
open http://localhost:8765/sumi.html
```

Serving it is the better choice at work: standalone HTML files that save
files from script can trip endpoint-protection heuristics, served pages do
not. Maths (KaTeX), diagrams (Mermaid) and code highlighting (highlight.js)
load from a CDN when available and degrade to plain source when not.

`demo.md` shows every supported construct; drop it on the window.
`FEATURES.md` describes each feature and how to reach it.

## Writing

- GitHub Flavored Markdown: headings (ATX and setext), emphasis, strikethrough,
  highlight, inline code, links, reference links, autolinks, images,
  footnotes with hover previews, task lists, tables, fenced and indented code,
  the five GitHub alerts, horizontal rules, escapes, hard breaks.
- Maths inline and in `$$` blocks, Mermaid diagrams, syntax-highlighted code
  fences, emoji shortcodes with a completion popup, YAML front matter, `[TOC]`
  with internal links.
- Slash commands: `/` on an empty line inserts any block from a popup.
- Auto-pairing of brackets, quotes and emphasis markers; a selection is
  wrapped when you type the marker.
- Tables: Tab and Shift-Tab move between cells, Tab past the last cell adds a
  row, the source is tidied when you leave the table, and Edit ▸ adds and
  deletes rows and columns.
- Section folding from the chevron beside a heading, find and replace that
  searches the source, list cycling, heading numbering, equation numbering,
  code line numbers, copy as rich text for Word and mail, and an outline
  drawer that flags a second h1 or a skipped level.

## Documents

Every document lives in the browser's IndexedDB. File ▸ Documents lists them
by last edit; click to switch, double-click to rename, × twice to delete.
Versions are kept automatically after a pause, when you leave a document and
on save; File ▸ History shows them with diff and restore. Both drawers stay
open or closed across reloads. File ▸ Backup downloads everything as one
JSON file that imports into any browser. Save writes to a real file through
the File System Access API where the browser supports it, and downloads
otherwise.

## Sharing

File ▸ Copy share link puts the whole document into a link, compressed, in
the URL fragment. Whoever opens the link in Sumi gets the document as their
own copy. Fragments are never sent to a server, so the content travels only
between the two browsers. It is a snapshot, so a new link is needed after
edits, and mail and chat apps tend to cut links past about 8 KB, which is
roughly five pages of text; Sumi warns in the toast when a link is that long.

## Looks

Seven themes under Theme: Paper, Ink, GitHub, Whitey, Newsprint, Sepia and
Night. Cmd-Shift-D flips between a theme's light and dark counterpart. A
custom theme is a CSS file dropped on the window; `themes/sample.css` documents every token. Width, typeface, margins, page
breaks and the numbering options are under View and Page, and every setting
is remembered. Print and PDF use a compact page regardless of theme.

## Shortcuts

Press `⌘/` in the editor for the full list. The ones worth learning:

| Keys | Action |
|---|---|
| ⌘B ⌘I ⌘K ⌘⇧K | bold, italic, link, inline code |
| ⌘1 – ⌘6, ⌘0 | heading level, plain paragraph |
| ⌘⇧L | cycle list type |
| ⌘F, ⌘G, ⌘⇧G | find and replace, next, previous |
| ⌘⇧. | fold or unfold the section |
| ⌘⇧| , ⌘⏎ | tidy table, add table row |
| ⌘⇧F, ⌘⇧T, ⌘\ | focus mode, typewriter mode, outline |
| ⌘⇧U, ⌘⇧R | source code view, reveal syntax |
| ⌘S, ⌘O, ⌘⇧E, ⌘P | save, open, export HTML, print |

## Project layout

| Path | Purpose |
|---|---|
| `sumi.html` | the editor, everything in one file |
| `demo.md` | every supported construct in one document |
| `FEATURES.md` | one entry per feature: what it does, how you reach it, what to expect |
| `themes/sample.css` | starting point for a custom theme |
| `test/` | browser harnesses driven by headless Chrome over the DevTools protocol |
| `CLAUDE.md` | working notes on the internals, invariants and conventions |
| `CHANGELOG.md` | what changed in each version; the number is shown under ⌘/ and written into exports |

## Tests

The harnesses need Chrome at its default macOS path and a local server:

```bash
python3 -m http.server 8765 &
for h in test/*.html; do node test/cdp.mjs "http://localhost:8765/$h"; done
```

Each harness prints PASS and FAIL lines. `test/pdf.mjs` prints a sample
document and reports the page count; `test/probe.mjs` evaluates an expression
under emulated print media.

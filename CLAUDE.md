# Sumi — working notes

Single-file live markdown editor, Typora-style. One HTML file, no build step,
no package manager. Open `sumi.html` in a browser and it runs.

Everything below is here because it is not obvious from the code, or because
getting it wrong breaks the editor in ways that look like unrelated bugs.

## The central idea

The document is **always raw markdown**. It is never converted to rendered HTML
and back. Rendering means: split the source into lines, one `<div class="line">`
per source line, and wrap each syntax marker in `<span class="tok">`. CSS then
collapses `.tok` to `font-size: 0` unless the line carries `.active`.

So `**bold**` still contains its asterisks at all times — they just occupy no
width until your caret lands on that line. Consequences worth keeping:

- Caret movement, selection, spellcheck and IME composition are native.
- Export is `getText()`. There is no rendered-to-source mapping to maintain.
- Revealing syntax on the active line is a **class toggle**, not a re-render.

## Invariants — break these and the caret breaks

**1. Anything in the DOM that is not part of the source must carry `data-x`.**

KaTeX output, Mermaid SVG, rendered tables, footnote superscripts and alert
labels all contain text nodes that are not in the document. Three functions walk
the DOM counting characters — `unitText`, `offsetOf`, `locate` — and all three
skip `data-x` subtrees. Add a rendered element without `data-x` and every caret
position after it silently shifts. Elements with no text at all (`<img>`, the
`<hr>` rule span) are safe either way, but mark them anyway.

**2. Caret position is a character offset, restored after every render.**

`sync()` is: read text from DOM → read offset → re-render changed lines → put the
offset back. Any code path that mutates the document must go through `setText()`
or `sync()`, never through direct DOM manipulation.

**3. Undo is custom (`hist` / `hi` in the state section).**

Re-rendering lines destroys the browser's native undo stack, so `beforeinput`
intercepts `historyUndo` / `historyRedo`. If you add an editing command, it must
land in the history via `setText()`.

**4. `render()` only rewrites lines whose key changed.**

The key is `JSON.stringify(flags[i]) + '\0' + lineText`. Rewriting a line resets
its `className`, which drops `.active`, `.fold` and `.near` — `updateActive()`
re-adds them and must be called after any render. This already caused one bug
(syntax flickering away while typing on the active line).

**5. Block previews use the fold mechanism, not a different one.**

Tables, ```` ```mermaid ```` blocks, `$$…$$` blocks, a YAML front matter block
at the top and a `[TOC]` line are runs of lines sharing
a `blk` id assigned in `scan()`. The last line of a run gets `f.last` and holds a
`<span class="prev" data-x>`. When the caret is outside the run, every line in it
gets `.fold`, which hides `.src` and collapses the line to zero height, leaving
only the preview. Caret inside → unfolds, source and preview both show.

Add a new block type by giving it a `blk`, a `kind`, and a branch in
`renderPreviews()`. Do not invent a second mechanism.

## File map (line numbers drift — the `── section ──` comments are the anchors)

| Region | What lives there |
|---|---|
| `demo.md` | every supported construct in one document; `test/demo.html` loads it and checks each renders and exports |
| `<style>` tokens | CSS custom properties; the default (Paper) values |
| `<style>` themes | one `html[data-theme="…"]` block per built-in theme |
| `<style>` writing surface | `.line`, `.tok` folding, block/preview/fold rules |
| `@media print` | page breaks, margins, hiding block source |
| GFM inline | `inline(s, clean)` — one tokenizer, two output modes |
| tables | `splitRow`, `tableHtml`, run detection |
| line classification | `classify()` — single line → type + css class |
| document scan | `scan()` — stateful pass: fences, math, tables, setext, refs, heading slugs |
| line rendering | `renderLine` / `coreLine` |
| syntax highlighting | `hlLang`, `hlRun`, `hlBlock`, `hlSplit`, `HL_CSS` |
| chrome behaviour | `toggle`, the shared `openMenu` popup, the View / Theme / Page / File menus |
| math & diagrams | KaTeX, Mermaid, `renderPreviews` |
| DOM <-> text | the three walkers. Treat as load-bearing |
| render / state | reconciliation, history, `setText`, `sync` |
| editing commands | Enter, Tab, wrap, headings |
| export | `mdToHtml` (GFM, separate from the editor renderer) |

`inline()` is shared between editor and export via the `clean` flag — `clean=true`
drops the syntax and emits real `<img>`/`<a>`/KaTeX. Block-level rendering is
**not** shared: the editor renders line by line, the export renders blocks. When
you add syntax, both usually need touching, and they can drift. That drift is the
most likely source of "looks right in the editor, wrong in the export".

## Syntax highlighting

highlight.js loads lazily like KaTeX and must fail soft. `scan()` highlights a
fenced block as one unit at the closing fence (so block comments and strings
carry across lines) and `hlSplit()` cuts the result into per-line HTML,
closing open spans at each newline and reopening them on the next line. The
per-line HTML goes into `f.hl`, which is inside the render key, so only lines
whose colouring changed are rewritten. Each line's HTML contains exactly the
source text, only wrapped in spans, which is why invariant 1 holds without
`data-x`. Colours are the `--hl-*` tokens; `HL_CSS` maps the hljs classes onto
them and is injected into both the editor and the export. Mermaid fences and
indented code are not highlighted.

## Alerts

`classify()` recognises `> [!NOTE]` (any case, the marker alone on the line)
and sets `f.alert`; `scan()` then applies GitHub's rules: the marker counts
only on the first line of a blockquote (later ones are literal text), and
the kind is carried to every following `>` line of the same block as
`f.akind` plus the `alert a-<kind>` classes, so border colour and upright
text cover the whole block. The label is a `data-x` span. The export applies
the same first-line rule on the collected block.

## Headings, slugs, TOC and internal links

`scan()` gives every heading a GitHub-style slug (`slugify`: lowercase, punctuation
dropped, spaces to dashes, duplicates suffixed `-1`, `-2`) and collects them in
`headings`. The export computes slugs again in the same order with the same
function, so `id` attributes agree with the editor. Headings inside blockquotes
get no id (the export recursion is not `top`).

A `[TOC]` line is a one-line block (`kind:'toc'`) whose preview is `tocHtml()`
over `headings`; the preview key is the headings list plus the from-h2 flag, so
it follows edits and the numbering toggles. Entries carry the heading number in
a `.tn` span shown only under `body.hnums`; `tocHtml()` counts exactly as the
CSS counters do, including `body.hfrom2`, so list and page always agree.
`render()` sets `body.hfrom2` whenever the document has exactly one h1: that
h1 is the title, unnumbered, and h2 is the top level (1., 2., 3.1). With zero
or several h1s numbering starts at h1. There is no manual switch. In the editor each entry carries
`data-line`, and a click on any `a[href^="#"]`
inside the editor is intercepted: TOC entries jump by line, text links by slug
lookup, both through `jumpToLine()` which the outline drawer uses too.

## Outline hints

`buildOutline()` marks a second h1 and any skipped level (h1 → h3) with
`.warn`, a faint dot and a title explaining why. Informational only; Sumi
never enforces heading structure. The convention it points at is one h1 as
the title, `##` for sections, no gaps.

## Documents

IndexedDB database `sumi`, store `docs` {id, name, text, created, updated,
handle?} indexed by `updated`, and store `versions` (see History). `idb` is a
five-call wrapper over one-transaction requests; `tx()` resolves with the
request's result when the transaction completes. `doc` is the open record,
`text` its live content, `handle` its File System Access handle if it was
saved to disk (handles survive in IndexedDB and need `requestPermission`
once per session, done in `saveMd`).

Flow: `store()` (debounced 900 ms from `afterChange`, and `flush()` on
hide/unload) writes the record and posts `{id, updated}` on a
BroadcastChannel. Before writing it re-reads the record: if another tab
updated it since this tab last read it, `doc.conflict` is set, autosave
pauses, and a toast says so; reopening the document clears it. A tab with no
local edits that hears the broadcast reloads the newer text silently.
`showDoc()` loads a record and resets undo history; `openDoc`, `createDoc`,
`deleteDoc` all `flush()` first. Opened or dropped files become documents
(`openFile`, which reopens an identical one instead of duplicating). The old
single draft key is migrated into the first document on startup and removed.
Without IndexedDB, `docsOK` is false and the editor keeps one draft in the
key/value layer as before.

The Documents drawer (`#docs`, File ▸ Documents, `body.docs`) shares the left
edge with the outline; opening one closes the other. Delete is two clicks on
the × within four seconds. Harnesses must `indexedDB.deleteDatabase('sumi')`
when starting fresh, otherwise the previous harness's documents load.

## History

Store `versions` {id (auto), docId, at, text, hash, label}, index `doc` on
[docId, at]. Full snapshots, never deltas. `snapshot(label)` is called 30 s
after the last edit (`snapTimer` in `afterChange`), from `flush()` whenever
the document is left or the page hidden, on Save (label "Saved"), from the
History drawer's name field, and by `restoreVersion` ("Before restore",
only when the current text is not already the latest version). Unlabelled
snapshots equal to the latest version are skipped by hash.

`thin()` runs after every snapshot: keep everything from the last hour, the
latest per hour for a day, per day for a month, per week beyond, and every
labelled version. Deleting a document deletes its versions.

The History drawer (`#hist`, File ▸ History, `body.hist`) sits on the right
and can be open together with a left drawer. A row marked ● equals the
current text; clicking a row reveals Restore, Diff, Delete. `lineDiff()` is
prefix/suffix trimming plus an LCS on the middle (falls back to remove-all /
add-all past 4M cells); `showDiff()` renders it in the `#diff` overlay with
long unchanged runs collapsed. Restore goes through `setText`, so undo works.

Backup (File ▸ Backup) downloads `{sumi:1, docs, versions}` as JSON without
file handles; import (File ▸ Import, or drop a .json) merges by document id
(newer `updated` wins) and by docId+at for versions, so importing twice adds
nothing.

## Source mode

`body.source` (Source button, ⌘⇧U) is pure CSS over the same DOM: every `.tok`
shown, every `.fold` unfolded, previews and other `data-x` output hidden,
monospace, headings at body size, no bullets or rules. Nothing re-renders, so
the caret stays where it was. The rules sit in `@media screen` so print keeps
the rendered page. ⌘⇧R (`html.reveal`) is the lighter mode: rendered, with
the syntax visible.

## Numbering and other class toggles

Code line numbers, heading numbers and equation numbers are body classes
(`linenos`, `hnums`, `eqnos`) driven purely by CSS counters and `::before`,
so they add nothing to the DOM and need no re-render. The equation label is a
real `<span class="eqno">` inside the `data-x` preview, numbered by `f.eq`
from `scan()`, and only shown by the class. Chrome does not resolve
`counter()` in `getComputedStyle`, so the harness checks the rule exists and
the screenshot checks the value. Export mirrors all three with the same
counters on `<pre class="linenos">` (one `<span class="ln">` per line, cut
with `hlSplit`), `body.hnums` and `body.eqnos`.

## Toolbar menus

The bar is five buttons: View, Theme, Page, File and help. Each menu button
calls `openMenu(btn, build)`; `build()` returns the items and runs on every
(re)render, so items read their state straight from `body` classes and the
`wi`/`fi`/`mgi` indices. There is no button state to keep in sync. Item kinds:
`check` (body-class toggle with a check mark), `cycle` (a value that advances
on click and keeps the menu open, via `keep`), radio (themes) and plain
actions. `data-n`, `data-v`, `data-t` and `data-act` attributes exist for the
harnesses, which drive everything through the menus (`mclick`, `mlabel`,
`mon`, `themeOn` helpers at the top of each harness).

Settings record (`sumi:settings`): theme, custom CSS, width, font, margin,
pages and the three numbering flags. Width and font store `-1` when a theme's
own value is in effect and are then left to the theme on restore.

## Themes

A theme is a block of token overrides on `html[data-theme="name"]`, registered
in `THEMES` in the script (label, dark flag, and which theme ⌘⇧D flips to).
Themes may set typography (`--body`, `--size`, `--lh`, `--measure`) as well as
colours. The Font and Width buttons override those with inline properties on
`<html>`; `setTheme()` clears the overrides and `syncTypography()` re-reads the
buttons' state from computed values, so a theme's own font shows as "Font"
and its own measure as "Width: theme" when they are not in the button lists.

User themes are plain `.css` files (see `themes/sample.css`) loaded from the
Theme menu or dropped on the window. They go into a `<style>` appended last,
so they beat everything. Theme name and custom CSS are the only persisted
settings (`sumi:settings`). Export reads the active tokens with
`getComputedStyle` and inlines them, so the exported page follows the theme.
Both print blocks reset the paper/ink tokens to black-on-white.

## Testing

No test suite for the editor core. `test/cdp.mjs` drives headless Chrome
over the DevTools protocol against a harness page served from the project:

```bash
python3 -m http.server 8765 &
node test/cdp.mjs http://localhost:8765/test/themes.html
node test/cdp.mjs http://localhost:8765/test/highlight.html
node test/cdp.mjs http://localhost:8765/test/small.html      # numbering, front matter, list cycling, settings
node test/cdp.mjs http://localhost:8765/test/toc.html        # [TOC], slugs, internal links, export ids
node test/cdp.mjs http://localhost:8765/test/source.html     # source mode
node test/cdp.mjs http://localhost:8765/test/docs.html       # documents: migration, drawer, switching, two tabs
node test/cdp.mjs http://localhost:8765/test/history.html    # versions, diff, restore, thinning, backup round trip
node test/cdp.mjs http://localhost:8765/test/alerts.html     # GitHub alerts, all five kinds, editor and export
node test/cdp.mjs http://localhost:8765/test/demo.html       # demo.md: every block and inline construct, round-trip, export
node test/probe.mjs "toggle('source')" print "<eval js>"     # one-off: load, run setup, emulate media, evaluate
node test/cdp.mjs 'http://localhost:8765/test/shot.html?code#paper,linenos,hnums,eqnos,source' shot.png   # screenshot: theme, toggles
node test/cdp.mjs 'http://localhost:8765/test/shot.html?menu=bFile#paper' shot.png                       # screenshot with a menu open
node test/cdp.mjs 'http://localhost:8765/test/shot.html#paper,docs,hist' shot.png                          # both drawers
node test/pdf.mjs http://localhost:8765/sumi.html out.pdf            # print a sample doc, reports page count
```

Each harness loads `sumi.html` in an iframe and reports PASS/FAIL lines. The
script is an IIFE, so tests go through the UI (clicks, key events, drop
events, `execCommand('insertText')` for typing), not through internal
functions. Each harness starts by clearing storage and blocking the unloading
frame's draft save, otherwise the previous harness's document leaks in. Needs Chrome at the default macOS path and network for the CDN
libraries. The loop that has been working for
the pure functions:

```bash
# 1. parse check
python3 -c "import re;s=open('sumi.html').read();\
open('check.js','w').write(re.search(r'<script>\n(.*)\n</script>',s,re.S).group(1))"
node --check check.js

# 2. unit-test the pure functions by slicing them out of check.js
#    (inline, classify, scan, renderLine, tableHtml, mdToHtml have no DOM deps
#     except mathHtml — stub it: globalThis.mathHtml = (t,d) => `<math>${t}</math>`)
```

Anything touching the DOM walkers needs a real browser. Playwright is the right
tool: type into `#editor`, then assert that `getText()` round-trips and that a
known caret offset survives a render.

## Conventions

- No build step, no bundler, no framework. If a change needs one, it is the wrong change.
- Documents live in IndexedDB (see Documents below). Small state goes through
  `persist()`/`recall()`/`forget()`, which prefer `window.storage`, fall back
  to `localStorage`, and swallow failures. Nothing touches `localStorage`
  directly.
- KaTeX and Mermaid load lazily from CDN and **must** fail soft: if they do not load, math and diagrams stay as plain source and nothing else breaks. Keep it that way.
- CSS colours come from custom properties only, so both themes stay in sync.
- Danish/English: UI is English. Nothing is localised yet.

## Known gaps

- Emoji shortcodes (`:smile:`) — needs an inline table, not implemented.
- Front matter is parsed naively: top-level `key: value` rows and indented
  `- item` lists only. Anything else shows in the source but not in the card.
- Raw HTML is shown as source in the editor (rendering it would inject untracked
  text nodes). It passes through untouched on export.
- Table editing is source editing. No cell navigation, no auto-alignment of the
  source pipes. A "tidy table" command that pads the source columns would be a
  natural next feature.
- Print is deliberately Typora-like (sans, 10pt, 1.4 leading, half-height
  blank lines, narrow margin by default) regardless of the screen theme.
- Mermaid redraws on a 450 ms pause. Large diagrams will feel it.
- The `~~~` fence and setext heading paths are the least exercised code.

## Ideas not yet built

- Tidy/align table source (`⌘⇧|`)
- Command palette
- Vendored offline build (~1.5 MB with KaTeX + Mermaid inlined)

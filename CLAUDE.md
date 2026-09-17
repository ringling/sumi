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
its `className`; `render()` carries `.active`, `.near` and `.fold` over from
the old element and `updateActive()` recomputes them afterwards. Dropping
them during the rewrite made the fresh `.tok` spans animate open on every
keystroke, so the text slid under the caret for 120 ms (seen as the caret
jumping on an active heading).

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
| table commands | `cellSpans`, `tidyRows`, `tableCtx`, `replaceTable`, `tableNav` |
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
`render()` sets `body.hfrom2` whenever the document has exactly one h1 (for
the export's counters); the editor and the TOC use `num` from `scan()`, which
applies the same rule: a lone h1 is unnumbered and h2 is the top level (1.,
2., 3.1); with zero or several h1s numbering starts at h1. No manual switch.
A setext `===` heading is an h1 too. In the editor each entry carries
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

Code line numbers are CSS counters on `::before` (nothing in the DOM).
Heading numbers are computed at the end of `scan()` into `f.num` and
`headings[i].num` (a lone h1 is the title and unnumbered; otherwise from h1)
and rendered as a `data-x` span after the marker, so an active line reads
`# 1.2 Title`, not `1.2 # Title` as a pseudo-element gave; `body.hnums`
only shows or hides it, and the TOC reads the same `num`. The equation label
is a `<span class="eqno">` inside the `data-x` preview, numbered by `f.eq`.
Export mirrors all three with CSS counters on `<pre class="linenos">` (one
`<span class="ln">` per line, cut with `hlSplit`), `body.hnums` (plus
`body.hfrom2`) and `body.eqnos`. Chrome does not resolve `counter()` in
`getComputedStyle`, so the line-number harness checks the rule and the
screenshot checks the value.

## Section folding

`folded` is a Set of heading slugs (session only). `applySections(caretLine)`
runs at the end of `updateActive()`: after a folded heading every line up to
the next heading of the same or a higher level gets `.hid` (display:none on
screen only; print, export and source mode show everything). If the caret
line would be hidden, the owning heading is unfolded first. `foldSection(i)`
toggles the heading at or above line i and parks the caret on the heading
when it was inside the section. `.hid` and `.folded` survive a line rewrite
via the keep list in `render()`. The gutter chevron is a `::before` outside
the line box; the click handler treats any click left of a heading's box as
a fold toggle, like the task checkbox.

## Slash commands

`SLASH` is a list of [key, label, template] (a template may be a function,
e.g. today's date); `§` marks the caret and no template contains one.
`slashCheck()` runs from `afterChange` before the emoji check and on
selection change while open: a line that is exactly `/query` with the caret
at its end opens `#slash`, filtered by key prefix first, then by the start of
a label word (substring matching pulled in "Important" for "ta"). Front
matter is offered only on line 0; nothing inside code or maths. Accepting is
one `setText` replacing the line. Keys mirror the emoji popup and are
handled first in the keydown handler.

## Emoji shortcodes

`EMOJI` is a curated table of about 650 GitHub names (one template string,
`name glyph|…`). `inline()` folds `:name:` to a `data-x` glyph span, plain
glyph on export; unknown names stay text, and nothing happens inside code.
`emojiCheck()` runs from `afterChange` and on selection change while open:
`:xx` before the caret opens `#emoji` with up to eight matches (prefix first),
↑ ↓ Enter Tab Esc handled in the keydown handler before anything else, and
accepting is one `setText`.

## Table commands

Edit ▸ Tidy table (⌘⇧|), Add row below (⌘⏎), Add column after, Delete row,
Delete column; Tab and Shift-Tab move between cells and Tab past the last
cell adds a row. `tableCtx()` finds the run of `table` lines around the
caret and the caret's cell via `cellSpans()` (trimmed content span per cell,
`\|` respected). Every command rewrites the run with `tidyRows()` (columns
padded to the widest cell in code points, alignment kept from the divider)
and `replaceTable()` places the selection in a chosen cell, all through
`setText`. A row shorter than the header is padded by tidy when Tab reaches
its missing cell. Header and divider rows cannot be deleted.

Leaving a table tidies it automatically: `updateActive()` remembers the
table line the caret was on (`lastTableLine`) and calls `autoTidy()` once the
caret is elsewhere; it rewrites only if `tidyRows()` changes something and
shifts a caret that sits after the table by the length difference. Off with
`body.notidy` (Page ▸ Tidy tables, persisted). A tidy within 700 ms of the
last keystroke coalesces into that undo step, by the normal `record()` rule.

## Auto-pairing

`autoPair(e)` runs from `beforeinput` for `insertText` and
`deleteContentBackward` and returns true when it handled the event (the
handler then calls `preventDefault`). Pairs: ( [ { " ` * _. Wrap on
selection, step over an existing closer, delete an empty pair. Off inside
code, fence, maths and front-matter lines, off for * and _ next to a letter
or digit, off entirely under `body.nopair` (View ▸ Auto-pair, persisted).
Every change goes through `setText`, so each pair is one undo step.

Chrome does not let `beforeinput` from `execCommand` be cancelled, so
harnesses that test this must type with real key events: push strings onto
`window.__keys` and the driver sends them as trusted keys (`\b` backspace,
`\n` Enter), bumping `window.__typed` per string.

## Find and replace

`#find` (⌘F, File ▸ Find) searches `text`, so folded tables and code are
included. `runFind()` collects [start, end] offsets and picks the match at or
after the caret; `paintFind()` builds one Range per match from
`textNodeMap()` (every text node with its offset, data-x skipped) and hands
them to `CSS.highlights` as `sumi-find` and `sumi-find-current`. Nothing is
inserted into the DOM. `gotoMatch()` sets the selection and calls
`updateActive()`, which unfolds a block the match sits in; the query input
keeps focus. `afterChange()` reruns the search while the bar is open.
Replace one and Replace all are single `setText` calls, so each is one undo
step. Without the Highlight API the count and the selection still work.

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
node test/cdp.mjs http://localhost:8765/test/find.html       # find and replace
node test/cdp.mjs http://localhost:8765/test/pair.html       # auto-pairing, typed with real key events
node test/cdp.mjs http://localhost:8765/test/table.html      # table commands and Tab navigation
node test/cdp.mjs http://localhost:8765/test/emoji.html      # shortcodes and the completion popup
node test/cdp.mjs http://localhost:8765/test/slash.html      # slash commands, typed with real keys
node test/cdp.mjs http://localhost:8765/test/fold.html       # section folding
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

- Emoji shortcodes cover a curated set, not GitHub's full list.
- Front matter is parsed naively: top-level `key: value` rows and indented
  `- item` lists only. Anything else shows in the source but not in the card.
- Raw HTML is shown as source in the editor (rendering it would inject untracked
  text nodes). It passes through untouched on export.
- Table editing is source editing with helpers; there is no cell-level widget.
- Print is deliberately Typora-like (sans, 10pt, 1.4 leading, half-height
  blank lines, narrow margin by default) regardless of the screen theme.
- Pages (`body.pagebreak`) breaks before every h1 and h2 except the one
  `scan()` marks `.first`: the first heading with nothing printable before it
  (blank lines and front matter do not count). Using `:first-child` instead
  produced an empty first page whenever front matter preceded the title.
- Mermaid redraws on a 450 ms pause. Large diagrams will feel it.
- The `~~~` fence and setext heading paths are the least exercised code.

## Ideas not yet built

- Vendored offline build (~1.5 MB with KaTeX + Mermaid inlined)

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

Tables, ```` ```mermaid ```` blocks, `$$…$$` blocks and a YAML front matter block
at the top are runs of lines sharing
a `blk` id assigned in `scan()`. The last line of a run gets `f.last` and holds a
`<span class="prev" data-x>`. When the caret is outside the run, every line in it
gets `.fold`, which hides `.src` and collapses the line to zero height, leaving
only the preview. Caret inside → unfolds, source and preview both show.

Add a new block type by giving it a `blk`, a `kind`, and a branch in
`renderPreviews()`. Do not invent a second mechanism.

## File map (line numbers drift — the `── section ──` comments are the anchors)

| Region | What lives there |
|---|---|
| `<style>` tokens | CSS custom properties; the default (Paper) values |
| `<style>` themes | one `html[data-theme="…"]` block per built-in theme |
| `<style>` writing surface | `.line`, `.tok` folding, block/preview/fold rules |
| `@media print` | page breaks, margins, hiding block source |
| GFM inline | `inline(s, clean)` — one tokenizer, two output modes |
| tables | `splitRow`, `tableHtml`, run detection |
| line classification | `classify()` — single line → type + css class |
| document scan | `scan()` — stateful pass: fences, math, tables, setext, refs |
| line rendering | `renderLine` / `coreLine` |
| syntax highlighting | `hlLang`, `hlRun`, `hlBlock`, `hlSplit`, `HL_CSS` |
| chrome behaviour | `toggle`, the shared `openMenu` popup, the Numbers menu |
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

The Theme and Numbers buttons share one popup, `openMenu(btn, items)`, which
builds `#menu` lazily on each open. Tests must open the menu before querying
its items.

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
node test/cdp.mjs 'http://localhost:8765/test/shot.html?code#paper,linenos,hnums,eqnos' shot.png   # screenshot: theme, toggles
node test/pdf.mjs http://localhost:8765/sumi.html out.pdf            # print a sample doc, reports page count
```

Each harness loads `sumi.html` in an iframe and reports PASS/FAIL lines. The
script is an IIFE, so tests go through the UI (clicks, key events, drop
events, `execCommand('insertText')` for typing), not through internal
functions. Needs Chrome at the default macOS path and network for the CDN
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
- No `localStorage` directly — `store()`/`load()` prefer `window.storage`, fall back to `localStorage`, and swallow failures. Drafts are best-effort.
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
- Multiple documents / tabs
- Vendored offline build (~1.5 MB with KaTeX + Mermaid inlined)

# Sumi features

One short entry per feature: what it does, how you reach it, what to expect.
The README is the overview; `demo.md` shows every construct live.

## The editing surface

**Live rendering with folded syntax.** The document is always raw markdown.
Each source line is rendered in place and its markers, such as `**` or `#`,
take no space until your caret is on that line. Move away and they fold
again. Nothing is ever converted to HTML and back, so what you export is
exactly what you typed.

**Reveal all syntax.** ⌘⇧R shows every marker on every line while keeping the
rendering. Useful for checking structure without leaving the rendered view.

**Source code mode.** ⌘⇧U, or View ▸ Source code, shows the whole document as
plain monospace markdown with nothing folded or rendered. The caret stays
where it was; it is a view, not a conversion.

**Focus mode.** ⌘⇧F dims everything except the paragraph you are in.

**Typewriter mode.** ⌘⇧T keeps the line you are typing on vertically centred.

**Outline.** ⌘\ opens a drawer listing the headings; click one to jump. A dot
marks a second top-level heading or a skipped level, with a tooltip saying
why. It is advice, never enforced.

**Section folding.** Hover a heading and a chevron appears in the margin.
Click it, press ⌘⇧., or use Edit ▸ Fold to hide everything under the heading
up to the next heading of the same or a higher level. Folds are remembered
while the document is open, nested folds survive an outer fold, and jumping
into a hidden section, for example from find, unfolds it. Print, export and
source mode show everything.

## Writing aids

**Slash commands.** Type `/` on an empty line and a popup offers blocks:
headings, bullet, numbered and task lists, quote, the five alerts, code and
Mermaid fences, a maths block, a table, `[TOC]`, a rule, image, link,
footnote, front matter on the first line only, and today's date. Keep typing
to filter, use the arrows, Enter or Tab to insert, Escape to close. The
caret lands inside the template and the insertion is one undo step.

**Auto-pairing.** Typing `(`, `[`, `{`, `"`, `` ` ``, `*` or `_` inserts the
closing character after the caret. With text selected, the pair wraps it, so
select a word and type `*` for italic, twice for bold. Typing a closer that is
already there steps over it; backspace inside an empty pair removes both. It
stays out of code blocks and leaves `*` and `_` alone next to letters or
digits. View ▸ Auto-pair switches it off.

**Emoji shortcodes.** `:rocket:` shows the glyph and exports as the glyph.
Type a colon and two letters and a popup offers completions; Enter or Tab
inserts one. About 650 GitHub names are covered; unknown names stay as text.

**Find and replace.** ⌘F opens a bar with match count, next and previous
(⌘G and ⌘⇧G), match case, whole word, replace one and replace all. It
searches the source, so text inside folded tables and code is found, and
jumping to such a match unfolds the block. Each replace is one undo step.

**Headings.** ⌘1 to ⌘6 set the level of the current line, ⌘0 makes it a
paragraph.

**Lists.** Enter continues a list, Enter on an empty item ends it, Tab and
Shift-Tab nest and unnest, and ⌘⇧L cycles the selected lines through bullet,
numbered, task and plain. Numbered lists are renumbered as you go.

**Task lists.** `- [ ]` renders a circle in the margin; click it to tick or
untick. Done items are struck through.

**Inline styles.** Bold, italic, strikethrough with `~~`, highlight with
`==`, inline code, links with titles, reference links, autolinks and bare
URLs, images with optional titles, escapes with backslash, hard line breaks
with two trailing spaces or a backslash.

## Blocks

**Tables.** A table folds to a rendered grid when the caret leaves it and
opens as source when you click in. Inside it Tab and Shift-Tab move between
cells, Tab past the last cell adds a row, ⌘⏎ adds a row below, and Edit ▸
adds and deletes rows and columns. The source is tidied, columns padded and
alignment kept, whenever you leave the table or press ⌘⇧|. Page ▸ Tidy
tables switches the automatic part off.

**Code.** Fenced code with a language is highlighted by highlight.js, which
loads on demand and degrades to plain text without a network. Page ▸ Code
line numbers numbers each fence from one. Indented and tilde-fenced code
work too.

**Maths.** `$x^2$` inline and `$$` blocks, rendered by KaTeX. Page ▸ Equation
numbers labels each block. A plain `$5` is left alone.

**Diagrams.** A ```` ```mermaid ```` fence draws the diagram below its source
and folds to just the drawing when you leave it. Redrawn after a short pause.

**Alerts.** GitHub's `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and
`[!CAUTION]` on the first line of a quote colour the whole block and show a
label. Any case works; a marker on a later line or with trailing text is
plain text.

**Footnotes.** `[^name]` in the text and `[^name]: definition` anywhere.
References are numbered in definition order, hovering one shows the
definition, and exports end with the list.

**Table of contents.** A `[TOC]` line becomes a list of the headings, nested
by level, updating as you edit. Entries jump to their heading, and
`[text](#heading)` links do the same anywhere in the text. With heading
numbers on, the list shows the numbers.

**Front matter.** A YAML block between `---` lines at the top folds to a
small card of its keys and values, and is left out of exports.

**Raw HTML.** Shown as source in the editor and passed through untouched to
the exported page.

## Numbering

**Heading numbers.** Page ▸ Heading numbers numbers headings as 1, 1.1,
1.2.3. A document with a single `#` treats it as the title, leaves it
unnumbered and numbers sections from `##`; with several `#` headings the
numbering starts at `#`. The table of contents and the export follow.

**Equation numbers and code line numbers.** Under Page as well; all three
persist.

## Documents

**Many documents.** Everything you write is kept in the browser's own
database. File ▸ Documents opens a drawer listing documents by last edit:
click to switch, double-click to rename, × twice to delete, + New to start
another. File ▸ Rename selects the name at the top left. Opened or dropped
files become documents; dropping the same file again reopens it.

**Version history.** A version is kept thirty seconds after you stop typing,
whenever you leave the document, on save, and when you name one in the
drawer. File ▸ History lists them; click a version for Restore, Diff and
Delete. Restore first keeps what it replaces and can be undone. Versions are
thinned over time: everything from the last hour, hourly for a day, daily for
a month, weekly beyond, and named versions forever.

**Backup and import.** File ▸ Backup downloads every document and version as
one JSON file. File ▸ Import, or dropping the file on the window, merges it
without duplicates.

**Save and open.** ⌘S writes to a real file through the browser's file
picker where supported and remembers the file for later saves; elsewhere it
downloads. ⌘O opens a file; so does dropping one on the window.

**Two tabs.** If the same document is edited in two tabs, the second writer
is paused with a notice instead of overwriting; a tab with no local edits
picks up the other's save.

**Drawers.** Documents, History and Outline remember whether they were open.

## Output

**Copy markdown.** File ▸ Copy markdown puts the source on the clipboard.

**Copy as rich text.** Edit ▸ Copy as rich text renders the selection or the
document and puts the HTML on the clipboard with the markdown as plain text,
so Word, Outlook and mail paste it with headings, lists, tables and code.

**Export HTML.** ⌘⇧E downloads a standalone page that follows the current
theme, with highlighted code, maths, diagrams, footnotes and the table of
contents.

**Print and PDF.** ⌘P prints a compact page: sans, 10pt, tight leading,
regardless of theme. Page ▸ Page break starts a new page at each `#` and
`##`, except the title. Page ▸ Margin sets the page margin, shown on screen
too.

**Share as a link.** File ▸ Copy share link packs the document, compressed,
into a link. Opening it in Sumi creates the document, or reopens it if it is
already there. Nothing is sent to a server. The toast shows the size and
warns past 8 KB, where mail and chat apps tend to cut links.

## Looks

**Themes.** Theme ▸ Paper, Ink, GitHub, Whitey, Newsprint, Sepia and Night.
⌘⇧D flips between a theme's light and dark counterpart. Exports follow the
theme; print does not.

**Custom themes.** Drop a `.css` file on the window or load it from the Theme
menu. `themes/sample.css` documents every token; a custom file can also
restyle any editor rule.

**Width and typeface.** View ▸ Width steps through four measures and View ▸
Typeface through serif, sans and mono. A theme may set its own; the buttons
override it.

**Settings.** Theme, custom CSS, width, typeface, margin, page breaks, the
numbering options, auto-pair, auto-tidy and the drawer states are all
remembered between sessions.

## Help

⌘/ lists every shortcut and shows the version number. `CHANGELOG.md` says
what each version added.

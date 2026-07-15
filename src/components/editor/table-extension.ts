import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
  keymap,
} from "@codemirror/view";
import {
  EditorSelection,
  type EditorState,
  type Extension,
  type Range,
  StateField,
} from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { livePreviewEnabled } from "./live-preview";
import {
  type ColumnAlignment,
  buildEmptyRow,
  buildTableMarkdown,
  parseDelimiterRow,
  splitTableRow,
  unescapePipes,
} from "@/lib/markdown-table";

const ACCENT = "rgb(var(--grim-accent))";
const LINK = "rgb(var(--grim-link))";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** True when any selection range touches [from, to], including boundaries. */
function touches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some(
    (range) => range.from <= to && range.to >= from,
  );
}

interface CellRef {
  text: string;
  /** Offsets relative to the table's first character. */
  relFrom: number;
  relTo: number;
}

interface ParsedTable {
  /** Raw table text, used for cheap widget equality. */
  text: string;
  header: CellRef[];
  alignments: ColumnAlignment[];
  rows: CellRef[][];
}

function parseTable(
  state: EditorState,
  from: number,
  to: number,
): ParsedTable | null {
  const doc = state.doc;
  const first = doc.lineAt(from);
  const last = doc.lineAt(to);
  if (last.number - first.number < 1) return null;

  const rowRefs = (line: { text: string; from: number }): CellRef[] =>
    splitTableRow(line.text).map((cell) => ({
      text: cell.text,
      relFrom: line.from + cell.from - from,
      relTo: line.from + cell.to - from,
    }));

  const header = rowRefs(first);
  const alignments = parseDelimiterRow(doc.line(first.number + 1).text);
  if (!header.length || !alignments) return null;

  const rows: CellRef[][] = [];
  for (let n = first.number + 2; n <= last.number; n++) {
    rows.push(rowRefs(doc.line(n)));
  }
  return { text: doc.sliceString(from, to), header, alignments, rows };
}

const INLINE_TOKEN =
  /(`+)(.+?)\1|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*([^*]+)\*|_([^_]+)_|\[\[([^[\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/g;

/** Minimal inline-markdown renderer for cell contents. */
function renderInline(text: string, into: HTMLElement): void {
  let last = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) into.append(text.slice(last, index));
    if (match[2] != null) {
      const el = document.createElement("code");
      el.textContent = match[2];
      into.appendChild(el);
    } else if (match[3] != null || match[4] != null) {
      const el = document.createElement("strong");
      renderInline(match[3] ?? match[4], el);
      into.appendChild(el);
    } else if (match[5] != null) {
      const el = document.createElement("del");
      renderInline(match[5], el);
      into.appendChild(el);
    } else if (match[6] != null || match[7] != null) {
      const el = document.createElement("em");
      renderInline(match[6] ?? match[7], el);
      into.appendChild(el);
    } else if (match[8] != null) {
      const el = document.createElement("span");
      el.className = "cm-wikilink";
      el.textContent = match[8].trim();
      into.appendChild(el);
    } else {
      const el = document.createElement("a");
      el.textContent = match[9];
      el.href = match[10];
      el.target = "_blank";
      el.rel = "noopener noreferrer";
      into.appendChild(el);
    }
    last = index + match[0].length;
  }
  if (last < text.length) into.append(text.slice(last));
}

/**
 * Renders a whole table as an HTML `<table>`. Clicking a cell places the
 * cursor at that cell in the source, which reveals the raw markdown (the
 * decoration only applies while the selection is outside the table).
 */
class TableWidget extends WidgetType {
  constructor(private readonly table: ParsedTable) {
    super();
  }

  override eq(other: TableWidget): boolean {
    return other.table.text === this.table.text;
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-md-table";

    const tableEl = document.createElement("table");
    const columns = this.table.header.length;

    const fillRow = (
      cells: CellRef[],
      tag: "th" | "td",
      tr: HTMLTableRowElement,
    ) => {
      for (let i = 0; i < Math.max(columns, cells.length); i++) {
        const el = document.createElement(tag);
        const cell = cells[i];
        if (cell) {
          renderInline(unescapePipes(cell.text), el);
          el.dataset.relTo = String(cell.relTo);
        }
        const align = this.table.alignments[i];
        if (align) el.style.textAlign = align;
        tr.appendChild(el);
      }
    };

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    fillRow(this.table.header, "th", headRow);
    thead.appendChild(headRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of this.table.rows) {
      const tr = document.createElement("tr");
      fillRow(row, "td", tr);
      tbody.appendChild(tr);
    }
    tableEl.appendChild(tbody);
    wrap.appendChild(tableEl);

    wrap.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("a")) return;
      event.preventDefault();
      const base = view.posAtDOM(wrap);
      const cellEl = target.closest<HTMLElement>("[data-rel-to]");
      const pos = cellEl ? base + Number(cellEl.dataset.relTo) : base;
      view.dispatch({
        selection: { anchor: Math.min(pos, view.state.doc.length) },
        scrollIntoView: true,
      });
      view.focus();
    });

    return wrap;
  }
}

function buildTableDecorations(state: EditorState): DecorationSet {
  if (state.field(livePreviewEnabled, false) === false) return Decoration.none;
  const decos: Range<Decoration>[] = [];
  const tree =
    ensureSyntaxTree(state, state.doc.length, 100) ?? syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      if (node.name !== "Table") return;
      if (touches(state, node.from, node.to)) {
        // Cursor inside: leave the source visible, but set it in monospace
        // so the pipe columns stay aligned while editing.
        for (let pos = node.from; pos <= node.to; ) {
          const line = state.doc.lineAt(pos);
          decos.push(
            Decoration.line({ class: "cm-table-source-line" }).range(
              line.from,
            ),
          );
          pos = line.to + 1;
        }
        return false;
      }
      const parsed = parseTable(state, node.from, node.to);
      if (!parsed) return false;
      decos.push(
        Decoration.replace({
          widget: new TableWidget(parsed),
          block: true,
        }).range(node.from, node.to),
      );
      return false;
    },
  });
  return Decoration.set(decos, true);
}

/**
 * Inserts a `columns` x `bodyRows` table skeleton below the current line and
 * selects the first header placeholder so typing replaces it.
 */
export function insertTable(
  view: EditorView,
  columns: number,
  bodyRows: number,
): boolean {
  const { state } = view;
  const markdown = buildTableMarkdown(columns, bodyRows);
  const line = state.doc.lineAt(state.selection.main.head);

  let prefix: string;
  if (line.text.trim() === "") {
    const prev = line.number > 1 ? state.doc.line(line.number - 1) : null;
    prefix = prev && prev.text.trim() !== "" ? "\n" : "";
  } else {
    prefix = "\n\n";
  }
  const from = line.to;
  const suffix = from < state.doc.length ? "\n" : "";

  const placeholder = "Column 1";
  const headOffset = from + prefix.length + markdown.indexOf(placeholder);
  view.dispatch({
    changes: { from, insert: prefix + markdown + suffix },
    selection: EditorSelection.single(
      headOffset,
      headOffset + placeholder.length,
    ),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

function findTable(state: EditorState, pos: number) {
  const tree = syntaxTree(state);
  for (const side of [-1, 1] as const) {
    let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(
      pos,
      side,
    );
    while (node) {
      if (node.name === "Table") return node;
      node = node.parent;
    }
  }
  return null;
}

/** Absolute doc ranges of every cell (header + body, delimiter row skipped). */
function tableCells(
  state: EditorState,
  table: { from: number; to: number },
): { from: number; to: number }[] {
  const first = state.doc.lineAt(table.from);
  const last = state.doc.lineAt(table.to);
  const cells: { from: number; to: number }[] = [];
  for (let n = first.number; n <= last.number; n++) {
    if (n === first.number + 1) continue;
    const line = state.doc.line(n);
    for (const cell of splitTableRow(line.text)) {
      cells.push({ from: line.from + cell.from, to: line.from + cell.to });
    }
  }
  return cells;
}

function selectCell(view: EditorView, cell: { from: number; to: number }) {
  view.dispatch({
    selection: EditorSelection.single(cell.from, cell.to),
    scrollIntoView: true,
  });
}

/** Tab: jump to the next cell; from the last cell, append a fresh row. */
function nextCell(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const table = findTable(state, pos);
  if (!table) return false;
  const cells = tableCells(state, table);
  if (!cells.length) return false;

  let current = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].from <= pos) current = i;
  }
  const next = current + 1;
  if (next < cells.length) {
    selectCell(view, cells[next]);
    return true;
  }

  const lastLine = state.doc.lineAt(table.to);
  const columns = Math.max(1, splitTableRow(state.doc.lineAt(table.from).text).length);
  const row = buildEmptyRow(columns);
  const cursor = lastLine.to + 1 + 2; // start of the new row's first cell
  view.dispatch({
    changes: { from: lastLine.to, insert: `\n${row}` },
    selection: { anchor: cursor },
    scrollIntoView: true,
  });
  return true;
}

/** Shift-Tab: jump to the previous cell. */
function previousCell(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const table = findTable(state, pos);
  if (!table) return false;
  const cells = tableCells(state, table);

  let current = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].from <= pos) current = i;
  }
  if (current <= 0) return current === 0;
  selectCell(view, cells[current - 1]);
  return true;
}

const tableTheme = EditorView.theme({
  ".cm-md-table": {
    padding: "4px 0 8px",
    overflowX: "auto",
  },
  ".cm-md-table table": {
    borderCollapse: "collapse",
    fontSize: "0.95em",
    lineHeight: "1.5",
  },
  ".cm-md-table th, .cm-md-table td": {
    border: "1px solid rgb(var(--grim-text) / 0.16)",
    padding: "5px 12px",
    textAlign: "left",
    cursor: "text",
    minWidth: "48px",
  },
  ".cm-md-table th": {
    backgroundColor: "rgb(var(--grim-text) / 0.05)",
    fontWeight: "600",
  },
  ".cm-md-table td:hover": {
    backgroundColor: "rgb(var(--grim-accent) / 0.06)",
  },
  ".cm-md-table code": {
    fontFamily: MONO,
    fontSize: "0.9em",
    color: ACCENT,
  },
  ".cm-md-table a": { color: LINK, textDecoration: "underline" },
  ".cm-md-table .cm-wikilink": { color: LINK },
  ".cm-table-source-line": {
    fontFamily: MONO,
    fontSize: "0.88em",
  },
});

/**
 * GFM table live preview: tables render as real HTML tables while the
 * selection is outside them; click a cell (or arrow into the table) to edit
 * the source, and Tab/Shift-Tab hop between cells while editing. A state
 * field (not a view plugin) because block decorations must come from state.
 */
export function tableExtension(): Extension {
  const field = StateField.define<DecorationSet>({
    create: buildTableDecorations,
    update(decorations, tr) {
      const toggled =
        tr.startState.field(livePreviewEnabled, false) !==
        tr.state.field(livePreviewEnabled, false);
      if (!tr.docChanged && !tr.selection && !toggled) return decorations;
      return buildTableDecorations(tr.state);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  return [
    field,
    tableTheme,
    keymap.of([
      { key: "Tab", run: nextCell },
      { key: "Shift-Tab", run: previousCell },
    ]),
  ];
}

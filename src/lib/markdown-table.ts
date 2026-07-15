/**
 * Helpers for GFM pipe tables. Pure string logic (no CodeMirror imports) so
 * everything here is unit-testable in a plain node environment.
 */

export type ColumnAlignment = "left" | "center" | "right" | null;

export interface CellSlice {
  /** Trimmed cell text, still backslash-escaped as written. */
  text: string;
  /** Offsets of the trimmed text within the row string. */
  from: number;
  to: number;
}

/**
 * Splits one table row into cells on unescaped pipes. The empty outer
 * segments produced by a leading/trailing pipe are dropped, so both
 * `| a | b |` and `a | b` yield two cells.
 */
export function splitTableRow(line: string): CellSlice[] {
  const boundaries: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\") {
      i++;
      continue;
    }
    if (line[i] === "|") boundaries.push(i);
  }
  if (!boundaries.length) return [];

  const slices: CellSlice[] = [];
  let start = 0;
  for (const boundary of [...boundaries, line.length]) {
    const raw = line.slice(start, boundary);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    slices.push({ text, from: start + lead, to: start + lead + text.length });
    start = boundary + 1;
  }
  if (slices.length && slices[0].text === "") slices.shift();
  if (slices.length && slices[slices.length - 1].text === "") slices.pop();
  return slices;
}

/**
 * Parses a delimiter row like `| :--- | :--: | ---: |` into per-column
 * alignments. Returns null when the line is not a valid delimiter row.
 */
export function parseDelimiterRow(line: string): ColumnAlignment[] | null {
  const cells = splitTableRow(line);
  if (!cells.length) return null;
  const alignments: ColumnAlignment[] = [];
  for (const cell of cells) {
    const match = /^(:?)-+(:?)$/.exec(cell.text);
    if (!match) return null;
    alignments.push(
      match[1] && match[2]
        ? "center"
        : match[2]
          ? "right"
          : match[1]
            ? "left"
            : null,
    );
  }
  return alignments;
}

/** Unescapes `\|`, the one escape GFM requires inside table cells. */
export function unescapePipes(text: string): string {
  return text.replace(/\\\|/g, "|");
}

/**
 * Builds a table skeleton with `Column N` headers and `bodyRows` empty rows.
 * Delimiter and body cells are padded to the header width so the raw source
 * stays column-aligned.
 */
export function buildTableMarkdown(columns: number, bodyRows: number): string {
  const headers = Array.from(
    { length: Math.max(1, columns) },
    (_, i) => `Column ${i + 1}`,
  );
  const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const lines = [
    row(headers),
    row(headers.map((h) => "-".repeat(h.length))),
  ];
  for (let i = 0; i < Math.max(1, bodyRows); i++) {
    lines.push(row(headers.map((h) => " ".repeat(h.length))));
  }
  return lines.join("\n");
}

/** An empty body row matching `columns`, e.g. `|    |    |`. */
export function buildEmptyRow(columns: number): string {
  return `| ${Array(Math.max(1, columns)).fill("  ").join(" | ")} |`;
}

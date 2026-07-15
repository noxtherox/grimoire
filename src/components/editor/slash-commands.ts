import type {
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { insertTable } from "./table-extension";

const TABLE_SIZES: Array<{ columns: number; rows: number }> = [
  { columns: 2, rows: 2 },
  { columns: 3, rows: 3 },
  { columns: 4, rows: 3 },
  { columns: 5, rows: 3 },
];

/**
 * Notion-style insert menu: typing `/` at the start of a line (or after a
 * space) opens a completion list of insertable blocks. Currently tables in
 * a few sizes; extend `options` for future block types.
 */
export function slashCommandSource(
  context: CompletionContext,
): CompletionResult | null {
  const match = context.matchBefore(/\/[\w]*$/);
  if (!match) return null;
  // Only trigger at a word boundary so `https://` or `a/b` never open it.
  const before =
    match.from > 0 ? context.state.sliceDoc(match.from - 1, match.from) : "";
  if (before && !/\s/.test(before)) return null;

  return {
    from: match.from + 1,
    options: TABLE_SIZES.map(({ columns, rows }, i) => ({
      label: `Table (${columns}×${rows})`,
      detail: `${columns} columns, ${rows} rows`,
      type: "keyword",
      boost: -i,
      apply: (view, _completion, from, to) => {
        // Remove the trigger text ("/tab…") before inserting the skeleton.
        view.dispatch({ changes: { from: from - 1, to, insert: "" } });
        insertTable(view, columns, rows);
      },
    })),
    validFor: /^\w*$/,
  };
}

import { describe, expect, it } from "vitest";
import {
  buildEmptyRow,
  buildTableMarkdown,
  parseDelimiterRow,
  splitTableRow,
  unescapePipes,
} from "./markdown-table";

describe("splitTableRow", () => {
  it("splits a row with leading and trailing pipes", () => {
    const cells = splitTableRow("| Action | Shortcut |");
    expect(cells.map((c) => c.text)).toEqual(["Action", "Shortcut"]);
  });

  it("splits a row without outer pipes", () => {
    const cells = splitTableRow("Action | Shortcut");
    expect(cells.map((c) => c.text)).toEqual(["Action", "Shortcut"]);
  });

  it("reports offsets of the trimmed cell text", () => {
    const line = "| ab |  cd |";
    const cells = splitTableRow(line);
    expect(line.slice(cells[0].from, cells[0].to)).toBe("ab");
    expect(line.slice(cells[1].from, cells[1].to)).toBe("cd");
  });

  it("keeps empty inner cells", () => {
    const cells = splitTableRow("| a |  | c |");
    expect(cells.map((c) => c.text)).toEqual(["a", "", "c"]);
  });

  it("keeps a trailing empty cell", () => {
    const cells = splitTableRow("| a | |");
    expect(cells.map((c) => c.text)).toEqual(["a", ""]);
  });

  it("does not split on escaped pipes", () => {
    const cells = splitTableRow("| a \\| b | c |");
    expect(cells.map((c) => c.text)).toEqual(["a \\| b", "c"]);
  });

  it("ignores indentation before the leading pipe", () => {
    const cells = splitTableRow("  | a | b |");
    expect(cells.map((c) => c.text)).toEqual(["a", "b"]);
  });

  it("returns nothing for a line without pipes", () => {
    expect(splitTableRow("plain text")).toEqual([]);
  });
});

describe("parseDelimiterRow", () => {
  it("parses alignments", () => {
    expect(parseDelimiterRow("| :--- | :--: | ---: | --- |")).toEqual([
      "left",
      "center",
      "right",
      null,
    ]);
  });

  it("accepts compact delimiters", () => {
    expect(parseDelimiterRow("|-|-|")).toEqual([null, null]);
  });

  it("rejects rows that are not delimiters", () => {
    expect(parseDelimiterRow("| a | b |")).toBeNull();
    expect(parseDelimiterRow("| --- | b |")).toBeNull();
    expect(parseDelimiterRow("plain text")).toBeNull();
  });
});

describe("unescapePipes", () => {
  it("unescapes only pipes", () => {
    expect(unescapePipes("a \\| b \\* c")).toBe("a | b \\* c");
  });
});

describe("buildTableMarkdown", () => {
  it("builds a skeleton that parses back to the requested shape", () => {
    const md = buildTableMarkdown(3, 2);
    const lines = md.split("\n");
    expect(lines).toHaveLength(4); // header + delimiter + 2 rows
    expect(splitTableRow(lines[0]).map((c) => c.text)).toEqual([
      "Column 1",
      "Column 2",
      "Column 3",
    ]);
    expect(parseDelimiterRow(lines[1])).toEqual([null, null, null]);
    expect(splitTableRow(lines[2])).toHaveLength(3);
  });

  it("clamps to at least one column and row", () => {
    const lines = buildTableMarkdown(0, 0).split("\n");
    expect(lines).toHaveLength(3);
    expect(splitTableRow(lines[0]).map((c) => c.text)).toEqual(["Column 1"]);
  });
});

describe("buildEmptyRow", () => {
  it("builds a row whose cell count matches", () => {
    expect(splitTableRow(buildEmptyRow(3))).toHaveLength(3);
  });
});

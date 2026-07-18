import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { titleLineFrom } from "./markdown-extensions";

describe("note title line", () => {
  it("uses the first line for a normal note", () => {
    const state = EditorState.create({ doc: "My title\nBody" });

    expect(titleLineFrom(state)).toBe(0);
  });

  it("matches the first non-empty line used by noteTitle", () => {
    const state = EditorState.create({ doc: "  \n\n# My title\nBody" });

    expect(titleLineFrom(state)).toBe(4);
  });

  it("keeps an empty note ready for title-sized typing", () => {
    const state = EditorState.create({ doc: "" });

    expect(titleLineFrom(state)).toBe(0);
  });
});

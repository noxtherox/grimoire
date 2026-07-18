import { describe, expect, it } from "vitest";
import {
  listPropertyValue,
  listSelections,
  normalizeListOptions,
} from "./properties";

describe("list properties", () => {
  it("normalizes blank and duplicate options", () => {
    expect(normalizeListOptions([" Todo ", "", "todo", "Done"])).toEqual([
      "Todo",
      "Done",
    ]);
  });

  it("reads both legacy scalar values and arrays as selections", () => {
    expect(listSelections("Todo")).toEqual(["Todo"]);
    expect(listSelections(["Todo", "Done"])).toEqual(["Todo", "Done"]);
    expect(listSelections(undefined)).toEqual([]);
  });

  it("serializes one or many selections according to the configured mode", () => {
    expect(listPropertyValue(["Todo", "Done"], false)).toBe("Todo");
    expect(listPropertyValue(["Todo", "Done"], true)).toEqual([
      "Todo",
      "Done",
    ]);
    expect(listPropertyValue([], true)).toBeNull();
  });
});

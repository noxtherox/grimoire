import { describe, expect, it } from "vitest";
import {
  GRIMOIRE_METADATA_KEYS,
  isReservedGrimoireProperty,
} from "@/lib/grimoire-metadata";

describe("Grimoire reserved metadata", () => {
  it("reserves current and future grimoire-prefixed keys case-insensitively", () => {
    expect(isReservedGrimoireProperty(GRIMOIRE_METADATA_KEYS.id)).toBe(true);
    expect(isReservedGrimoireProperty("Grimoire-Pinned")).toBe(true);
    expect(isReservedGrimoireProperty(" grimoire-future-key ")).toBe(true);
  });

  it("does not hide ordinary user properties", () => {
    expect(isReservedGrimoireProperty("status")).toBe(false);
    expect(isReservedGrimoireProperty("my-grimoire-note")).toBe(false);
  });
});

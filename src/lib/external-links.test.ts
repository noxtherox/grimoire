import { describe, expect, it, vi } from "vitest";
import { normalizeExternalUrl } from "./external-links";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

describe("normalizeExternalUrl", () => {
  it.each([
    ["https://weldnote.com/standards", "https://weldnote.com/standards"],
    ["http://example.com", "http://example.com/"],
    ["weldnote.com", "https://weldnote.com/"],
    ["www.example.com/docs", "https://www.example.com/docs"],
  ])("normalizes %s", (value, expected) => {
    expect(normalizeExternalUrl(value)).toBe(expected);
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", "not a url", ""])(
    "rejects %s",
    (value) => expect(normalizeExternalUrl(value)).toBeNull(),
  );
});

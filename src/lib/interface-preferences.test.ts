import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyInterfaceZoom,
  DEFAULT_INTERFACE_ZOOM,
  loadInterfaceZoom,
  saveInterfaceZoom,
} from "./interface-preferences";

const values = new Map<string, string>();
const styles = new Map<string, string>();

beforeEach(() => {
  values.clear();
  styles.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal("document", {
    documentElement: {
      style: {
        setProperty: (key: string, value: string) => styles.set(key, value),
        getPropertyValue: (key: string) => styles.get(key) ?? "",
      },
    },
  });
});

describe("interface zoom preference", () => {
  it("uses 100% when there is no valid saved preference", () => {
    expect(loadInterfaceZoom()).toBe(DEFAULT_INTERFACE_ZOOM);
    values.set("grimoire.interfaceZoom", "115");
    expect(loadInterfaceZoom()).toBe(DEFAULT_INTERFACE_ZOOM);
  });

  it("saves and immediately applies a supported zoom", () => {
    saveInterfaceZoom(125);

    expect(loadInterfaceZoom()).toBe(125);
    expect(document.documentElement.style.getPropertyValue("zoom")).toBe(
      "1.25",
    );
  });

  it("can apply zoom without persisting it", () => {
    applyInterfaceZoom(90);

    expect(values.has("grimoire.interfaceZoom")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("zoom")).toBe(
      "0.9",
    );
  });
});

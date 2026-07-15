import { describe, expect, it } from "vitest";
import { filterNotes } from "./filters";
import {
  type Note,
  buildTypeTree,
  getAllTypePaths,
  isAbsoluteFsPath,
  isExternalNote,
  normalizeFsPath,
  noteAbsolutePath,
  parseTypePath,
  resolveExternalAssetPath,
} from "./note-utils";

const vaultNote: Note = {
  id: "vault",
  path: "work/Vault note.md",
  content: "# Vault note",
  pinned: false,
  updatedAt: "2026-07-15T10:00:00.000Z",
};

const externalNote: Note = {
  id: "external",
  path: "Review me.md",
  externalPath: "/Users/test/Desktop/Review me.md",
  content: "# Review me",
  pinned: false,
  updatedAt: "2026-07-15T11:00:00.000Z",
};

describe("external notes", () => {
  it("keeps external notes separate from vault filters and types", () => {
    expect(filterNotes([vaultNote, externalNote], { kind: "all" }, "")).toEqual(
      [vaultNote],
    );
    expect(
      filterNotes([vaultNote, externalNote], { kind: "external" }, ""),
    ).toEqual([externalNote]);
    expect(
      buildTypeTree([vaultNote, externalNote]).map((node) => node.name),
    ).toEqual(["work"]);
    expect(getAllTypePaths([vaultNote, externalNote])).toEqual([["work"]]);
  });

  it("reports the real path for external and vault notes", () => {
    expect(isExternalNote(externalNote)).toBe(true);
    expect(noteAbsolutePath(externalNote, "/vault")).toBe(
      "/Users/test/Desktop/Review me.md",
    );
    expect(noteAbsolutePath(vaultNote, "/vault/")).toBe(
      "/vault/work/Vault note.md",
    );
  });

  it("resolves image references relative to the external note's folder", () => {
    const notePath = "/Users/test/Docs/Review me.md";
    expect(resolveExternalAssetPath(notePath, "assets/shot.png")).toBe(
      "/Users/test/Docs/assets/shot.png",
    );
    expect(resolveExternalAssetPath(notePath, "./images/a.png")).toBe(
      "/Users/test/Docs/images/a.png",
    );
    expect(resolveExternalAssetPath(notePath, "../shared/b.png")).toBe(
      "/Users/test/shared/b.png",
    );
    expect(resolveExternalAssetPath(notePath, "/abs/c.png")).toBe(
      "/abs/c.png",
    );
    expect(resolveExternalAssetPath(notePath, ".")).toBe("/Users/test/Docs");
    expect(
      resolveExternalAssetPath("C:\\Docs\\Note.md", "assets\\d.png"),
    ).toBe("C:/Docs/assets/d.png");
    // `..` never climbs past the filesystem root
    expect(resolveExternalAssetPath("/root/Note.md", "../../../e.png")).toBe(
      "/e.png",
    );
  });

  it("detects absolute filesystem paths across platforms", () => {
    expect(isAbsoluteFsPath("/Users/test/pic.png")).toBe(true);
    expect(isAbsoluteFsPath("C:\\Users\\pic.png")).toBe(true);
    expect(isAbsoluteFsPath("c:/users/pic.png")).toBe(true);
    expect(isAbsoluteFsPath("\\\\server\\share\\pic.png")).toBe(true);
    expect(isAbsoluteFsPath("assets/pic.png")).toBe(false);
    expect(isAbsoluteFsPath("./pic.png")).toBe(false);
  });

  it("normalizes Windows paths and rejects traversal type segments", () => {
    expect(normalizeFsPath("C:\\Vault\\Work\\Note.md")).toBe(
      normalizeFsPath("c:/vault/work/note.md"),
    );
    expect(normalizeFsPath("//SERVER/Share/Note.md")).toBe(
      normalizeFsPath("\\\\server\\share\\note.md"),
    );
    expect(parseTypePath("../outside/research")).toEqual([
      "outside",
      "research",
    ]);
  });
});

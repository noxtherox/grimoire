import { describe, expect, it } from "vitest";
import { filterNotes } from "./filters";
import {
  type Note,
  buildTypeTree,
  getAllTypePaths,
  isExternalNote,
  normalizeFsPath,
  noteAbsolutePath,
  parseTypePath,
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

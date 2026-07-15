import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  stat as nodeStat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  picked: null as string | string[] | null,
  invoke: vi.fn(),
  failWrites: new Set<string>(),
  writeNewGate: null as Promise<void> | null,
  onCloseRequested: vi.fn().mockResolvedValue(() => {}),
  closeWindow: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: () => true,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: mocks.onCloseRequested,
    close: mocks.closeWindow,
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: () => Promise.resolve(mocks.picked),
}));

vi.mock("@tauri-apps/plugin-fs", async () => {
  const fs = await import("node:fs/promises");
  return {
    exists: async (path: string) =>
      fs
        .access(path)
        .then(() => true)
        .catch(() => false),
    mkdir: (path: string, options?: { recursive?: boolean }) =>
      fs.mkdir(path, options),
    readDir: async (path: string) =>
      (await fs.readdir(path, { withFileTypes: true })).map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      })),
    readFile: async (path: string) => new Uint8Array(await fs.readFile(path)),
    readTextFile: (path: string) => fs.readFile(path, "utf8"),
    remove: (path: string, options?: { recursive?: boolean }) =>
      fs.rm(path, { force: true, recursive: options?.recursive ?? false }),
    rename: (from: string, to: string) => fs.rename(from, to),
    stat: async (path: string) => {
      const info = await fs.stat(path);
      return { mtime: info.mtime };
    },
    writeFile: (path: string, bytes: Uint8Array) => fs.writeFile(path, bytes),
    writeTextFile: (
      path: string,
      content: string,
      options?: { createNew?: boolean },
    ) => {
      if (mocks.failWrites.has(path))
        throw new Error("simulated write failure");
      return fs.writeFile(path, content, {
        encoding: "utf8",
        flag: options?.createNew ? "wx" : "w",
      });
    },
  };
});

vi.mock("@/utils/toast", () => ({ showError: vi.fn() }));

import {
  closeExternalNote,
  getNotes,
  initStore,
  moveExternalNoteToVault,
  openExternalNotes,
  revealNoteInDesktop,
  updateNoteBody,
} from "./notes-store";
import { isExternalNote, noteTypePath } from "@/lib/note-utils";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
});

async function waitFor(
  check: () => boolean | Promise<boolean>,
  timeoutMs = 2_000,
) {
  const started = Date.now();
  while (!(await check())) {
    if (Date.now() - started > timeoutMs)
      throw new Error("Timed out waiting for store");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("external note store workflow", () => {
  let root: string;
  let vault: string;
  let firstPath: string;
  let secondPath: string;
  let missingPath: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "grimoire-external-test-"));
    root = await realpath(root);
    vault = join(root, "vault");
    firstPath = join(root, "one", "First external.md");
    secondPath = join(root, "two", "Second external.md");
    missingPath = join(root, "offline", "Temporarily unavailable.md");
    await Promise.all([
      mkdir(join(vault, "inbox"), { recursive: true }),
      mkdir(join(root, "one"), { recursive: true }),
      mkdir(join(root, "two"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(vault, "inbox", "Welcome.md"), "# Welcome\n", "utf8"),
      writeFile(firstPath, "# First external\n", "utf8"),
      writeFile(secondPath, "# Second external\n", "utf8"),
    ]);
    storage.set("grimoire.vaultPath", vault);
    storage.set(
      "grimoire.externalPaths",
      JSON.stringify([missingPath, join(vault, "inbox", "Welcome.md")]),
    );
    mocks.invoke.mockImplementation(
      async (command: string, args: Record<string, string>) => {
        if (command === "canonicalize_path") return realpath(args.path);
        if (command === "write_new_vault_file") {
          const gate = mocks.writeNewGate;
          mocks.writeNewGate = null;
          if (gate) await gate;
          const target = join(args.root, args.relativePath);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, args.content, {
            encoding: "utf8",
            flag: "wx",
          });
        }
      },
    );
    initStore();
    await waitFor(() =>
      getNotes().some((note) => note.path === "inbox/Welcome.md"),
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("opens, edits, reveals, closes, and moves files from different folders", async () => {
    expect(
      getNotes().filter((note) => note.path === "inbox/Welcome.md"),
    ).toHaveLength(1);
    mocks.picked = [firstPath, secondPath];
    const ids = await openExternalNotes();

    expect(ids).toHaveLength(2);
    const externalNotes = getNotes().filter(isExternalNote);
    expect(externalNotes.map((note) => note.externalPath)).toEqual([
      firstPath,
      secondPath,
    ]);
    expect(externalNotes.map(noteTypePath)).toEqual([[], []]);

    updateNoteBody(ids[0], "# First external\n\nEdited outside the vault.\n");
    await waitFor(async () =>
      (await readFile(firstPath, "utf8")).includes("Edited outside the vault."),
    );

    await revealNoteInDesktop(ids[0]);
    expect(mocks.invoke).toHaveBeenCalledWith("reveal_in_file_manager", {
      path: firstPath,
    });

    updateNoteBody(ids[1], "# Second external\n\nUnsaved edit.\n");
    mocks.failWrites.add(secondPath);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await closeExternalNote(ids[1]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
    expect(getNotes().some((note) => note.id === ids[1])).toBe(true);
    mocks.failWrites.delete(secondPath);
    await closeExternalNote(ids[1]);
    expect(getNotes().some((note) => note.id === ids[1])).toBe(false);
    await expect(nodeStat(secondPath)).resolves.toBeDefined();
    await expect(readFile(secondPath, "utf8")).resolves.toContain(
      "Unsaved edit.",
    );

    await expect(
      moveExternalNoteToVault(ids[0], ["..", "outside"]),
    ).resolves.toBe(false);
    await expect(nodeStat(firstPath)).resolves.toBeDefined();
    await mkdir(join(vault, "research"), { recursive: true });
    await writeFile(
      join(vault, "research", "First external.md"),
      "# Unrelated file\n",
      "utf8",
    );
    let releaseWriteNew!: () => void;
    mocks.writeNewGate = new Promise<void>((resolve) => {
      releaseWriteNew = resolve;
    });
    const move = moveExternalNoteToVault(ids[0], ["research"]);
    await waitFor(() =>
      mocks.invoke.mock.calls.some(
        ([command]) => command === "write_new_vault_file",
      ),
    );
    updateNoteBody(
      ids[0],
      "# First external\n\nLate edit must not be accepted.\n",
    );
    expect(
      getNotes().find((note) => note.id === ids[0])?.content,
    ).not.toContain("Late edit must not be accepted.");
    releaseWriteNew();
    await expect(move).resolves.toBe(true);
    const moved = getNotes().find((note) => note.id === ids[0]);
    expect(moved?.externalPath).toBeUndefined();
    expect(moved && noteTypePath(moved)).toEqual(["research"]);
    await expect(nodeStat(firstPath)).rejects.toThrow();
    await expect(
      readFile(join(vault, "research", "First external 2.md"), "utf8"),
    ).resolves.toContain("Edited outside the vault.");
    await expect(
      readFile(join(vault, "research", "First external.md"), "utf8"),
    ).resolves.toBe("# Unrelated file\n");

    updateNoteBody(ids[0], "# First external\n\nSaved during shutdown.\n");
    expect(mocks.onCloseRequested).toHaveBeenCalledOnce();
    const closeHandler = mocks.onCloseRequested.mock
      .calls[0][0] as unknown as (event: {
      preventDefault: () => void;
    }) => Promise<void>;
    const preventDefault = vi.fn();
    await closeHandler({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mocks.closeWindow).toHaveBeenCalledOnce();
    await expect(
      readFile(join(vault, "research", "First external 2.md"), "utf8"),
    ).resolves.toContain("Saved during shutdown.");

    expect(JSON.parse(storage.get("grimoire.externalPaths") ?? "[]")).toEqual([
      missingPath,
    ]);
  });
});

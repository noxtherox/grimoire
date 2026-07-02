import { useSyncExternalStore } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  DEFAULT_TYPE,
  TRASH_DIR,
  type Note,
  fileStem,
  isTrashed,
  logicalPath,
  noteTitle,
  noteTypePath,
  sanitizeFileStem,
  typeKey,
} from "@/lib/note-utils";
import type { VaultBackend } from "@/lib/vault/backend";
import { BrowserVault } from "@/lib/vault/browser";
import { DesktopVault } from "@/lib/vault/desktop";
import { showError } from "@/utils/toast";

const VAULT_PATH_KEY = "grimoire.vaultPath";
const FLUSH_DELAY_MS = 500;

export interface VaultState {
  status: "booting" | "pick-vault" | "loading" | "ready" | "error";
  /** Where notes are stored — absolute folder path on desktop. */
  location: string | null;
  isDesktop: boolean;
  notes: Note[];
  error: string | null;
}

let state: VaultState = {
  status: "booting",
  location: null,
  isDesktop: false,
  notes: [],
  error: null,
};

let backend: VaultBackend | null = null;
let initialized = false;
const listeners = new Set<() => void>();
const pendingFlush = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<VaultState>) {
  state = { ...state, ...patch };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVault(): VaultState {
  return useSyncExternalStore(subscribe, () => state);
}

export function getNotes(): Note[] {
  return state.notes;
}

// ---- pinned paths, persisted per vault ------------------------------------

function pinnedStorageKey(): string {
  return `grimoire.pinned.${state.location ?? "browser"}`;
}

function loadPinnedPaths(): Set<string> {
  try {
    const raw = localStorage.getItem(pinnedStorageKey());
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

function savePinnedPaths() {
  try {
    const paths = state.notes
      .filter((note) => note.pinned)
      .map((note) => logicalPath(note));
    localStorage.setItem(pinnedStorageKey(), JSON.stringify(paths));
  } catch {
    // ignore
  }
}

// ---- vault lifecycle -------------------------------------------------------

async function loadVault(nextBackend: VaultBackend) {
  backend = nextBackend;
  setState({
    status: "loading",
    location: nextBackend.location,
    isDesktop: nextBackend.kind === "desktop",
    notes: [],
    error: null,
  });
  try {
    const files = await nextBackend.loadAll();
    const pinned = loadPinnedPaths();
    const notes: Note[] = files.map((file) => ({
      id: crypto.randomUUID(),
      path: file.path,
      content: file.content,
      pinned: pinned.has(file.path),
      updatedAt: file.updatedAt,
    }));
    setState({ status: "ready", notes });
  } catch (error) {
    setState({ status: "error", error: String(error) });
  }
}

export function initStore() {
  if (initialized) return;
  initialized = true;
  if (isTauri()) {
    const saved = localStorage.getItem(VAULT_PATH_KEY);
    if (saved) {
      void loadVault(new DesktopVault(saved));
    } else {
      setState({ status: "pick-vault", isDesktop: true });
    }
  } else {
    void loadVault(new BrowserVault());
  }
}

export async function chooseVaultFolder() {
  const folder = await openDialog({
    directory: true,
    title: "Choose your Grimoire vault folder",
  });
  if (typeof folder !== "string" || !folder) return;
  localStorage.setItem(VAULT_PATH_KEY, folder);
  await loadVault(new DesktopVault(folder));
}

export async function reloadVault() {
  if (!backend) return;
  await flushAll();
  await loadVault(backend);
}

// ---- path helpers ----------------------------------------------------------

function takenPaths(exceptId?: string): Set<string> {
  return new Set(
    state.notes
      .filter((note) => note.id !== exceptId)
      .map((note) => note.path.toLowerCase()),
  );
}

function uniquePath(dir: string, stem: string, exceptId?: string): string {
  const taken = takenPaths(exceptId);
  const prefix = dir ? `${dir}/` : "";
  for (let n = 0; ; n++) {
    const candidate = `${prefix}${stem}${n === 0 ? "" : ` ${n + 1}`}.md`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function updateNote(id: string, patch: Partial<Note>) {
  setState({
    notes: state.notes.map((note) =>
      note.id === id ? { ...note, ...patch } : note,
    ),
  });
}

function reportError(action: string, error: unknown) {
  console.error(`Grimoire: failed to ${action}`, error);
  showError(`Failed to ${action}: ${error}`);
}

// ---- content editing with debounced file sync ------------------------------

export function updateNoteContent(id: string, content: string) {
  updateNote(id, { content, updatedAt: new Date().toISOString() });
  const existing = pendingFlush.get(id);
  if (existing) clearTimeout(existing);
  pendingFlush.set(
    id,
    setTimeout(() => void flushNote(id), FLUSH_DELAY_MS),
  );
}

/** Writes pending content to disk, renaming the file if the title changed. */
async function flushNote(id: string) {
  pendingFlush.delete(id);
  const note = state.notes.find((candidate) => candidate.id === id);
  if (!note || !backend) return;
  try {
    let path = note.path;
    const desiredStem = sanitizeFileStem(noteTitle(note));
    if (desiredStem !== fileStem(note.path) && !isTrashed(note)) {
      const dir = note.path.split("/").slice(0, -1).join("/");
      const target = uniquePath(dir, desiredStem, id);
      await backend.move(note.path, target);
      path = target;
      updateNote(id, { path });
      savePinnedPaths();
    }
    await backend.write(path, note.content);
  } catch (error) {
    reportError("save note", error);
  }
}

async function flushAll() {
  const ids = [...pendingFlush.keys()];
  for (const id of ids) {
    const timer = pendingFlush.get(id);
    if (timer) clearTimeout(timer);
    await flushNote(id);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    void flushAll();
  });
}

// ---- note operations -------------------------------------------------------

export async function createNote(
  typePath: string[] = DEFAULT_TYPE,
  content = "",
): Promise<Note | null> {
  if (!backend) return null;
  const dir = typeKey(typePath.length ? typePath : DEFAULT_TYPE);
  const stem = sanitizeFileStem(
    content ? noteTitle({ content, path: "" } as Note) : "Untitled",
  );
  const path = uniquePath(dir, stem);
  const note: Note = {
    id: crypto.randomUUID(),
    path,
    content,
    pinned: false,
    updatedAt: new Date().toISOString(),
  };
  setState({ notes: [note, ...state.notes] });
  try {
    await backend.write(path, content);
  } catch (error) {
    reportError("create note", error);
  }
  return note;
}

export async function setNoteType(id: string, typePath: string[]) {
  if (!backend) return;
  await flushAll();
  const note = state.notes.find((candidate) => candidate.id === id);
  if (!note || isTrashed(note) || !typePath.length) return;
  if (typeKey(noteTypePath(note)) === typeKey(typePath)) return;
  const target = uniquePath(typeKey(typePath), fileStem(note.path), id);
  try {
    await backend.move(note.path, target);
    updateNote(id, { path: target });
    savePinnedPaths();
  } catch (error) {
    reportError("move note", error);
  }
}

export function toggleNotePinned(id: string) {
  const note = state.notes.find((candidate) => candidate.id === id);
  if (!note) return;
  updateNote(id, { pinned: !note.pinned });
  savePinnedPaths();
}

export async function trashNote(id: string) {
  if (!backend) return;
  await flushAll();
  const note = state.notes.find((candidate) => candidate.id === id);
  if (!note || isTrashed(note)) return;
  const dir = [TRASH_DIR, ...noteTypePath(note)].join("/");
  const target = uniquePath(dir, fileStem(note.path), id);
  try {
    await backend.move(note.path, target);
    updateNote(id, { path: target, pinned: false });
    savePinnedPaths();
  } catch (error) {
    reportError("trash note", error);
  }
}

export async function restoreNote(id: string) {
  if (!backend) return;
  const note = state.notes.find((candidate) => candidate.id === id);
  if (!note || !isTrashed(note)) return;
  const logical = logicalPath(note);
  const dir = logical.split("/").slice(0, -1).join("/");
  const target = uniquePath(dir, fileStem(logical), id);
  try {
    await backend.move(note.path, target);
    updateNote(id, { path: target });
  } catch (error) {
    reportError("restore note", error);
  }
}

export async function deleteNoteForever(id: string) {
  if (!backend) return;
  const note = state.notes.find((candidate) => candidate.id === id);
  if (!note) return;
  try {
    await backend.removeFile(note.path);
    setState({ notes: state.notes.filter((candidate) => candidate.id !== id) });
  } catch (error) {
    reportError("delete note", error);
  }
}

export async function emptyTrash() {
  if (!backend) return;
  const trashed = state.notes.filter((note) => isTrashed(note));
  for (const note of trashed) {
    try {
      await backend.removeFile(note.path);
    } catch (error) {
      reportError("empty trash", error);
      return;
    }
  }
  setState({ notes: state.notes.filter((note) => !isTrashed(note)) });
}

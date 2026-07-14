import { useSyncExternalStore } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  DEFAULT_TYPE,
  MAX_TYPE_DEPTH,
  TRASH_DIR,
  type Note,
  fileStem,
  getAllTypePaths,
  isRemoteUrl,
  isTrashed,
  logicalPath,
  noteTitle,
  noteTypePath,
  notesOfTypeKey,
  sanitizeFileStem,
  typeKey,
} from "@/lib/note-utils";
import {
  type PropertyValue,
  renameContentProperty,
  setContentProperty,
  withBody,
} from "@/lib/frontmatter";
import {
  type PropertyDef,
  type PropertySchemas,
  hoistSchemasToTopLevel,
} from "@/lib/properties";
import {
  type TypeIcons,
  isEmojiValue,
  suggestIconForType,
} from "@/lib/type-icons";
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
  /** Types that exist as folders even without notes in them (empty types). */
  extraTypes: string[][];
  /** Property definitions, keyed by top-level type key ("work"). */
  schemas: PropertySchemas;
  /** Custom lucide icon per type, keyed by full type key ("work/projects"). */
  typeIcons: TypeIcons;
  error: string | null;
}

let state: VaultState = {
  status: "booting",
  location: null,
  isDesktop: false,
  notes: [],
  extraTypes: [],
  schemas: {},
  typeIcons: {},
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

const SCHEMAS_PATH = ".grimoire/properties.json";

async function loadSchemas(fromBackend: VaultBackend): Promise<PropertySchemas> {
  try {
    const raw = await fromBackend.readText(SCHEMAS_PATH);
    const parsed = JSON.parse(raw) as PropertySchemas;
    if (!parsed || typeof parsed !== "object") return {};
    // one-time migration: older vaults stored definitions per sub-type
    const hoisted = hoistSchemasToTopLevel(parsed);
    if (!hoisted) return parsed;
    await fromBackend
      .write(SCHEMAS_PATH, JSON.stringify(hoisted, null, 2))
      .catch(() => {}); // keep the hoisted view even if the write fails
    return hoisted;
  } catch {
    return {}; // missing or unreadable — start empty
  }
}

const TYPE_ICONS_PATH = ".grimoire/type-icons.json";

async function loadTypeIcons(fromBackend: VaultBackend): Promise<TypeIcons> {
  try {
    const raw = await fromBackend.readText(TYPE_ICONS_PATH);
    const parsed = JSON.parse(raw) as TypeIcons;
    if (!parsed || typeof parsed !== "object") return {};
    // keep only emoji values — drops entries from the short-lived lucide format
    const typeIcons: TypeIcons = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isEmojiValue(value)) typeIcons[key] = value;
    }
    return typeIcons;
  } catch {
    return {}; // missing or unreadable — start empty
  }
}

async function loadVault(nextBackend: VaultBackend) {
  backend = nextBackend;
  clearImageUrlCache();
  setState({
    status: "loading",
    location: nextBackend.location,
    isDesktop: nextBackend.kind === "desktop",
    notes: [],
    extraTypes: [],
    schemas: {},
    typeIcons: {},
    error: null,
  });
  try {
    const [files, schemas, dirs, typeIcons] = await Promise.all([
      nextBackend.loadAll(),
      loadSchemas(nextBackend),
      nextBackend.listDirs(),
      loadTypeIcons(nextBackend),
    ]);
    const pinned = loadPinnedPaths();
    const notes: Note[] = files.map((file) => ({
      id: crypto.randomUUID(),
      path: file.path,
      content: file.content,
      pinned: pinned.has(file.path),
      updatedAt: file.updatedAt,
    }));
    // folders are types — except the assets folder, which holds images
    const extraTypes = dirs
      .filter((dir) => dir !== IMAGE_DIR && !dir.startsWith(`${IMAGE_DIR}/`))
      .map((dir) => dir.split("/").slice(0, MAX_TYPE_DEPTH));
    setState({ status: "ready", notes, extraTypes, schemas, typeIcons });
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

// ---- images ------------------------------------------------------------------

const IMAGE_DIR = "assets";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

const imageUrlCache = new Map<string, Promise<string | null>>();

function clearImageUrlCache() {
  for (const pending of imageUrlCache.values()) {
    void pending.then((url) => {
      if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
  }
  imageUrlCache.clear();
}

/**
 * Resolves a vault-relative image path to a displayable URL (a blob URL backed
 * by the vault file). Remote URLs pass through untouched.
 */
export function getImageUrl(path: string): Promise<string | null> {
  if (isRemoteUrl(path)) return Promise.resolve(path);
  let cached = imageUrlCache.get(path);
  if (!cached) {
    cached = (async () => {
      if (!backend) return null;
      try {
        const bytes = await backend.readBinary(decodeURI(path));
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const type = MIME_BY_EXT[ext] ?? "application/octet-stream";
        return URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
      } catch {
        return null;
      }
    })();
    imageUrlCache.set(path, cached);
  }
  return cached;
}

/**
 * Saves pasted/dropped image bytes into the vault's assets folder and returns
 * the vault-relative path to reference from markdown, or null on failure.
 */
export async function savePastedImage(
  bytes: Uint8Array,
  mime: string,
): Promise<string | null> {
  if (!backend) return null;
  const ext = EXT_BY_MIME[mime] ?? "png";
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  let path = "";
  for (let n = 0; ; n++) {
    path = `${IMAGE_DIR}/pasted-${stamp}${n === 0 ? "" : `-${n}`}.${ext}`;
    if (!(await backend.exists(path))) break;
  }
  try {
    await backend.writeBinary(path, bytes);
  } catch (error) {
    reportError("save image", error);
    return null;
  }
  return path;
}

// ---- note properties & per-type definitions ---------------------------------

function saveSchemas(schemas: PropertySchemas) {
  setState({ schemas });
  if (!backend) return;
  backend
    .write(SCHEMAS_PATH, JSON.stringify(schemas, null, 2))
    .catch((error) => reportError("save property definitions", error));
}

function notesOfType(ownerKey: string): Note[] {
  return notesOfTypeKey(state.notes, ownerKey);
}

/** Definitions always live on the top-level type, whatever key callers pass. */
function schemaOwnerKey(typeKeyOrPath: string): string {
  return typeKeyOrPath.split("/")[0];
}

export function addTypeProperty(typeKeyOrPath: string, def: PropertyDef) {
  const ownerKey = schemaOwnerKey(typeKeyOrPath);
  const defs = state.schemas[ownerKey] ?? [];
  if (defs.some((d) => d.name.toLowerCase() === def.name.toLowerCase())) return;
  saveSchemas({ ...state.schemas, [ownerKey]: [...defs, def] });
}

/** Edits a property definition; a rename migrates the key in every note of the type. */
export function updateTypeProperty(
  typeKeyOrPath: string,
  oldName: string,
  def: PropertyDef,
) {
  const ownerKey = schemaOwnerKey(typeKeyOrPath);
  const defs = state.schemas[ownerKey] ?? [];
  const idx = defs.findIndex(
    (d) => d.name.toLowerCase() === oldName.toLowerCase(),
  );
  if (idx < 0) return;
  const collides = defs.some(
    (d, i) => i !== idx && d.name.toLowerCase() === def.name.toLowerCase(),
  );
  if (collides) return;
  const next = defs.slice();
  next[idx] = def;
  saveSchemas({ ...state.schemas, [ownerKey]: next });
  if (def.name !== oldName) {
    for (const note of notesOfType(ownerKey)) {
      const migrated = renameContentProperty(note.content, oldName, def.name);
      if (migrated !== note.content) updateNoteContent(note.id, migrated);
    }
  }
}

/** Deletes a property from the type and strips its value from the type's notes. */
export function removeTypeProperty(typeKeyOrPath: string, name: string) {
  const ownerKey = schemaOwnerKey(typeKeyOrPath);
  const defs = state.schemas[ownerKey] ?? [];
  const next = defs.filter((d) => d.name.toLowerCase() !== name.toLowerCase());
  if (next.length === defs.length) return;
  const schemas = { ...state.schemas };
  if (next.length) schemas[ownerKey] = next;
  else delete schemas[ownerKey];
  saveSchemas(schemas);
  for (const note of notesOfType(ownerKey)) {
    const stripped = setContentProperty(note.content, name, null);
    if (stripped !== note.content) updateNoteContent(note.id, stripped);
  }
}

/** Sets (or with `null`, clears) one property value in a note's frontmatter. */
export function setNoteProperty(
  id: string,
  name: string,
  value: PropertyValue | null,
) {
  const note = state.notes.find((candidate) => candidate.id === id);
  if (!note) return;
  const next = setContentProperty(note.content, name, value);
  if (next !== note.content) updateNoteContent(id, next);
}

/** Replaces the note body from the editor, preserving frontmatter properties. */
export function updateNoteBody(id: string, body: string) {
  const note = state.notes.find((candidate) => candidate.id === id);
  if (!note) return;
  const next = withBody(note.content, body);
  if (next !== note.content) updateNoteContent(id, next);
}

// ---- type icons ---------------------------------------------------------------

function saveTypeIcons(typeIcons: TypeIcons) {
  setState({ typeIcons });
  if (!backend) return;
  backend
    .write(TYPE_ICONS_PATH, JSON.stringify(typeIcons, null, 2))
    .catch((error) => reportError("save type icons", error));
}

/** Sets (or with `null`, resets to the default folder) a type's emoji. */
export function setTypeIcon(typePath: string[], icon: string | null) {
  const key = typeKey(typePath);
  if (!key) return;
  const typeIcons = { ...state.typeIcons };
  if (icon) typeIcons[key] = icon;
  else delete typeIcons[key];
  saveTypeIcons(typeIcons);
}

/**
 * Guesses emoji for type levels that didn't exist before (e.g. creating
 * "work/recipes" suggests for both "work" and "work/recipes" if both are new).
 * Never touches types that already existed or already have an icon.
 */
async function suggestIconsForNewType(
  typePath: string[],
  existedKeys: Set<string>,
) {
  const suggestions: Array<[string, string]> = [];
  for (let depth = 1; depth <= typePath.length; depth++) {
    const key = typeKey(typePath.slice(0, depth));
    if (existedKeys.has(key) || state.typeIcons[key]) continue;
    const suggested = await suggestIconForType(typePath[depth - 1]);
    if (suggested) suggestions.push([key, suggested]);
  }
  if (!suggestions.length) return;
  const typeIcons = { ...state.typeIcons };
  for (const [key, icon] of suggestions) {
    if (!typeIcons[key]) typeIcons[key] = icon;
  }
  saveTypeIcons(typeIcons);
}

function existingTypeKeys(): Set<string> {
  return new Set(
    getAllTypePaths(state.notes, state.extraTypes).map((path) =>
      typeKey(path),
    ),
  );
}

// ---- type operations ---------------------------------------------------------

/**
 * Creates a type (a folder) without putting any note in it — empty types are
 * fine and show up in the sidebar with a count of 0.
 */
export async function createType(typePath: string[]): Promise<boolean> {
  if (!backend || !typePath.length) return false;
  const key = typeKey(typePath);
  const existedKeys = existingTypeKeys();
  try {
    await backend.mkDir(key);
  } catch (error) {
    reportError("create type", error);
    return false;
  }
  if (!state.extraTypes.some((path) => typeKey(path) === key)) {
    setState({ extraTypes: [...state.extraTypes, typePath] });
  }
  await suggestIconsForNewType(typePath, existedKeys);
  return true;
}

/**
 * Deletes a type (and its sub-types): every note in it is moved to Trash
 * first — recoverable via restore — then the now-empty folder is removed.
 */
export async function deleteType(typePath: string[]): Promise<boolean> {
  if (!backend || !typePath.length) return false;
  const key = typeKey(typePath);
  await flushAll();
  for (const note of notesOfType(key)) {
    await trashNote(note.id);
  }
  try {
    await backend.removeDir(key);
  } catch (error) {
    reportError("delete type", error);
    return false;
  }
  const schemas = { ...state.schemas };
  let schemasChanged = false;
  for (const schemaKey of Object.keys(schemas)) {
    if (schemaKey === key || schemaKey.startsWith(`${key}/`)) {
      delete schemas[schemaKey];
      schemasChanged = true;
    }
  }
  if (schemasChanged) saveSchemas(schemas);
  const typeIcons = { ...state.typeIcons };
  let iconsChanged = false;
  for (const iconKey of Object.keys(typeIcons)) {
    if (iconKey === key || iconKey.startsWith(`${key}/`)) {
      delete typeIcons[iconKey];
      iconsChanged = true;
    }
  }
  if (iconsChanged) saveTypeIcons(typeIcons);
  setState({
    extraTypes: state.extraTypes.filter((path) => {
      const otherKey = typeKey(path);
      return otherKey !== key && !otherKey.startsWith(`${key}/`);
    }),
  });
  return true;
}

/**
 * Renames (and/or moves) a type: renames its folder on disk, then updates
 * every note path, sub-type, property schema, and relation reference under
 * the old key so nothing is left pointing at the stale path.
 */
export async function renameType(
  oldPath: string[],
  newPath: string[],
): Promise<boolean> {
  if (!backend || !oldPath.length || !newPath.length) return false;
  const oldKey = typeKey(oldPath);
  const newKey = typeKey(newPath);
  if (oldKey === newKey) return true;
  const collides = getAllTypePaths(state.notes, state.extraTypes).some(
    (path) => typeKey(path) === newKey,
  );
  if (collides) {
    reportError("rename type", `a type named "${newKey}" already exists`);
    return false;
  }
  await flushAll();
  try {
    await backend.renameDir(oldKey, newKey);
  } catch (error) {
    reportError("rename type", error);
    return false;
  }

  const oldPrefix = `${oldKey}/`;
  const newPrefix = `${newKey}/`;
  const remapKey = (key: string): string =>
    key === oldKey ? newKey : newPrefix + key.slice(oldPrefix.length);

  const notes = state.notes.map((note) =>
    note.path.startsWith(oldPrefix)
      ? { ...note, path: newPrefix + note.path.slice(oldPrefix.length) }
      : note,
  );

  const extraTypes = state.extraTypes.map((path) => {
    const key = typeKey(path);
    if (key !== oldKey && !key.startsWith(oldPrefix)) return path;
    return remapKey(key).split("/");
  });

  const schemas: PropertySchemas = {};
  let schemasChanged = false;
  for (const [key, defs] of Object.entries(state.schemas)) {
    const migrated = defs.map((def) => {
      if (
        !def.relationTypeKey ||
        (def.relationTypeKey !== oldKey &&
          !def.relationTypeKey.startsWith(oldPrefix))
      ) {
        return def;
      }
      schemasChanged = true;
      return { ...def, relationTypeKey: remapKey(def.relationTypeKey) };
    });
    if (key === oldKey || key.startsWith(oldPrefix)) {
      schemas[remapKey(key)] = migrated;
      schemasChanged = true;
    } else {
      schemas[key] = migrated;
    }
  }

  const typeIcons: TypeIcons = {};
  let iconsChanged = false;
  for (const [key, icon] of Object.entries(state.typeIcons)) {
    if (key === oldKey || key.startsWith(oldPrefix)) {
      typeIcons[remapKey(key)] = icon;
      iconsChanged = true;
    } else {
      typeIcons[key] = icon;
    }
  }

  setState({ notes, extraTypes });
  savePinnedPaths();
  if (schemasChanged) saveSchemas(schemas);
  if (iconsChanged) saveTypeIcons(typeIcons);
  return true;
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
  // the move may create the type — capture what existed before to only
  // suggest icons for genuinely new type levels
  const existedKeys = existingTypeKeys();
  const target = uniquePath(typeKey(typePath), fileStem(note.path), id);
  try {
    await backend.move(note.path, target);
    updateNote(id, { path: target });
    savePinnedPaths();
    await suggestIconsForNewType(typePath, existedKeys);
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

import { noteBody } from "@/lib/frontmatter";

export const TRASH_DIR = ".trash";
export const MAX_TYPE_DEPTH = 3;
export const DEFAULT_TYPE: string[] = ["inbox"];

/**
 * A note is a markdown file inside the vault. `path` is its vault-relative
 * path (forward slashes); the folders it sits in are its type hierarchy:
 * type / sub-type / sub-sub-type. Trashed notes keep their original relative
 * path under `.trash/`.
 */
export interface Note {
  id: string; // stable for the session; the path may change on rename/move
  path: string;
  content: string;
  pinned: boolean;
  updatedAt: string;
}

export const WIKILINK_REGEX = /\[\[([^[\]]+)\]\]/g;

/**
 * Markdown image: `![alt](path)`. An optional `|width` suffix in the alt text
 * (`![screenshot|320](assets/foo.png)`) sets the preview width in pixels —
 * the same convention Obsidian uses.
 */
export const IMAGE_MD_REGEX = /!\[([^\]]*)\]\(([^()\s]+)\)/g;

export function isRemoteUrl(path: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path);
}

/** Splits `alt|320` into the plain alt text and the width, if present. */
export function parseImageAlt(alt: string): {
  alt: string;
  width: number | null;
} {
  const match = alt.match(/^(.*?)\|(\d+)$/);
  if (!match) return { alt, width: null };
  return { alt: match[1], width: parseInt(match[2], 10) };
}

export function formatImageMarkdown(
  alt: string,
  width: number | null,
  path: string,
): string {
  return `![${width ? `${alt}|${width}` : alt}](${path})`;
}

export function isTrashed(note: Note): boolean {
  return note.path.startsWith(`${TRASH_DIR}/`);
}

/** Vault-relative path ignoring the .trash prefix. */
export function logicalPath(note: Note): string {
  return isTrashed(note) ? note.path.slice(TRASH_DIR.length + 1) : note.path;
}

/** Folder segments of the note, clamped to the max type depth. */
export function noteTypePath(note: Note): string[] {
  const segments = logicalPath(note).split("/");
  return segments.slice(0, -1).slice(0, MAX_TYPE_DEPTH);
}

export function typeKey(typePath: string[]): string {
  return typePath.join("/");
}

/** Non-trashed notes of the given type, including its sub-types. */
export function notesOfTypeKey(notes: Note[], ownerKey: string): Note[] {
  return notes.filter((note) => {
    if (isTrashed(note)) return false;
    const key = typeKey(noteTypePath(note));
    return key === ownerKey || key.startsWith(`${ownerKey}/`);
  });
}

export function fileStem(path: string): string {
  const name = path.split("/").pop() ?? "";
  return name.replace(/\.md$/i, "");
}

/** Title = first non-empty body line (frontmatter excluded), else the filename. */
export function noteTitle(note: Note): string {
  const firstLine = noteBody(note.content)
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return fileStem(note.path) || "Untitled";
  return firstLine.replace(/^#{1,6}\s+/, "").trim() || "Untitled";
}

export function noteSnippet(note: Note): string {
  const lines = noteBody(note.content)
    .split("\n")
    .map((line) => line.trim());
  const firstIdx = lines.findIndex((line) => line.length > 0);
  const rest = lines
    .slice(firstIdx + 1)
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(WIKILINK_REGEX, "$1")
    .replace(/[#*_`>]/g, "")
    .trim();
  return rest.slice(0, 120);
}

export function getOutgoingLinkTitles(content: string): string[] {
  const titles: string[] = [];
  for (const match of noteBody(content).matchAll(WIKILINK_REGEX)) {
    titles.push(match[1].trim());
  }
  return titles;
}

export function findNoteByTitle(
  title: string,
  notes: Note[],
): Note | undefined {
  const needle = title.trim().toLowerCase();
  return notes.find(
    (note) => !isTrashed(note) && noteTitle(note).toLowerCase() === needle,
  );
}

/**
 * Notes that link to `target`, grouped by each linking note's type path —
 * the type is what organizes the backlinks section.
 */
export function getBacklinksGroupedByType(
  target: Note,
  notes: Note[],
): Map<string, Note[]> {
  const targetTitle = noteTitle(target).toLowerCase();
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    if (isTrashed(note) || note.id === target.id) continue;
    const linksToTarget = getOutgoingLinkTitles(note.content).some(
      (title) => title.toLowerCase() === targetTitle,
    );
    if (!linksToTarget) continue;
    const key = typeKey(noteTypePath(note));
    const group = groups.get(key) ?? [];
    group.push(note);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export interface TypeNode {
  name: string;
  path: string[];
  count: number; // notes in this type and all sub-types
  children: TypeNode[];
}

/**
 * Builds the type tree (max 3 levels) from non-trashed notes, plus
 * `extraTypePaths` — types that exist as folders but hold no notes yet.
 */
export function buildTypeTree(
  notes: Note[],
  extraTypePaths: string[][] = [],
): TypeNode[] {
  const roots: TypeNode[] = [];
  const ensureChild = (list: TypeNode[], name: string, path: string[]) => {
    let node = list.find((child) => child.name === name);
    if (!node) {
      node = { name, path, count: 0, children: [] };
      list.push(node);
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return node;
  };
  const addPath = (typePath: string[], countDelta: number) => {
    let level = roots;
    for (let depth = 0; depth < typePath.length; depth++) {
      const node = ensureChild(
        level,
        typePath[depth],
        typePath.slice(0, depth + 1),
      );
      node.count += countDelta;
      level = node.children;
    }
  };
  for (const typePath of extraTypePaths) {
    addPath(typePath.slice(0, MAX_TYPE_DEPTH), 0);
  }
  for (const note of notes) {
    if (isTrashed(note)) continue;
    addPath(noteTypePath(note), 1);
  }
  return roots;
}

/** All distinct type paths in use, including intermediate levels. */
export function getAllTypePaths(
  notes: Note[],
  extraTypePaths: string[][] = [],
): string[][] {
  const seen = new Map<string, string[]>();
  const add = (typePath: string[]) => {
    const clamped = typePath.slice(0, MAX_TYPE_DEPTH);
    for (let depth = 1; depth <= clamped.length; depth++) {
      const prefix = clamped.slice(0, depth);
      seen.set(typeKey(prefix), prefix);
    }
  };
  for (const typePath of extraTypePaths) add(typePath);
  for (const note of notes) {
    if (!isTrashed(note)) add(noteTypePath(note));
  }
  return [...seen.values()].sort((a, b) =>
    typeKey(a).localeCompare(typeKey(b)),
  );
}

/** Normalizes user input like " Work / Sub Type " into a valid type path. */
export function parseTypePath(input: string): string[] {
  return input
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .toLowerCase()
        .replace(/[\\:*?"<>|#[\]]/g, "")
        .replace(/\s+/g, "-"),
    )
    .filter((segment) => segment.length > 0 && segment !== TRASH_DIR)
    .slice(0, MAX_TYPE_DEPTH);
}

/** A safe filename (without extension) derived from a note title. */
export function sanitizeFileStem(title: string): string {
  const stem = title
    .replace(/[/\\:*?"<>|#[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, 120)
    .trim();
  return stem || "Untitled";
}

export function noteMatchesSearch(note: Note, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    note.content.toLowerCase().includes(q) ||
    typeKey(noteTypePath(note)).toLowerCase().includes(q) ||
    fileStem(note.path).toLowerCase().includes(q)
  );
}

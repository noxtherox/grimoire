export interface Note {
  id: string;
  content: string;
  mainTag: string;
  pinned: boolean;
  trashed: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_MAIN_TAG = "inbox";

export const WIKILINK_REGEX = /\[\[([^[\]]+)\]\]/g;
export const INLINE_TAG_REGEX = /(^|\s)#([\p{L}\p{N}][\p{L}\p{N}/_-]*)/gu;

export function getNoteTitle(content: string): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "Untitled";
  return firstLine.replace(/^#{1,6}\s+/, "").trim() || "Untitled";
}

export function getNoteSnippet(content: string): string {
  const lines = content.split("\n").map((line) => line.trim());
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
  for (const match of content.matchAll(WIKILINK_REGEX)) {
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
    (note) =>
      !note.trashed && getNoteTitle(note.content).toLowerCase() === needle,
  );
}

/**
 * Notes that link to `target`, grouped by each linking note's main tag —
 * the main tag is what organizes the backlinks section.
 */
export function getBacklinksGroupedByMainTag(
  target: Note,
  notes: Note[],
): Map<string, Note[]> {
  const targetTitle = getNoteTitle(target.content).toLowerCase();
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    if (note.trashed || note.id === target.id) continue;
    const linksToTarget = getOutgoingLinkTitles(note.content).some(
      (title) => title.toLowerCase() === targetTitle,
    );
    if (!linksToTarget) continue;
    const group = groups.get(note.mainTag) ?? [];
    group.push(note);
    groups.set(note.mainTag, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** All main tags in use (excluding trashed notes), with note counts. */
export function getMainTagCounts(notes: Note[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const note of notes) {
    if (note.trashed) continue;
    counts.set(note.mainTag, (counts.get(note.mainTag) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function noteMatchesSearch(note: Note, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    note.content.toLowerCase().includes(q) ||
    note.mainTag.toLowerCase().includes(q)
  );
}

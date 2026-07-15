import { getNoteProperties } from "@/lib/frontmatter";
import { effectiveProperties, type PropertySchemas } from "@/lib/properties";
import {
  type Note,
  getOutgoingLinkTitles,
  isExternalNote,
  isTrashed,
  noteTitle,
  noteTypePath,
  typeKey,
} from "@/lib/note-utils";

/** Titles referenced by this note's relation properties. */
export function getOutgoingRelationTitles(
  content: string,
  typePath: string[],
  schemas: PropertySchemas,
): string[] {
  const props = getNoteProperties(content);
  const titles: string[] = [];
  for (const def of effectiveProperties(typePath, schemas)) {
    if (def.type !== "relation") continue;
    const value = props[def.name];
    if (value == null) continue;
    for (const title of Array.isArray(value) ? value : [value]) {
      if (typeof title === "string" && title.trim()) titles.push(title.trim());
    }
  }
  return titles;
}

/** All titles this note links to: body wikilinks plus relation properties. */
export function getOutgoingTitles(
  note: Note,
  schemas: PropertySchemas,
): string[] {
  return [
    ...getOutgoingLinkTitles(note.content),
    ...getOutgoingRelationTitles(note.content, noteTypePath(note), schemas),
  ];
}

/**
 * Notes that link to `target` — via body wikilinks or relation properties —
 * grouped by each linking note's type path.
 */
export function getBacklinksGroupedByType(
  target: Note,
  notes: Note[],
  schemas: PropertySchemas,
): Map<string, Note[]> {
  const targetTitle = noteTitle(target).toLowerCase();
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    if (isExternalNote(note) || isTrashed(note) || note.id === target.id)
      continue;
    const linksToTarget = getOutgoingTitles(note, schemas).some(
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

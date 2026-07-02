import {
  type Note,
  isTrashed,
  noteMatchesSearch,
  noteTypePath,
  typeKey,
} from "@/lib/note-utils";

export type NoteFilter =
  | { kind: "all" }
  | { kind: "type"; path: string[] }
  | { kind: "trash" };

/** Type filters include notes in sub-types (folder and its subfolders). */
export function filterNotes(
  notes: Note[],
  filter: NoteFilter,
  search: string,
): Note[] {
  const visible = notes.filter((note) => {
    if (filter.kind === "trash") return isTrashed(note);
    if (isTrashed(note)) return false;
    if (filter.kind === "type") {
      const prefix = typeKey(filter.path);
      const key = typeKey(noteTypePath(note));
      return key === prefix || key.startsWith(`${prefix}/`);
    }
    return true;
  });
  return visible
    .filter((note) => noteMatchesSearch(note, search))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

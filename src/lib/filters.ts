import { type Note, noteMatchesSearch } from "@/lib/note-utils";

export type NoteFilter =
  | { kind: "all" }
  | { kind: "tag"; tag: string }
  | { kind: "trash" };

export function filterNotes(
  notes: Note[],
  filter: NoteFilter,
  search: string,
): Note[] {
  const visible = notes.filter((note) => {
    if (filter.kind === "trash") return note.trashed;
    if (note.trashed) return false;
    if (filter.kind === "tag") return note.mainTag === filter.tag;
    return true;
  });
  return visible
    .filter((note) => noteMatchesSearch(note, search))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

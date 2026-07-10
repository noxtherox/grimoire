import { Folder, Link2 } from "lucide-react";
import { PropertiesSection } from "./PropertiesSection";
import {
  type Note,
  getBacklinksGroupedByType,
  isTrashed,
  noteSnippet,
  noteTitle,
} from "@/lib/note-utils";

interface BacklinksPanelProps {
  note: Note;
  allNotes: Note[];
  onOpenNote: (id: string) => void;
}

export function BacklinksPanel({
  note,
  allNotes,
  onOpenNote,
}: BacklinksPanelProps) {
  const groups = getBacklinksGroupedByType(note, allNotes);
  const total = [...groups.values()].reduce(
    (sum, group) => sum + group.length,
    0,
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border/60 bg-[hsl(40_20%_98%)]">
      {!isTrashed(note) && <PropertiesSection note={note} />}
      <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Link2 size={13} />
        Backlinks
        {total > 0 && (
          <span className="rounded-full bg-muted px-1.5 tabular-nums">
            {total}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 px-4 py-3">
        {total === 0 ? (
          <p className="text-xs text-muted-foreground">
            No notes link here yet. Reference this note elsewhere with{" "}
            <code className="rounded bg-muted px-1">
              [[{noteTitle(note)}]]
            </code>
            .
          </p>
        ) : (
          <div className="space-y-4">
            {[...groups.entries()].map(([type, linkingNotes]) => (
              <div key={type}>
                <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-[hsl(4_50%_45%)]">
                  <Folder size={12} />
                  {type ? type.split("/").join(" / ") : "unfiled"}
                  <span className="text-muted-foreground">
                    · {linkingNotes.length}
                  </span>
                </div>
                <ul className="space-y-1">
                  {linkingNotes.map((linkingNote) => (
                    <li key={linkingNote.id}>
                      <button
                        onClick={() => onOpenNote(linkingNote.id)}
                        className="block w-full rounded-md border border-border/50 bg-white px-3 py-2 text-left transition-colors hover:border-[hsl(4_66%_55%/0.4)] hover:bg-[hsl(4_66%_55%/0.04)]"
                      >
                        <span className="block truncate text-sm font-medium text-[hsl(211_90%_40%)]">
                          {noteTitle(linkingNote)}
                        </span>
                        {noteSnippet(linkingNote) && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {noteSnippet(linkingNote)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

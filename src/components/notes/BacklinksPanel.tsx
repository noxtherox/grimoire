import { Folder, Link2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertiesSection } from "./PropertiesSection";
import { getBacklinksGroupedByType } from "@/lib/links";
import { type Note, isTrashed, noteSnippet, noteTitle } from "@/lib/note-utils";
import type { PropertySchemas } from "@/lib/properties";
import { cn } from "@/lib/utils";

interface BacklinksPanelProps {
  note: Note;
  allNotes: Note[];
  schemas: PropertySchemas;
  onOpenNote: (id: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function BacklinksPanel({
  note,
  allNotes,
  schemas,
  onOpenNote,
  expanded,
  onToggleExpanded,
}: BacklinksPanelProps) {
  const groups = getBacklinksGroupedByType(note, allNotes, schemas);
  const total = [...groups.values()].reduce(
    (sum, group) => sum + group.length,
    0,
  );

  return (
    <aside
      className={cn(
        "flex flex-col overflow-y-auto border-l border-border/60 bg-[hsl(40_20%_98%)]",
        expanded ? "min-w-0 flex-1" : "w-72 shrink-0",
      )}
    >
      <div className="flex items-center justify-end border-b border-border/60 px-2 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title={expanded ? "Collapse panel" : "Expand panel to full width"}
          onClick={onToggleExpanded}
        >
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </Button>
      </div>
      {!isTrashed(note) && (
        <PropertiesSection
          note={note}
          allNotes={allNotes}
          onOpenNote={onOpenNote}
          expanded={expanded}
        />
      )}
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
            </code>{" "}
            or a relation property.
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
                <ul
                  className={
                    expanded
                      ? "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3"
                      : "space-y-1"
                  }
                >
                  {linkingNotes.map((linkingNote) => (
                    <li key={linkingNote.id}>
                      <button
                        onClick={() => onOpenNote(linkingNote.id)}
                        className="block h-full w-full rounded-md border border-border/50 bg-white px-3 py-2 text-left transition-colors hover:border-[hsl(4_66%_55%/0.4)] hover:bg-[hsl(4_66%_55%/0.04)]"
                      >
                        <span className="block truncate text-sm font-medium text-[hsl(211_90%_40%)]">
                          {noteTitle(linkingNote)}
                        </span>
                        {noteSnippet(linkingNote) && (
                          <span
                            className={cn(
                              "mt-0.5 block text-xs text-muted-foreground",
                              expanded ? "line-clamp-2" : "truncate",
                            )}
                          >
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

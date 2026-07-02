import { format, isToday, isYesterday } from "date-fns";
import { Pin, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  type Note,
  noteSnippet,
  noteTitle,
  noteTypePath,
  typeKey,
} from "@/lib/note-utils";
import type { NoteFilter } from "@/lib/filters";
import {
  deleteNoteForever,
  emptyTrash,
  restoreNote,
  toggleNotePinned,
  trashNote,
} from "@/store/notes-store";

function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "d MMM yyyy");
}

interface NoteListProps {
  notes: Note[];
  filter: NoteFilter;
  selectedNoteId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
}

export function NoteList({
  notes,
  filter,
  selectedNoteId,
  search,
  onSearchChange,
  onSelectNote,
  onCreateNote,
}: NoteListProps) {
  const inTrash = filter.kind === "trash";
  const heading =
    filter.kind === "all"
      ? "All Notes"
      : filter.kind === "trash"
        ? "Trash"
        : filter.path.join(" / ");

  return (
    <div className="flex h-full flex-col bg-[hsl(40_20%_97%)]">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        <span className="flex-1 truncate text-sm font-semibold">{heading}</span>
        {inTrash ? (
          notes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => void emptyTrash()}
            >
              Empty trash
            </Button>
          )
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="New note (⌘N)"
            onClick={onCreateNote}
          >
            <Plus size={16} />
          </Button>
        )}
      </div>
      <div className="px-3 py-2">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search notes…"
            className="h-8 bg-white pl-8 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {inTrash ? "Trash is empty." : "No notes here yet."}
          </p>
        )}
        {notes.map((note) => {
          const title = noteTitle(note);
          const snippet = noteSnippet(note);
          const type = typeKey(noteTypePath(note));
          return (
            <ContextMenu key={note.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => onSelectNote(note.id)}
                  className={cn(
                    "block w-full border-b border-border/40 px-4 py-3 text-left transition-colors",
                    note.id === selectedNoteId
                      ? "bg-[hsl(4_66%_55%/0.09)]"
                      : "hover:bg-black/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {note.pinned && (
                      <Pin size={12} className="shrink-0 text-[hsl(4_66%_55%)]" />
                    )}
                    <span className="truncate text-sm font-medium">{title}</span>
                  </div>
                  {snippet && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {snippet}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="h-4 max-w-[60%] rounded px-1.5 text-[10px] font-normal"
                    >
                      <span className="truncate">{type || "unfiled"}</span>
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatNoteDate(note.updatedAt)}
                    </span>
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {inTrash ? (
                  <>
                    <ContextMenuItem onClick={() => void restoreNote(note.id)}>
                      <Undo2 size={14} className="mr-2" /> Restore
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-destructive"
                      onClick={() => void deleteNoteForever(note.id)}
                    >
                      <Trash2 size={14} className="mr-2" /> Delete forever
                    </ContextMenuItem>
                  </>
                ) : (
                  <>
                    <ContextMenuItem onClick={() => toggleNotePinned(note.id)}>
                      <Pin size={14} className="mr-2" />
                      {note.pinned ? "Unpin" : "Pin"}
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-destructive"
                      onClick={() => void trashNote(note.id)}
                    >
                      <Trash2 size={14} className="mr-2" /> Move to trash
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    </div>
  );
}

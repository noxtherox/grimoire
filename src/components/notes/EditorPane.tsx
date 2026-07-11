import { useState } from "react";
import { Link2, Pin, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { TypePicker } from "./TypePicker";
import { BacklinksPanel } from "./BacklinksPanel";
import {
  type Note,
  findNoteByTitle,
  getAllTypePaths,
  getBacklinksGroupedByType,
  isTrashed,
  noteTitle,
  noteTypePath,
} from "@/lib/note-utils";
import { noteBody } from "@/lib/frontmatter";
import {
  createNote,
  getNotes,
  restoreNote,
  setNoteType,
  toggleNotePinned,
  trashNote,
  updateNoteBody,
} from "@/store/notes-store";
import { cn } from "@/lib/utils";

interface EditorPaneProps {
  note: Note | null;
  allNotes: Note[];
  onOpenNote: (id: string) => void;
}

export function EditorPane({ note, allNotes, onOpenNote }: EditorPaneProps) {
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [expandBacklinks, setExpandBacklinks] = useState(false);

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="text-center text-muted-foreground">
          <p className="text-4xl">📖</p>
          <p className="mt-3 text-sm">Select a note, or press ⌘N to create one.</p>
        </div>
      </div>
    );
  }

  const backlinkCount = [
    ...getBacklinksGroupedByType(note, allNotes).values(),
  ].reduce((sum, group) => sum + group.length, 0);

  const handleFollowLink = async (title: string) => {
    // Read the freshest notes — the store may be ahead of this render
    const existing = findNoteByTitle(title, getNotes());
    if (existing) {
      onOpenNote(existing.id);
      return;
    }
    const created = await createNote(noteTypePath(note), `# ${title}\n\n`);
    if (created) onOpenNote(created.id);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
        <TypePicker
          value={noteTypePath(note)}
          existingTypePaths={getAllTypePaths(allNotes)}
          onChange={(typePath) => void setNoteType(note.id, typePath)}
        />
        <div className="flex-1" />
        {isTrashed(note) ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => void restoreNote(note.id)}
          >
            <Undo2 size={14} /> Restore
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", note.pinned && "text-[hsl(4_66%_55%)]")}
              title={note.pinned ? "Unpin" : "Pin"}
              onClick={() => toggleNotePinned(note.id)}
            >
              <Pin size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              title="Move to trash"
              onClick={() => void trashNote(note.id)}
            >
              <Trash2 size={15} />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-7 w-7",
            showBacklinks && "bg-muted text-[hsl(4_66%_55%)]",
          )}
          title={showBacklinks ? "Hide backlinks" : "Show backlinks"}
          onClick={() => setShowBacklinks((open) => !open)}
        >
          <Link2 size={15} />
          {backlinkCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[hsl(4_66%_55%)] px-0.5 text-[9px] font-semibold leading-none text-white tabular-nums">
              {backlinkCount}
            </span>
          )}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Hidden (not unmounted) while the panel is expanded so the editor keeps its state. */}
        <div
          className={cn(
            "min-w-0 flex-1",
            showBacklinks && expandBacklinks && "hidden",
          )}
        >
          {/* The editor only sees the body; frontmatter properties live in the sidebar. */}
          <MarkdownEditor
            noteId={note.id}
            initialContent={noteBody(note.content)}
            getLinkableTitles={() =>
              getNotes()
                .filter((other) => !isTrashed(other) && other.id !== note.id)
                .map((other) => noteTitle(other))
            }
            isTitleResolved={(title) => !!findNoteByTitle(title, getNotes())}
            onChange={(body) => updateNoteBody(note.id, body)}
            onFollowLink={(title) => void handleFollowLink(title)}
          />
        </div>
        {showBacklinks && (
          <BacklinksPanel
            note={note}
            allNotes={allNotes}
            onOpenNote={onOpenNote}
            expanded={expandBacklinks}
            onToggleExpanded={() => setExpandBacklinks((open) => !open)}
          />
        )}
      </div>
    </div>
  );
}

import { Pin, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { MainTagPicker } from "./MainTagPicker";
import { BacklinksPanel } from "./BacklinksPanel";
import {
  type Note,
  findNoteByTitle,
  getMainTagCounts,
  getNoteTitle,
} from "@/lib/note-utils";
import {
  createNote,
  getNotes,
  restoreNote,
  setNoteMainTag,
  toggleNotePinned,
  trashNote,
  updateNoteContent,
} from "@/store/notes-store";
import { cn } from "@/lib/utils";

interface EditorPaneProps {
  note: Note | null;
  allNotes: Note[];
  onOpenNote: (id: string) => void;
}

export function EditorPane({ note, allNotes, onOpenNote }: EditorPaneProps) {
  if (!note) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="text-center text-muted-foreground">
          <p className="text-4xl">🐻</p>
          <p className="mt-3 text-sm">Select a note, or press ⌘N to create one.</p>
        </div>
      </div>
    );
  }

  const handleFollowLink = (title: string) => {
    // Read the freshest notes — the store may be ahead of this render
    const existing = findNoteByTitle(title, getNotes());
    if (existing) {
      onOpenNote(existing.id);
    } else {
      const created = createNote(note.mainTag, `# ${title}\n\n`);
      onOpenNote(created.id);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
        <MainTagPicker
          value={note.mainTag}
          existingTags={[...getMainTagCounts(allNotes).keys()]}
          onChange={(tag) => setNoteMainTag(note.id, tag)}
        />
        <div className="flex-1" />
        {note.trashed ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => restoreNote(note.id)}
          >
            <Undo2 size={14} /> Restore
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                note.pinned && "text-[hsl(4_66%_55%)]",
              )}
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
              onClick={() => trashNote(note.id)}
            >
              <Trash2 size={15} />
            </Button>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <MarkdownEditor
          noteId={note.id}
          initialContent={note.content}
          getLinkableTitles={() =>
            getNotes()
              .filter((other) => !other.trashed && other.id !== note.id)
              .map((other) => getNoteTitle(other.content))
          }
          isTitleResolved={(title) => !!findNoteByTitle(title, getNotes())}
          onChange={(content) => updateNoteContent(note.id, content)}
          onFollowLink={handleFollowLink}
        />
      </div>
      <BacklinksPanel note={note} allNotes={allNotes} onOpenNote={onOpenNote} />
    </div>
  );
}

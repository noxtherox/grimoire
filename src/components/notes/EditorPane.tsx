import { useState } from "react";
import {
  FolderSearch,
  Link2,
  MapPin,
  Pin,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { TypePicker } from "./TypePicker";
import { BacklinksPanel } from "./BacklinksPanel";
import { getBacklinksGroupedByType } from "@/lib/links";
import {
  type Note,
  findNoteByTitle,
  getAllTypePaths,
  isExternalNote,
  isTrashed,
  noteAbsolutePath,
  noteTitle,
  noteTypePath,
} from "@/lib/note-utils";
import { noteBody } from "@/lib/frontmatter";
import type { PropertySchemas } from "@/lib/properties";
import type { TypeIcons } from "@/lib/type-icons";
import {
  closeExternalNote,
  createNote,
  getNotes,
  restoreNote,
  revealNoteInDesktop,
  setNoteType,
  toggleNotePinned,
  trashNote,
  updateNoteBody,
} from "@/store/notes-store";
import { cn } from "@/lib/utils";

interface EditorPaneProps {
  note: Note | null;
  allNotes: Note[];
  /** Types that exist without notes — offered by the type picker too. */
  extraTypes: string[][];
  schemas: PropertySchemas;
  /** Custom icon per type key, shown in the type picker. */
  typeIcons: TypeIcons;
  vaultLocation: string | null;
  onOpenNote: (id: string) => void;
  onMoveExternalToVault: (id: string, typePath: string[]) => void;
  isBusy: boolean;
}

export function EditorPane({
  note,
  allNotes,
  extraTypes,
  schemas,
  typeIcons,
  vaultLocation,
  onOpenNote,
  onMoveExternalToVault,
  isBusy,
}: EditorPaneProps) {
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [expandBacklinks, setExpandBacklinks] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center bg-grim-editor">
        <div className="text-center text-muted-foreground">
          <p className="text-4xl">📖</p>
          <p className="mt-3 text-sm">
            Select a note, or press ⌘N to create one.
          </p>
        </div>
      </div>
    );
  }

  const external = isExternalNote(note);
  const absolutePath = noteAbsolutePath(note, vaultLocation);
  const backlinkCount = external
    ? 0
    : [...getBacklinksGroupedByType(note, allNotes, schemas).values()].reduce(
        (sum, group) => sum + group.length,
        0,
      );

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
    <div className="flex h-full flex-col bg-grim-editor">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
        {external ? (
          <>
            <TypePicker
              value={[]}
              existingTypePaths={getAllTypePaths(allNotes, extraTypes)}
              typeIcons={typeIcons}
              label="Move to vault…"
              title="Move this file into the vault and assign its type"
              onChange={(typePath) => onMoveExternalToVault(note.id, typePath)}
              disabled={isBusy}
            />
            <div
              className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
              title={absolutePath ?? undefined}
            >
              {absolutePath}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              title="View note path"
              onClick={() => setPathOpen(true)}
            >
              <MapPin size={14} /> Path
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              title="Reveal in desktop"
              onClick={() => void revealNoteInDesktop(note.id)}
            >
              <FolderSearch size={14} /> Reveal
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              title="Close note without deleting the file"
              onClick={() => void closeExternalNote(note.id)}
              disabled={isBusy}
            >
              <X size={14} /> Close
            </Button>
          </>
        ) : (
          <>
            <TypePicker
              value={noteTypePath(note)}
              existingTypePaths={getAllTypePaths(allNotes, extraTypes)}
              typeIcons={typeIcons}
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
                  className={cn("h-7 w-7", note.pinned && "text-grim-accent")}
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
                showBacklinks && "bg-muted text-grim-accent",
              )}
              title={showBacklinks ? "Hide backlinks" : "Show backlinks"}
              onClick={() => setShowBacklinks((open) => !open)}
            >
              <Link2 size={15} />
              {backlinkCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-grim-accent px-0.5 text-[9px] font-semibold leading-none text-white tabular-nums">
                  {backlinkCount}
                </span>
              )}
            </Button>
          </>
        )}
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
                .filter(
                  (other) =>
                    !isExternalNote(other) &&
                    !isTrashed(other) &&
                    other.id !== note.id,
                )
                .map((other) => noteTitle(other))
            }
            isTitleResolved={(title) => !!findNoteByTitle(title, getNotes())}
            onChange={(body) => updateNoteBody(note.id, body)}
            onFollowLink={(title) => void handleFollowLink(title)}
            readOnly={isBusy}
          />
        </div>
        {!external && showBacklinks && (
          <BacklinksPanel
            note={note}
            allNotes={allNotes}
            schemas={schemas}
            onOpenNote={onOpenNote}
            expanded={expandBacklinks}
            onToggleExpanded={() => setExpandBacklinks((open) => !open)}
          />
        )}
      </div>
      <Dialog open={external && pathOpen} onOpenChange={setPathOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>External note path</DialogTitle>
          </DialogHeader>
          <code className="select-all break-all rounded-md bg-muted px-3 py-2 text-xs">
            {absolutePath}
          </code>
        </DialogContent>
      </Dialog>
    </div>
  );
}

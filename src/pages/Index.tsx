import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sidebar } from "@/components/notes/Sidebar";
import { NoteList } from "@/components/notes/NoteList";
import { EditorPane } from "@/components/notes/EditorPane";
import {
  chooseVaultFolder,
  createNote,
  initStore,
  moveExternalNoteToVault,
  openExternalNotes,
  useVault,
  watchOsOpenedFiles,
} from "@/store/notes-store";
import { filterNotes, type NoteFilter } from "@/lib/filters";
import { DEFAULT_TYPE } from "@/lib/note-utils";

const Index = () => {
  const vault = useVault();
  const [filter, setFilter] = useState<NoteFilter>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  useEffect(() => {
    initStore();
  }, []);

  // Markdown files opened via the OS (double-click / "Open with" Grimoire)
  useEffect(() => {
    if (vault.status !== "ready") return;
    return watchOsOpenedFiles((ids) => {
      setFilter({ kind: "external" });
      setSearch("");
      setSelectedNoteId(ids[0]);
    });
  }, [vault.status]);

  const { notes } = vault;
  const visibleNotes = useMemo(
    () => filterNotes(notes, filter, search),
    [notes, filter, search],
  );

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  // Keep a sensible selection as filters change or notes are trashed
  useEffect(() => {
    if (vault.status !== "ready") return;
    const selectionVisible =
      selectedNote && visibleNotes.some((note) => note.id === selectedNote.id);
    if (!selectionVisible) {
      setSelectedNoteId(visibleNotes[0]?.id ?? null);
    }
  }, [vault.status, visibleNotes, selectedNote]);

  const handleCreateNote = async () => {
    const typePath = filter.kind === "type" ? filter.path : DEFAULT_TYPE;
    const note = await createNote(typePath);
    if (!note) return;
    if (filter.kind === "trash" || filter.kind === "external") {
      setFilter({ kind: "all" });
    }
    setSearch("");
    setSelectedNoteId(note.id);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void handleCreateNote();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleOpenNote = (id: string) => {
    setFilter({ kind: "all" });
    setSearch("");
    setSelectedNoteId(id);
  };

  const handleOpenExternalNotes = async () => {
    const ids = await openExternalNotes();
    if (!ids.length) return;
    setFilter({ kind: "external" });
    setSearch("");
    setSelectedNoteId(ids[0]);
  };

  const handleMoveExternalToVault = async (id: string, typePath: string[]) => {
    const moved = await moveExternalNoteToVault(id, typePath);
    if (!moved) return;
    setFilter({ kind: "type", path: typePath });
    setSearch("");
    setSelectedNoteId(id);
  };

  if (vault.status === "pick-vault" || vault.status === "error") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-grim-surface">
        <div className="max-w-sm text-center">
          <p className="text-5xl">📖</p>
          <h1 className="mt-4 text-xl font-semibold">Grimoire</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your notes are plain markdown files in a folder — folders are types.
            Point Grimoire at a folder to open your vault.
          </p>
          {vault.status === "error" && (
            <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Couldn't open the vault: {vault.error}
            </p>
          )}
          <Button
            className="mt-5 gap-2"
            onClick={() => void chooseVaultFolder()}
          >
            <FolderOpen size={16} /> Choose vault folder
          </Button>
        </div>
      </div>
    );
  }

  if (vault.status !== "ready") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-grim-surface">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={17} minSize={12} maxSize={28}>
          <Sidebar
            notes={notes}
            extraTypes={vault.extraTypes}
            typeIcons={vault.typeIcons}
            filter={filter}
            isDesktop={vault.isDesktop}
            vaultLocation={vault.location}
            onFilterChange={setFilter}
          />
        </ResizablePanel>
        <ResizableHandle className="w-px bg-transparent" />
        <ResizablePanel defaultSize={26} minSize={18} maxSize={40}>
          <NoteList
            notes={visibleNotes}
            filter={filter}
            selectedNoteId={selectedNoteId}
            search={search}
            onSearchChange={setSearch}
            onSelectNote={setSelectedNoteId}
            onCreateNote={() => void handleCreateNote()}
            onOpenExternalNotes={() => void handleOpenExternalNotes()}
          />
        </ResizablePanel>
        <ResizableHandle className="w-px bg-border/60" />
        <ResizablePanel defaultSize={57} minSize={30}>
          <EditorPane
            note={selectedNote}
            allNotes={notes}
            extraTypes={vault.extraTypes}
            schemas={vault.schemas}
            typeIcons={vault.typeIcons}
            vaultLocation={vault.location}
            isBusy={
              selectedNote ? vault.busyNoteIds.has(selectedNote.id) : false
            }
            onOpenNote={handleOpenNote}
            onMoveExternalToVault={(id, typePath) =>
              void handleMoveExternalToVault(id, typePath)
            }
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Index;

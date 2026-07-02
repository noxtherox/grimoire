import { useEffect, useMemo, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sidebar } from "@/components/notes/Sidebar";
import { NoteList } from "@/components/notes/NoteList";
import { EditorPane } from "@/components/notes/EditorPane";
import { createNote, useNotes } from "@/store/notes-store";
import { filterNotes, type NoteFilter } from "@/lib/filters";
import { DEFAULT_MAIN_TAG } from "@/lib/note-utils";

const Index = () => {
  const notes = useNotes();
  const [filter, setFilter] = useState<NoteFilter>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const visibleNotes = useMemo(
    () => filterNotes(notes, filter, search),
    [notes, filter, search],
  );

  const selectedNote =
    notes.find((note) => note.id === selectedNoteId) ?? null;

  // Keep a sensible selection as filters change or notes are trashed
  useEffect(() => {
    const selectionVisible =
      selectedNote && visibleNotes.some((note) => note.id === selectedNote.id);
    if (!selectionVisible) {
      setSelectedNoteId(visibleNotes[0]?.id ?? null);
    }
  }, [visibleNotes, selectedNote]);

  const handleCreateNote = () => {
    const mainTag = filter.kind === "tag" ? filter.tag : DEFAULT_MAIN_TAG;
    const note = createNote(mainTag);
    if (filter.kind === "trash") setFilter({ kind: "all" });
    setSearch("");
    setSelectedNoteId(note.id);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleCreateNote();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleOpenNote = (id: string) => {
    // Jumping to a note that the current filter hides: widen to All Notes
    const target = notes.find((note) => note.id === id);
    if (
      target &&
      filter.kind === "tag" &&
      target.mainTag !== filter.tag
    ) {
      setFilter({ kind: "all" });
    }
    setSearch("");
    setSelectedNoteId(id);
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={17} minSize={12} maxSize={28}>
          <Sidebar notes={notes} filter={filter} onFilterChange={setFilter} />
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
            onCreateNote={handleCreateNote}
          />
        </ResizablePanel>
        <ResizableHandle className="w-px bg-border/60" />
        <ResizablePanel defaultSize={57} minSize={30}>
          <EditorPane
            note={selectedNote}
            allNotes={notes}
            onOpenNote={handleOpenNote}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Index;

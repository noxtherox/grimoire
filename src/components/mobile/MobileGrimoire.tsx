import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  FileText,
  Folder,
  FolderSearch,
  Loader2,
  Menu,
  Plus,
  Search,
  Settings,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { cn } from "@/lib/utils";
import { noteBody } from "@/lib/frontmatter";
import {
  isArchived,
  isTrashed,
  noteSnippet,
  noteTitle,
  noteTypePath,
  type Note,
} from "@/lib/note-utils";
import {
  createNote,
  createMobileVaultAtLocation,
  createMobileVaultOnDevice,
  initStore,
  locateMobileVault,
  updateNoteBody,
  useVault,
} from "@/store/notes-store";

interface MobileNote {
  id: string;
  title: string;
  preview: string;
  body: string;
  type: string;
  emoji: string;
  updated: string;
  pinned?: boolean;
}

const TYPES = [
  { name: "Ideas", emoji: "💡", count: 18, color: "bg-amber-100 dark:bg-amber-400/15" },
  { name: "Books", emoji: "📚", count: 11, color: "bg-blue-100 dark:bg-blue-400/15" },
  { name: "Journal", emoji: "✍️", count: 32, color: "bg-rose-100 dark:bg-rose-400/15" },
  { name: "Home", emoji: "🌿", count: 9, color: "bg-emerald-100 dark:bg-emerald-400/15" },
  { name: "Projects", emoji: "📂", count: 14, color: "bg-violet-100 dark:bg-violet-400/15" },
];

const TYPE_EMOJI: Record<string, string> = Object.fromEntries(
  TYPES.map((type) => [type.name.toLowerCase(), type.emoji]),
);

function editorBody(note: Note): string {
  const lines = noteBody(note.content).split("\n");
  const titleIndex = lines.findIndex((line) => line.trim().length > 0);
  if (titleIndex < 0) return "";
  return lines
    .slice(titleIndex + 1)
    .join("\n")
    .replace(/^\s*\n/, "");
}

function formatUpdated(updatedAt: string): string {
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return "Now";
  if (elapsed < 60 * 60_000) return `${Math.floor(elapsed / 60_000)} min`;
  if (elapsed < 24 * 60 * 60_000) return `${Math.floor(elapsed / (60 * 60_000))} hr`;
  if (elapsed < 48 * 60 * 60_000) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(updatedAt));
}

function presentNote(note: Note): MobileNote {
  const type = noteTypePath(note).join(" / ") || "Inbox";
  const rootType = noteTypePath(note)[0]?.toLowerCase() ?? "inbox";
  return {
    id: note.id,
    title: noteTitle(note),
    preview: noteSnippet(note) || "Empty note",
    body: editorBody(note),
    type,
    emoji: TYPE_EMOJI[rootType] ?? "📄",
    updated: formatUpdated(note.updatedAt),
    pinned: note.pinned,
  };
}

function StatusBar() {
  return (
    <div className="flex h-11 shrink-0 items-end justify-between px-6 pb-2 text-[12px] font-semibold text-[#20201e] dark:text-[#f5f3ef]">
      <span>9:41</span>
      <div className="flex items-center gap-1.5" aria-label="Phone status">
        <span className="flex items-end gap-[2px]" aria-hidden="true">
          <span className="h-1 w-[3px] rounded-full bg-current" />
          <span className="h-1.5 w-[3px] rounded-full bg-current" />
          <span className="h-2 w-[3px] rounded-full bg-current" />
          <span className="h-2.5 w-[3px] rounded-full bg-current" />
        </span>
        <span className="text-[10px]" aria-hidden="true">⌁</span>
        <span className="h-[10px] w-[19px] rounded-[3px] border border-current p-[1px]" aria-hidden="true">
          <span className="block h-full w-[12px] rounded-[1px] bg-current" />
        </span>
      </div>
    </div>
  );
}

interface NoteCardProps {
  note: MobileNote;
  onOpen: (note: MobileNote) => void;
}

function NoteCard({ note, onOpen }: NoteCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(note)}
      className="group w-full border-b border-white/[0.065] px-1 py-4 text-left transition last:border-b-0 active:bg-white/[0.035]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-white/[0.07] text-[17px]" aria-hidden="true">{note.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-[#f2efea]">{note.title}</h3>
            {note.pinned && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d84b40]" title="Pinned" />}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.4] text-[#9b9893]">{note.preview}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-[#74716d]">
            <span className="flex items-center gap-1 text-[#ef6b62]"><Folder className="h-3 w-3" />{note.type}</span><span>·</span><span>{note.updated}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface BottomSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onCreate: () => void;
}

function BottomSearch({ query, onQueryChange, onCreate }: BottomSearchProps) {
  return (
    <div className="mobile-bottom-search pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center gap-2.5 bg-gradient-to-t from-[#1c1d1e] via-[#1c1d1e]/95 to-transparent px-5 pb-7 pt-8">
      <label className="pointer-events-auto relative min-w-0 flex-1">
        <span className="sr-only">Search notes</span>
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#f2f2f7]" strokeWidth={2.1} />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search"
          className="h-[52px] rounded-[26px] border border-white/[0.10] bg-[#292a2b]/95 pl-12 pr-10 text-[17px] text-white shadow-[0_8px_28px_rgba(0,0,0,0.36)] backdrop-blur-xl placeholder:text-[#9b9893] focus-visible:ring-1 focus-visible:ring-[#d84b40]/70"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-1 text-[#c8c8ce]" aria-label="Clear search">
            <X className="h-3 w-3" />
          </button>
        )}
      </label>
      <button type="button" onClick={onCreate} className="pointer-events-auto flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#df5149] text-white shadow-[0_8px_24px_rgba(223,81,73,0.34)] transition active:scale-95" aria-label="Create a new note">
        <Plus className="h-7 w-7" strokeWidth={2} />
      </button>
    </div>
  );
}

interface LibraryDrawerProps {
  notes: MobileNote[];
  onClose: () => void;
  onSelectAll: () => void;
  onSelectType: (type: string) => void;
}

function LibraryDrawer({ notes, onClose, onSelectAll, onSelectType }: LibraryDrawerProps) {
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Library">
      <aside className="flex h-full w-[86%] flex-col rounded-r-[28px] bg-[#1c1c1e] px-4 pb-8 pt-12 shadow-2xl">
        <header className="mb-5 flex items-center justify-between px-1">
          <h2 className="text-[30px] font-bold tracking-[-0.04em]">Library</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full bg-white/[0.08] text-[#f5f5f7] hover:bg-white/[0.12]" aria-label="Close library"><X className="h-5 w-5" /></Button>
        </header>
        <div className="overflow-hidden rounded-[14px] bg-[#2c2c2e]">
          <button type="button" onClick={onSelectAll} className="flex w-full items-center gap-3 border-b border-white/[0.08] px-4 py-3.5 text-left active:bg-white/[0.04]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#df5149] text-white"><FileText className="h-[18px] w-[18px]" /></span>
            <span className="flex-1 text-[16px] font-medium">All Notes</span>
            <span className="text-sm text-[#98989f]">{notes.length}</span><ChevronRight className="h-4 w-4 text-[#636366]" />
          </button>
          <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.04]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#636366] text-white"><Trash2 className="h-[18px] w-[18px]" /></span>
            <span className="flex-1 text-[16px] font-medium">Recently Deleted</span>
            <span className="text-sm text-[#98989f]">0</span><ChevronRight className="h-4 w-4 text-[#636366]" />
          </button>
        </div>
        <p className="mb-2 mt-7 px-1 text-[13px] font-semibold text-[#98989f]">Folders</p>
        <div className="overflow-hidden rounded-[14px] bg-[#2c2c2e]">
          {TYPES.map((type) => {
            const noteCount = notes.filter((note) => note.type === type.name).length;
            return (
              <button type="button" key={type.name} onClick={() => onSelectType(type.name)} className="flex w-full items-center gap-3 border-b border-white/[0.08] px-4 py-3 text-left last:border-b-0 active:bg-white/[0.04]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#df5149] text-white"><Folder className="h-[18px] w-[18px]" /></span>
                <span className="flex-1 text-[16px] font-medium">{type.name}</span><span className="text-sm text-[#98989f]">{noteCount}</span><ChevronRight className="h-4 w-4 text-[#636366]" />
              </button>
            );
          })}
        </div>
      </aside>
      <button type="button" onClick={onClose} className="absolute inset-y-0 right-0 w-[14%]" aria-label="Close library" />
    </div>
  );
}

interface NoteViewProps {
  note: MobileNote;
  onBack: () => void;
  onBodyChange: (body: string) => void;
}

function NoteView({ note, onBack, onBodyChange }: NoteViewProps) {
  const [draft, setDraft] = useState(note.body);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#1c1d1e]">
      <header className="flex h-12 shrink-0 items-center justify-between px-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-[#f0efed] hover:bg-[#e9e7e3] dark:bg-white/[0.08] dark:text-[#f5f3ef] dark:hover:bg-white/[0.12]" onClick={onBack} aria-label="Back to notes"><ArrowLeft className="h-5 w-5" /></Button>
        <span className="text-xs font-medium text-[#99958f] dark:text-[#8b8883]">{note.type}</span>
        <span className="h-9 w-9" aria-hidden="true" />
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-5">
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-[#77736f]"><span className="flex items-center gap-1 text-[#df5149]"><Folder className="h-3.5 w-3.5" />{note.type}</span><span>·</span><span>Edited {note.updated} ago</span></div>
        <h1 className="text-[36px] font-bold leading-[1.06] tracking-[-0.045em] text-[#24221f] dark:text-[#f5f3ef]">{note.title}</h1>
        <div className="mobile-note-editor -mx-6 mt-2 min-h-0 flex-1 overflow-hidden [&_[role=toolbar]]:hidden [&_.cm-content]:!px-6 [&_.cm-content]:!pb-28 [&_.cm-content]:!pt-3 [&_.cm-scroller]:overscroll-contain">
          <MarkdownEditor
            noteId={`mobile-${note.id}`}
            initialContent={draft}
            getLinkableTitles={() => []}
            isTitleResolved={() => false}
            onChange={(body) => {
              setDraft(body);
              onBodyChange(body);
            }}
            onFollowLink={() => undefined}
            placeholderText="Start writing…"
            firstLineIsTitle={false}
          />
        </div>
      </main>
    </div>
  );
}

interface ComposerProps {
  onClose: () => void;
  onSave: (title: string, body: string) => void;
}

function Composer({ onClose, onSave }: ComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/20 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="New note">
      <div className="flex h-[82%] w-full flex-col rounded-t-[28px] bg-[#fffefa] shadow-2xl dark:bg-[#1c1d1e]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#d7d3cd] dark:bg-white/20" />
        <header className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" className="rounded-full dark:text-[#f5f3ef]" onClick={onClose} aria-label="Close composer"><X className="h-5 w-5" /></Button>
          <span className="text-sm font-semibold tracking-[-0.01em]">New note</span>
          <Button variant="ghost" className="h-9 px-3 text-sm font-semibold text-[#d84b40] hover:text-[#d84b40]" disabled={!title.trim()} onClick={() => onSave(title.trim(), body)}>Save</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="Note title" className="h-auto border-0 bg-transparent px-0 text-[36px] font-bold leading-[1.06] tracking-[-0.045em] shadow-none ring-offset-0 placeholder:text-[#c1bdb7] focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#f5f3ef] dark:placeholder:text-[#5e5b57] md:text-[36px]" />
          <div className="mobile-note-editor -mx-6 mb-5 mt-3 h-[320px] overflow-hidden [&_[role=toolbar]]:hidden [&_.cm-content]:!px-6 [&_.cm-content]:!pb-20 [&_.cm-content]:!pt-3 [&_.cm-scroller]:overscroll-contain">
            <MarkdownEditor
              noteId="mobile-new-note"
              initialContent={body}
              getLinkableTitles={() => []}
              isTitleResolved={() => false}
              onChange={setBody}
              onFollowLink={() => undefined}
              autoFocus={false}
              placeholderText="Start writing…"
              firstLineIsTitle={false}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-black/[0.06] px-5 pb-7 pt-3 text-xs text-[#77736d] dark:border-white/[0.06] dark:text-[#aaa6a0]"><Folder className="h-4 w-4 text-[#df5149]" /><span>Note Type: Ideas</span><ChevronRight className="ml-auto h-4 w-4" /></div>
      </div>
    </div>
  );
}

interface MobileSettingsProps {
  location: string | null;
  onClose: () => void;
  onChangeVault: () => void;
}

function MobileSettings({
  location,
  onClose,
  onChangeVault,
}: MobileSettingsProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/45 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Mobile settings">
      <section className="w-full rounded-t-[28px] bg-[#1c1d1e] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        <header className="flex items-center justify-between py-4">
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.03em]">Settings</h2>
            <p className="mt-0.5 text-xs text-[#8e8e93]">Markdown vault</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full bg-white/[0.08]" aria-label="Close settings"><X className="h-5 w-5" /></Button>
        </header>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#77777d]">Current vault</p>
        <div className="rounded-[16px] bg-[#292a2b] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#df5149] text-white"><Folder className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{location ?? "Grimoire"}</span><span className="mt-0.5 block text-xs text-[#8e8e93]">Your Markdown vault</span></span>
          </div>
          <Button type="button" variant="ghost" onClick={onChangeVault} className="mt-4 h-10 w-full rounded-[12px] bg-white/[0.07] text-sm font-semibold text-[#ef6b62] hover:bg-white/[0.1] hover:text-[#ef6b62]">Change vault</Button>
        </div>
      </section>
    </div>
  );
}

interface VaultSetupProps {
  nativeAvailable: boolean;
  error: string | null;
  onClose?: () => void;
  onLocate: () => Promise<boolean>;
  onCreateAtLocation: () => Promise<boolean>;
  onCreateOnDevice: () => Promise<boolean>;
}

function VaultSetup({
  nativeAvailable,
  error,
  onClose,
  onLocate,
  onCreateAtLocation,
  onCreateOnDevice,
}: VaultSetupProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const run = async (label: string, action: () => Promise<boolean>) => {
    setBusyAction(label);
    try {
      await action();
    } finally {
      setBusyAction(null);
    }
  };

  const actionRow = (
    label: string,
    description: string,
    icon: ReactNode,
    action: () => Promise<boolean>,
  ) => (
    <button type="button" disabled={busyAction !== null || !nativeAvailable} onClick={() => void run(label, action)} className="flex w-full items-center gap-3 border-b border-white/[0.08] px-4 py-4 text-left last:border-0 disabled:opacity-50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#343536] text-[#f5f3ef]">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{label}</span><span className="mt-0.5 block text-xs leading-4 text-[#8e8e93]">{description}</span></span>
      {busyAction === label ? <Loader2 className="h-5 w-5 animate-spin text-[#ef6b62]" /> : <ChevronRight className="h-5 w-5 text-[#66666b]" />}
    </button>
  );

  return (
    <main className="absolute inset-0 z-50 flex flex-col overflow-y-auto bg-[#1c1d1e] px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
      {onClose && <Button variant="ghost" size="icon" onClick={onClose} disabled={busyAction !== null} className="ml-auto h-10 w-10 rounded-full bg-white/[0.08]" aria-label="Close vault setup"><X className="h-5 w-5" /></Button>}
      <div className={cn("mx-auto flex w-full max-w-sm flex-1 flex-col justify-center", onClose ? "pb-4" : "pb-10")}>
        <span className="flex h-14 w-14 items-center justify-center rounded-[17px] bg-[#df5149] text-white shadow-[0_10px_30px_rgba(223,81,73,0.24)]"><Folder className="h-7 w-7" /></span>
        <h1 className="mt-6 text-[32px] font-bold leading-[1.05] tracking-[-0.045em]">Find your Grimoire</h1>
        <p className="mt-3 text-[15px] leading-6 text-[#9a9691]">Open an existing vault, or create one if Grimoire cannot find it.</p>

        <Button disabled={busyAction !== null || !nativeAvailable} onClick={() => void run("Locate existing vault", onLocate)} className="mt-7 h-[52px] rounded-[15px] bg-[#df5149] text-[15px] font-semibold text-white hover:bg-[#e15d54]">
          {busyAction === "Locate existing vault" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FolderSearch className="mr-2 h-5 w-5" />}
          Locate existing vault
        </Button>
        <p className="mt-2 text-center text-xs leading-4 text-[#77777d]">Select the vault itself or a folder containing “Grimoire.”</p>

        <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-white/[0.08]" /><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#66666b]">Create a vault</span><span className="h-px flex-1 bg-white/[0.08]" /></div>
        <div className="overflow-hidden rounded-[17px] bg-[#292a2b]">
          {actionRow("Choose a location", "Create a Grimoire folder wherever you choose", <Folder className="h-5 w-5" />, onCreateAtLocation)}
          {actionRow("On this iPhone", "Let Grimoire choose a private local folder", <Smartphone className="h-5 w-5" />, onCreateOnDevice)}
          {actionRow("iCloud Drive", "Choose where to create the vault in iCloud Drive", <Cloud className="h-5 w-5" />, onCreateAtLocation)}
        </div>
        {error && <p className="mt-4 rounded-[13px] bg-[#df5149]/10 px-4 py-3 text-sm leading-5 text-[#ef847d]">{error}</p>}
        {!nativeAvailable && <p className="mt-4 text-center text-xs text-[#77777d]">Vault selection is available in the iOS app.</p>}
      </div>
    </main>
  );
}

export function MobileGrimoire() {
  const isNativeApp = "__TAURI_INTERNALS__" in window;
  const vault = useVault();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vaultSetupOpen, setVaultSetupOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    initStore();
  }, []);

  const notes = useMemo(
    () =>
      vault.notes
        .filter((note) => !isTrashed(note) && !isArchived(note))
        .map(presentNote),
    [vault.notes],
  );
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const filteredNotes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return notes;
    return notes.filter((note) => `${note.title} ${note.preview} ${note.type}`.toLowerCase().includes(term));
  }, [notes, query]);

  const saveQuickNote = async (title: string, body: string) => {
    const content = `# ${title}\n\n${body.trim()}`;
    const note = await createNote(["Ideas"], content);
    if (!note) return;
    setComposerOpen(false);
    setSelectedNoteId(note.id);
  };

  const pinnedNotes = filteredNotes.filter((note) => note.pinned);
  const recentNotes = filteredNotes.filter((note) => !note.pinned);

  const resetNavigation = () => {
    setSelectedNoteId(null);
    setQuery("");
    setLibraryOpen(false);
  };

  const runVaultAction = async (action: () => Promise<boolean>) => {
    const changed = await action();
    if (changed) {
      resetNavigation();
      setVaultSetupOpen(false);
    }
    return changed;
  };

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0d0d0d] p-0 sm:p-8">
      <section className={cn("mobile-grimoire-dark relative flex h-[100dvh] w-full max-w-[393px] flex-col overflow-hidden bg-[#1c1d1e] text-[#f5f3ef] sm:h-[852px] sm:rounded-[42px] sm:border-[7px] sm:border-[#080808] sm:shadow-[0_28px_70px_rgba(0,0,0,0.6)]", isNativeApp && "mobile-native-shell")} aria-label="Grimoire iOS prototype">
        {!isNativeApp && <StatusBar />}
        {vault.status === "pick-vault" ? (
          <VaultSetup
            nativeAvailable={isNativeApp}
            error={vault.error}
            onLocate={() => runVaultAction(locateMobileVault)}
            onCreateAtLocation={() => runVaultAction(createMobileVaultAtLocation)}
            onCreateOnDevice={() => runVaultAction(createMobileVaultOnDevice)}
          />
        ) : vault.status !== "ready" ? (
          <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
            {vault.status === "error" ? (
              <>
                <h1 className="text-xl font-semibold">Couldn’t open your notes</h1>
                <p className="mt-2 text-sm text-[#8e8e93]">{vault.error ?? "The mobile vault is unavailable."}</p>
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-[#df5149]" aria-hidden="true" />
                <p className="mt-3 text-sm text-[#8e8e93]">Opening your notes…</p>
              </>
            )}
          </main>
        ) : selectedNote ? (
          <NoteView
            note={selectedNote}
            onBack={() => setSelectedNoteId(null)}
            onBodyChange={(body) =>
              updateNoteBody(selectedNote.id, `# ${selectedNote.title}\n\n${body}`)
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pb-28">
            <header className="sticky top-0 z-20 grid grid-cols-[44px_1fr_44px] items-center border-b border-white/[0.07] bg-[#1c1d1e]/90 px-4 pb-3 pt-1 backdrop-blur-xl">
              <Button variant="ghost" size="icon" onClick={() => setLibraryOpen(true)} className="h-11 w-11 rounded-full bg-[#2c2c2e] text-[#f5f5f7] hover:bg-[#363638]" aria-label="Open library"><Menu className="h-[21px] w-[21px]" /></Button>
              <div className="min-w-0 text-center"><h1 className="truncate text-[19px] font-semibold tracking-[-0.02em]">All Notes</h1><p className="mt-0.5 text-[14px] text-[#8e8e93]">{filteredNotes.length} {filteredNotes.length === 1 ? "Note" : "Notes"}</p></div>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} className="h-11 w-11 rounded-full bg-[#2c2c2e] text-[#f5f5f7] hover:bg-[#363638]" aria-label="Settings"><Settings className="h-[20px] w-[20px]" /></Button>
            </header>
            <main className="px-4 pb-8 pt-6">
              {query ? (
                <section><h2 className="mb-3 px-1 text-[24px] font-bold tracking-[-0.035em]">Search Results</h2>{filteredNotes.length > 0 ? <div className="overflow-hidden rounded-[18px] bg-[#222324] px-3">{filteredNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={(openedNote) => setSelectedNoteId(openedNote.id)} />)}</div> : <div className="rounded-[18px] bg-[#222324] px-5 py-12 text-center"><Search className="mx-auto h-7 w-7 text-[#65625f]" /><p className="mt-3 text-[16px] font-semibold">No notes found</p><p className="mt-1 text-sm text-[#8e8a85]">Try a different search.</p></div>}</section>
              ) : (
                <div className="space-y-7">
                  {pinnedNotes.length > 0 && <section><h2 className="mb-3 px-1 text-[24px] font-bold tracking-[-0.035em]">Pinned</h2><div className="overflow-hidden rounded-[18px] bg-[#222324] px-3">{pinnedNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={(openedNote) => setSelectedNoteId(openedNote.id)} />)}</div></section>}
                  {recentNotes.length > 0 && <section><h2 className="mb-3 px-1 text-[24px] font-bold tracking-[-0.035em]">Previous 30 Days</h2><div className="overflow-hidden rounded-[18px] bg-[#222324] px-3">{recentNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={(openedNote) => setSelectedNoteId(openedNote.id)} />)}</div></section>}
                </div>
              )}
            </main>
          </div>
        )}
        {vault.status === "ready" && !selectedNote && <BottomSearch query={query} onQueryChange={setQuery} onCreate={() => setComposerOpen(true)} />}
        {libraryOpen && <LibraryDrawer notes={notes} onClose={() => setLibraryOpen(false)} onSelectAll={() => { setQuery(""); setLibraryOpen(false); }} onSelectType={(type) => { setQuery(type); setLibraryOpen(false); }} />}
        {settingsOpen && <MobileSettings location={vault.location} onClose={() => setSettingsOpen(false)} onChangeVault={() => { setSettingsOpen(false); setVaultSetupOpen(true); }} />}
        {vault.status === "ready" && vaultSetupOpen && <VaultSetup nativeAvailable={isNativeApp} error={vault.error} onClose={() => setVaultSetupOpen(false)} onLocate={() => runVaultAction(locateMobileVault)} onCreateAtLocation={() => runVaultAction(createMobileVaultAtLocation)} onCreateOnDevice={() => runVaultAction(createMobileVaultOnDevice)} />}
        {composerOpen && <Composer onClose={() => setComposerOpen(false)} onSave={saveQuickNote} />}
        {!isNativeApp && <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-50 h-1 w-32 -translate-x-1/2 rounded-full bg-[#f5f3ef]" />}
      </section>
      <div className="pointer-events-none fixed bottom-5 right-6 hidden items-center gap-2 rounded-full bg-[#232323]/90 px-3 py-2 text-xs font-medium text-[#aaa6a0] shadow-sm backdrop-blur sm:flex"><FileText className="h-3.5 w-3.5" />Interactive iOS prototype</div>
    </div>
  );
}

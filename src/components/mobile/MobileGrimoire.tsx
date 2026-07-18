import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Folder,
  Hash,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { cn } from "@/lib/utils";

interface MockNote {
  id: number;
  title: string;
  preview: string;
  body: string;
  type: string;
  emoji: string;
  updated: string;
  pinned?: boolean;
}

const INITIAL_NOTES: MockNote[] = [
  {
    id: 1,
    title: "Ideas for Grimoire mobile",
    preview: "A calm place to capture thoughts before they disappear…",
    body: "A calm place to capture thoughts before they disappear.\n\n## Mobile principles\n\n- Capture in one tap\n- Keep the vault structure familiar\n- Make reading feel spacious\n- Sync plain Markdown files\n\nThe phone should feel like a companion to the desktop app, not a compressed copy of it.",
    type: "Ideas",
    emoji: "💡",
    updated: "12 min",
    pinned: true,
  },
  {
    id: 2,
    title: "The Left Hand of Darkness",
    preview: "Notes and quotes from Ursula K. Le Guin's novel.",
    body: "Notes and quotes from Ursula K. Le Guin's novel.\n\nA story about loyalty, identity, and the distance between people. The worldbuilding never feels separate from the emotional core.",
    type: "Books",
    emoji: "📚",
    updated: "Yesterday",
    pinned: true,
  },
  {
    id: 3,
    title: "July garden plan",
    preview: "Move the herbs, prune the tomatoes, order winter seeds.",
    body: "## Weekend list\n\n- Move the herbs into partial shade\n- Prune the tomatoes\n- Order winter seeds\n- Fix the drip line near the wall",
    type: "Home",
    emoji: "🌿",
    updated: "Yesterday",
  },
  {
    id: 4,
    title: "Weekly review",
    preview: "What moved forward, what felt stuck, and next week's focus.",
    body: "## Wins\n\nThe prototype is finally taking shape.\n\n## Next week\n\nTest the capture flow with real notes and reduce the number of taps to file something.",
    type: "Journal",
    emoji: "✍️",
    updated: "8 Jul",
  },
];

const TYPES = [
  { name: "Ideas", emoji: "💡", count: 18, color: "bg-amber-100 dark:bg-amber-400/15" },
  { name: "Books", emoji: "📚", count: 11, color: "bg-blue-100 dark:bg-blue-400/15" },
  { name: "Journal", emoji: "✍️", count: 32, color: "bg-rose-100 dark:bg-rose-400/15" },
  { name: "Home", emoji: "🌿", count: 9, color: "bg-emerald-100 dark:bg-emerald-400/15" },
  { name: "Projects", emoji: "📂", count: 14, color: "bg-violet-100 dark:bg-violet-400/15" },
];

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokens).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${part}-${index}`;
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key} className="rounded bg-[#eeeae3] px-1.5 py-0.5 font-mono text-[0.88em] text-[#ba4037] dark:bg-white/10 dark:text-[#ff8f86]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key} className="font-bold text-[#292622] dark:text-[#f5f3ef]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return <a key={key} href={link[2]} className="font-medium text-[#ffd60a] underline decoration-[#ffd60a]/30 underline-offset-2" onClick={(event) => event.preventDefault()}>{link[1]}</a>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

interface MarkdownPreviewProps {
  markdown: string;
  emptyMessage?: string;
  compact?: boolean;
}

function MarkdownPreview({ markdown, emptyMessage = "Your formatted note will appear here.", compact = false }: MarkdownPreviewProps) {
  const lines = markdown.split("\n");
  let inCodeBlock = false;

  if (!markdown.trim()) {
    return <p className="text-sm italic text-[#aaa6a0] dark:text-[#77736e]">{emptyMessage}</p>;
  }

  return (
    <div className={cn("text-[#47433e] dark:text-[#d5d2cd]", compact ? "text-[13px] leading-5" : "text-[16px] leading-7")}>
      {lines.map((line, index) => {
        const key = `${index}-${line}`;
        if (line.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          return null;
        }
        if (inCodeBlock) {
          return <pre key={key} className="overflow-x-auto bg-[#292622] px-3 py-1 font-mono text-[12px] leading-5 text-[#f6f1e8] first:rounded-t-lg last:rounded-b-lg">{line || " "}</pre>;
        }
        if (line.startsWith("### ")) return <h3 key={key} className="mb-1 mt-4 text-[16px] font-bold text-[#292622] dark:text-[#f5f3ef]">{renderInlineMarkdown(line.slice(4))}</h3>;
        if (line.startsWith("## ")) return <h2 key={key} className="mb-1.5 mt-5 text-[19px] font-bold tracking-[-0.02em] text-[#292622] dark:text-[#f5f3ef]">{renderInlineMarkdown(line.slice(3))}</h2>;
        if (line.startsWith("# ")) return <h1 key={key} className="mb-2 mt-5 text-[23px] font-bold tracking-[-0.03em] text-[#292622] dark:text-[#f5f3ef]">{renderInlineMarkdown(line.slice(2))}</h1>;
        if (/^[-*] /.test(line)) return <div key={key} className="flex gap-2 pl-1"><span className="text-[#ffd60a]">•</span><span>{renderInlineMarkdown(line.slice(2))}</span></div>;
        if (/^\d+\. /.test(line)) {
          const marker = line.match(/^\d+\./)?.[0] ?? "";
          return <div key={key} className="flex gap-2 pl-1"><span className="font-medium text-[#99958f]">{marker}</span><span>{renderInlineMarkdown(line.slice(marker.length + 1))}</span></div>;
        }
        if (line.startsWith("> ")) return <blockquote key={key} className="my-2 border-l-2 border-[#ffd60a]/50 pl-3 italic text-[#6e6962] dark:text-[#aaa6a0]">{renderInlineMarkdown(line.slice(2))}</blockquote>;
        if (/^---+$/.test(line.trim())) return <hr key={key} className="my-4 border-[#e2ded7] dark:border-white/10" />;
        if (!line.trim()) return <div key={key} className={compact ? "h-2" : "h-3"} />;
        return <p key={key}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
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
  note: MockNote;
  onOpen: (note: MockNote) => void;
}

function NoteCard({ note, onOpen }: NoteCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(note)}
      className="group w-full border-b border-white/[0.09] px-4 py-3 text-left transition last:border-b-0 active:bg-white/[0.045]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[17px] font-semibold tracking-[-0.015em] text-[#f5f5f7]">{note.title}</h3>
          {note.pinned && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffd60a]" title="Pinned" />}
        </div>
        <p className="mt-0.5 truncate text-[14px] leading-5 text-[#98989f]"><span className="mr-2 text-[#b7b7bd]">{note.updated}</span>{note.preview}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#98989f]">
          <Folder className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span>{note.type}</span>
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
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center gap-2.5 bg-gradient-to-t from-black via-black/95 to-transparent px-5 pb-7 pt-8">
      <label className="pointer-events-auto relative min-w-0 flex-1">
        <span className="sr-only">Search notes</span>
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#f2f2f7]" strokeWidth={2.1} />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search"
          className="h-[52px] rounded-[26px] border border-white/[0.14] bg-[#303033]/95 pl-12 pr-10 text-[17px] text-white shadow-[0_8px_28px_rgba(0,0,0,0.36)] backdrop-blur-xl placeholder:text-[#b0b0b6] focus-visible:ring-1 focus-visible:ring-[#ffd60a]/70"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-1 text-[#c8c8ce]" aria-label="Clear search">
            <X className="h-3 w-3" />
          </button>
        )}
      </label>
      <button type="button" onClick={onCreate} className="pointer-events-auto flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-[#303033]/95 text-[#ffd60a] shadow-[0_8px_28px_rgba(0,0,0,0.36)] backdrop-blur-xl transition active:scale-95" aria-label="Create a new note">
        <Plus className="h-7 w-7" strokeWidth={2.2} />
      </button>
    </div>
  );
}

interface LibraryDrawerProps {
  notes: MockNote[];
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
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffd60a] text-black"><FileText className="h-[18px] w-[18px]" /></span>
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
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffd60a] text-black"><Folder className="h-[18px] w-[18px]" /></span>
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
  note: MockNote;
  onBack: () => void;
}

function NoteView({ note, onBack }: NoteViewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <header className="flex h-12 shrink-0 items-center justify-between px-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-[#f0efed] hover:bg-[#e9e7e3] dark:bg-white/[0.08] dark:text-[#f5f3ef] dark:hover:bg-white/[0.12]" onClick={onBack} aria-label="Back to notes"><ArrowLeft className="h-5 w-5" /></Button>
        <span className="text-xs font-medium text-[#99958f] dark:text-[#8b8883]">{note.type}</span>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full dark:text-[#f5f3ef]" onClick={() => setEditing((value) => !value)} aria-label={editing ? "Finish editing" : "Note options"}>
          {editing ? <Check className="h-5 w-5 text-[#ffd60a]" /> : <MoreHorizontal className="h-5 w-5" />}
        </Button>
      </header>
      <main className={cn("min-h-0 flex-1 px-6 pt-5", editing ? "flex flex-col overflow-hidden pb-0" : "overflow-y-auto pb-10")}>
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-[#77736f]"><span className="text-[#ffd60a]">#{note.type.toLowerCase()}</span><span>·</span><span>Edited {note.updated} ago</span></div>
        <h1 className="text-[36px] font-bold leading-[1.06] tracking-[-0.045em] text-[#24221f] dark:text-[#f5f3ef]">{note.title}</h1>
        {editing ? (
          <div className="mobile-note-editor -mx-6 mt-2 min-h-0 flex-1 overflow-hidden [&_[role=toolbar]]:hidden [&_.cm-content]:!px-6 [&_.cm-content]:!pb-28 [&_.cm-content]:!pt-3 [&_.cm-scroller]:overscroll-contain">
            <MarkdownEditor
              noteId={`mobile-${note.id}`}
              initialContent={draft}
              getLinkableTitles={() => []}
              isTitleResolved={() => false}
              onChange={setDraft}
              onFollowLink={() => undefined}
              placeholderText="Start writing…"
              firstLineIsTitle={false}
            />
          </div>
        ) : (
          <div className="mt-6"><MarkdownPreview markdown={draft} /></div>
        )}
      </main>
      {!editing && (
        <div className="shrink-0 border-t border-white/[0.06] bg-black/90 px-5 py-3 backdrop-blur-xl">
          <Button onClick={() => setEditing(true)} variant="outline" className="h-10 w-full rounded-xl border-[#e8e4dd] bg-white text-sm font-semibold shadow-none dark:border-white/10 dark:bg-[#242424] dark:text-[#f5f3ef]">Edit note</Button>
        </div>
      )}
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
          <Button variant="ghost" className="h-9 px-3 text-sm font-semibold text-[#ffd60a] hover:text-[#ffd60a]" disabled={!title.trim()} onClick={() => onSave(title.trim(), body)}>Save</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="Note title" className="h-auto border-0 bg-transparent px-0 text-[36px] font-bold leading-[1.06] tracking-[-0.045em] shadow-none placeholder:text-[#c1bdb7] focus-visible:ring-0 dark:text-[#f5f3ef] dark:placeholder:text-[#5e5b57] md:text-[36px]" />
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
        <div className="flex items-center gap-2 border-t border-black/[0.06] px-5 pb-7 pt-3 text-xs text-[#77736d] dark:border-white/[0.06] dark:text-[#aaa6a0]"><Hash className="h-4 w-4 text-[#ffd60a]" /><span>ideas</span><ChevronRight className="ml-auto h-4 w-4" /></div>
      </div>
    </div>
  );
}

export function MobileGrimoire() {
  const [notes, setNotes] = useState(INITIAL_NOTES);
  const [selectedNote, setSelectedNote] = useState<MockNote | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredNotes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return notes;
    return notes.filter((note) => `${note.title} ${note.preview} ${note.type}`.toLowerCase().includes(term));
  }, [notes, query]);

  const saveQuickNote = (title: string, body: string) => {
    const content = body.trim() || "A new thought, captured on mobile.";
    const note: MockNote = { id: Date.now(), title, preview: content.replace(/[-#*`>]/g, "").split("\n").find(Boolean) ?? "New note", body: content, type: "Ideas", emoji: "💡", updated: "Now" };
    setNotes((current) => [note, ...current]);
    setComposerOpen(false);
  };

  const pinnedNotes = filteredNotes.filter((note) => note.pinned);
  const recentNotes = filteredNotes.filter((note) => !note.pinned);

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0d0d0d] p-0 sm:p-8">
      <section className="mobile-grimoire-dark relative flex h-[100dvh] w-full max-w-[393px] flex-col overflow-hidden bg-black text-[#f5f3ef] sm:h-[852px] sm:rounded-[42px] sm:border-[7px] sm:border-[#080808] sm:shadow-[0_28px_70px_rgba(0,0,0,0.6)]" aria-label="Grimoire iOS prototype">
        <StatusBar />
        {selectedNote ? (
          <NoteView note={selectedNote} onBack={() => setSelectedNote(null)} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pb-28">
            <header className="sticky top-0 z-20 grid grid-cols-[44px_1fr_44px] items-center border-b border-white/[0.08] bg-black/90 px-4 pb-3 pt-1 backdrop-blur-xl">
              <Button variant="ghost" size="icon" onClick={() => setLibraryOpen(true)} className="h-11 w-11 rounded-full bg-[#2c2c2e] text-[#f5f5f7] hover:bg-[#363638]" aria-label="Open library"><Menu className="h-[21px] w-[21px]" /></Button>
              <div className="min-w-0 text-center"><h1 className="truncate text-[19px] font-semibold tracking-[-0.02em]">All Notes</h1><p className="mt-0.5 text-[14px] text-[#8e8e93]">{filteredNotes.length} {filteredNotes.length === 1 ? "Note" : "Notes"}</p></div>
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-[#2c2c2e] text-[#f5f5f7] hover:bg-[#363638]" aria-label="Settings"><Settings className="h-[20px] w-[20px]" /></Button>
            </header>
            <main className="px-4 pb-8 pt-6">
              {query ? (
                <section><h2 className="mb-3 px-1 text-[24px] font-bold tracking-[-0.035em]">Search Results</h2>{filteredNotes.length > 0 ? <div className="overflow-hidden rounded-[18px] bg-[#1c1c1e]">{filteredNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={setSelectedNote} />)}</div> : <div className="rounded-[18px] bg-[#1c1c1e] px-5 py-12 text-center"><Search className="mx-auto h-7 w-7 text-[#636366]" /><p className="mt-3 text-[16px] font-semibold">No notes found</p><p className="mt-1 text-sm text-[#8e8e93]">Try a different search.</p></div>}</section>
              ) : (
                <div className="space-y-7">
                  {pinnedNotes.length > 0 && <section><h2 className="mb-3 px-1 text-[24px] font-bold tracking-[-0.035em]">Pinned</h2><div className="overflow-hidden rounded-[18px] bg-[#1c1c1e]">{pinnedNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={setSelectedNote} />)}</div></section>}
                  {recentNotes.length > 0 && <section><h2 className="mb-3 px-1 text-[24px] font-bold tracking-[-0.035em]">Previous 30 Days</h2><div className="overflow-hidden rounded-[18px] bg-[#1c1c1e]">{recentNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={setSelectedNote} />)}</div></section>}
                </div>
              )}
            </main>
          </div>
        )}
        {!selectedNote && <BottomSearch query={query} onQueryChange={setQuery} onCreate={() => setComposerOpen(true)} />}
        {libraryOpen && <LibraryDrawer notes={notes} onClose={() => setLibraryOpen(false)} onSelectAll={() => { setQuery(""); setLibraryOpen(false); }} onSelectType={(type) => { setQuery(type); setLibraryOpen(false); }} />}
        {composerOpen && <Composer onClose={() => setComposerOpen(false)} onSave={saveQuickNote} />}
        <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-50 h-1 w-32 -translate-x-1/2 rounded-full bg-[#f5f3ef]" />
      </section>
      <div className="pointer-events-none fixed bottom-5 right-6 hidden items-center gap-2 rounded-full bg-[#232323]/90 px-3 py-2 text-xs font-medium text-[#aaa6a0] shadow-sm backdrop-blur sm:flex"><FileText className="h-3.5 w-3.5" />Interactive iOS prototype</div>
    </div>
  );
}

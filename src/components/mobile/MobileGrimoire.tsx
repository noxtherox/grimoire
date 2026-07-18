import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Hash,
  Home,
  Library,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { cn } from "@/lib/utils";

type Tab = "home" | "library";

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
      return <a key={key} href={link[2]} className="font-medium text-[#d84b40] underline decoration-[#d84b40]/30 underline-offset-2" onClick={(event) => event.preventDefault()}>{link[1]}</a>;
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
        if (/^[-*] /.test(line)) return <div key={key} className="flex gap-2 pl-1"><span className="text-[#d84b40]">•</span><span>{renderInlineMarkdown(line.slice(2))}</span></div>;
        if (/^\d+\. /.test(line)) {
          const marker = line.match(/^\d+\./)?.[0] ?? "";
          return <div key={key} className="flex gap-2 pl-1"><span className="font-medium text-[#99958f]">{marker}</span><span>{renderInlineMarkdown(line.slice(marker.length + 1))}</span></div>;
        }
        if (line.startsWith("> ")) return <blockquote key={key} className="my-2 border-l-2 border-[#d84b40]/50 pl-3 italic text-[#6e6962] dark:text-[#aaa6a0]">{renderInlineMarkdown(line.slice(2))}</blockquote>;
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
      className="group w-full border-b border-black/[0.055] px-1 py-4 text-left transition active:bg-black/[0.025] dark:border-white/[0.065] dark:active:bg-white/[0.035]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eeeae3] text-base dark:bg-white/[0.07]" aria-hidden="true">{note.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-[#22211f] dark:text-[#f2efea]">{note.title}</h3>
            {note.pinned && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d84b40]" title="Pinned" />}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.4] text-[#797671] dark:text-[#9b9893]">{note.preview}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-[#aaa6a0] dark:text-[#74716d]">
            <span className="text-[#d84b40] dark:text-[#ef6b62]">#{note.type.toLowerCase()}</span><span>·</span><span>{note.updated}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  onCreate: () => void;
}

function BottomNav({ active, onChange, onCreate }: BottomNavProps) {
  return (
    <nav className="relative flex h-[82px] shrink-0 items-start justify-around border-t border-black/[0.06] bg-white/90 px-5 pt-2.5 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#1c1d1e]/95" aria-label="Main navigation">
      <button type="button" onClick={() => onChange("home")} className={cn("flex w-16 flex-col items-center gap-1 text-[10px] font-medium", active === "home" ? "text-[#d84b40]" : "text-[#8e8a85]")}>
        <Home className="h-[21px] w-[21px]" strokeWidth={active === "home" ? 2.4 : 1.8} />
        Home
      </button>
      <button type="button" onClick={onCreate} className="-mt-6 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#df5149] text-white shadow-[0_8px_24px_rgba(223,81,73,0.34)] transition active:scale-95" aria-label="Create a new note">
        <Plus className="h-6 w-6" />
      </button>
      <button type="button" onClick={() => onChange("library")} className={cn("flex w-16 flex-col items-center gap-1 text-[10px] font-medium", active === "library" ? "text-[#d84b40]" : "text-[#8e8a85]")}>
        <Library className="h-[21px] w-[21px]" strokeWidth={active === "library" ? 2.4 : 1.8} />
        Library
      </button>
    </nav>
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
    <div className="flex min-h-0 flex-1 flex-col bg-[#fffefa] dark:bg-[#1c1d1e]">
      <header className="flex h-12 shrink-0 items-center justify-between px-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-[#f0efed] hover:bg-[#e9e7e3] dark:bg-white/[0.08] dark:text-[#f5f3ef] dark:hover:bg-white/[0.12]" onClick={onBack} aria-label="Back to notes"><ArrowLeft className="h-5 w-5" /></Button>
        <span className="text-xs font-medium text-[#99958f] dark:text-[#8b8883]">{note.type}</span>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full dark:text-[#f5f3ef]" onClick={() => setEditing((value) => !value)} aria-label={editing ? "Finish editing" : "Note options"}>
          {editing ? <Check className="h-5 w-5 text-[#d84b40]" /> : <MoreHorizontal className="h-5 w-5" />}
        </Button>
      </header>
      <main className={cn("min-h-0 flex-1 px-6 pt-5", editing ? "flex flex-col overflow-hidden pb-0" : "overflow-y-auto pb-10")}>
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-[#aaa6a0] dark:text-[#77736f]"><span className="text-[#df5149]">#{note.type.toLowerCase()}</span><span>·</span><span>Edited {note.updated} ago</span></div>
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
        <div className="shrink-0 border-t border-black/[0.05] bg-white/80 px-5 py-3 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#181818]/90">
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
          <Button variant="ghost" className="h-9 px-3 text-sm font-semibold text-[#d84b40] hover:text-[#d84b40]" disabled={!title.trim()} onClick={() => onSave(title.trim(), body)}>Save</Button>
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
        <div className="flex items-center gap-2 border-t border-black/[0.06] px-5 pb-7 pt-3 text-xs text-[#77736d] dark:border-white/[0.06] dark:text-[#aaa6a0]"><Hash className="h-4 w-4 text-[#df5149]" /><span>ideas</span><ChevronRight className="ml-auto h-4 w-4" /></div>
      </div>
    </div>
  );
}

export function MobileGrimoire() {
  const [tab, setTab] = useState<Tab>("home");
  const [notes, setNotes] = useState(INITIAL_NOTES);
  const [selectedNote, setSelectedNote] = useState<MockNote | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
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
    setTab("home");
  };

  const changeTab = (nextTab: Tab) => {
    setSelectedNote(null);
    setTab(nextTab);
  };

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0d0d0d] p-0 sm:p-8">
      <section className="mobile-grimoire-dark relative flex h-[100dvh] w-full max-w-[393px] flex-col overflow-hidden bg-[#1c1d1e] text-[#f5f3ef] sm:h-[852px] sm:rounded-[42px] sm:border-[7px] sm:border-[#080808] sm:shadow-[0_28px_70px_rgba(0,0,0,0.6)]" aria-label="Grimoire iOS prototype">
        <StatusBar />
        {selectedNote ? (
          <NoteView note={selectedNote} onBack={() => setSelectedNote(null)} />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "home" && (
                <main className="px-5 pb-8">
                  <header className="flex items-center justify-between pb-4 pt-3">
                    <button type="button" className="flex items-center gap-1.5 text-left" aria-label="Choose note collection">
                      <h1 className="text-[30px] font-bold tracking-[-0.045em]">Notes</h1>
                      <ChevronDown className="mt-1 h-4 w-4 text-[#77736f]" />
                    </button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-[#aaa6a0] hover:bg-white/[0.06] hover:text-[#f5f3ef]" aria-label="Settings"><Settings className="h-[18px] w-[18px]" /></Button>
                  </header>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#65625f]">{notes.length} notes</p>
                  <div>{notes.slice(0, 4).map((note) => <NoteCard key={note.id} note={note} onOpen={setSelectedNote} />)}</div>
                </main>
              )}
              {tab === "library" && (
                <main className="px-5 pb-8">
                  <header className="pb-4 pt-3"><p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#65625f]">Organize</p><h1 className="mt-0.5 text-[30px] font-bold tracking-[-0.045em]">Tags</h1></header>
                  <div className="relative mb-5"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77736e]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" className="h-11 rounded-[14px] border border-white/[0.06] bg-[#242424] pl-10 text-[15px] text-[#f5f3ef] shadow-none placeholder:text-[#77736e] focus-visible:ring-1 focus-visible:ring-[#d84b40]/50" />{query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-0.5 text-[#aaa6a0]" aria-label="Clear search"><X className="h-3 w-3" /></button>}</div>
                  {query ? (
                    <>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#aaa6a0]">{filteredNotes.length} {filteredNotes.length === 1 ? "result" : "results"}</p>
                      <div className="space-y-2.5">{filteredNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={setSelectedNote} />)}</div>
                      {filteredNotes.length === 0 && <div className="py-16 text-center"><BookOpen className="mx-auto h-8 w-8 text-[#c3bfb8]" /><p className="mt-3 text-sm font-semibold">No notes found</p><p className="mt-1 text-xs text-[#99958f]">Try a different word or type.</p></div>}
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#65625f]">All tags</p>
                      <div className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#222324]">
                        {TYPES.map((type) => (
                          <button type="button" key={type.name} className="flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition last:border-b-0 active:bg-white/[0.04]" onClick={() => setQuery(type.name)}>
                            <span className={cn("flex h-8 w-8 items-center justify-center rounded-[9px] text-sm", type.color)}>{type.emoji}</span>
                            <span className="flex-1 text-[15px] font-medium">{type.name.toLowerCase()}</span><span className="text-xs text-[#77736f]">{type.count}</span><ChevronRight className="h-4 w-4 text-[#5d5a57]" />
                          </button>
                        ))}
                      </div>
                      <button type="button" className="mt-4 flex w-full items-center gap-3 rounded-[14px] border border-dashed border-white/15 px-4 py-3.5 text-sm font-semibold text-[#aaa6a0]"><Hash className="h-4 w-4 text-[#df5149]" />New tag</button>
                    </>
                  )}
                </main>
              )}
            </div>
            <BottomNav active={tab} onChange={changeTab} onCreate={() => setComposerOpen(true)} />
          </>
        )}
        {composerOpen && <Composer onClose={() => setComposerOpen(false)} onSave={saveQuickNote} />}
        <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-50 h-1 w-32 -translate-x-1/2 rounded-full bg-[#f5f3ef]" />
      </section>
      <div className="pointer-events-none fixed bottom-5 right-6 hidden items-center gap-2 rounded-full bg-[#232323]/90 px-3 py-2 text-xs font-medium text-[#aaa6a0] shadow-sm backdrop-blur sm:flex"><FileText className="h-3.5 w-3.5" />Interactive iOS prototype</div>
    </div>
  );
}

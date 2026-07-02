import { Hash, Notebook, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Note, getMainTagCounts } from "@/lib/note-utils";
import type { NoteFilter } from "@/lib/filters";

interface SidebarProps {
  notes: Note[];
  filter: NoteFilter;
  onFilterChange: (filter: NoteFilter) => void;
}

function SidebarRow({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
        active
          ? "bg-white/15 text-white"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs tabular-nums text-zinc-500">{count}</span>
      )}
    </button>
  );
}

export function Sidebar({ notes, filter, onFilterChange }: SidebarProps) {
  const tagCounts = getMainTagCounts(notes);
  const activeCount = notes.filter((note) => !note.trashed).length;
  const trashCount = notes.filter((note) => note.trashed).length;

  return (
    <div className="flex h-full flex-col bg-[hsl(240_6%_13%)] pt-4">
      <div className="px-4 pb-3">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-300">
          🐻 Ursa
        </h1>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        <SidebarRow
          active={filter.kind === "all"}
          onClick={() => onFilterChange({ kind: "all" })}
          icon={<Notebook size={15} />}
          label="All Notes"
          count={activeCount}
        />
        <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
          Main tags
        </div>
        {[...tagCounts.entries()].map(([tag, count]) => (
          <SidebarRow
            key={tag}
            active={filter.kind === "tag" && filter.tag === tag}
            onClick={() => onFilterChange({ kind: "tag", tag })}
            icon={<Hash size={15} />}
            label={tag}
            count={count}
          />
        ))}
      </nav>
      <div className="border-t border-white/10 p-2">
        <SidebarRow
          active={filter.kind === "trash"}
          onClick={() => onFilterChange({ kind: "trash" })}
          icon={<Trash2 size={15} />}
          label="Trash"
          count={trashCount}
        />
      </div>
    </div>
  );
}

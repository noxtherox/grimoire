import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Notebook,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Note,
  type TypeNode,
  buildTypeTree,
  isTrashed,
  typeKey,
} from "@/lib/note-utils";
import type { NoteFilter } from "@/lib/filters";
import { chooseVaultFolder, reloadVault } from "@/store/notes-store";

interface SidebarProps {
  notes: Note[];
  filter: NoteFilter;
  isDesktop: boolean;
  vaultLocation: string | null;
  onFilterChange: (filter: NoteFilter) => void;
}

function SidebarRow({
  active,
  onClick,
  icon,
  label,
  count,
  depth = 0,
  chevron,
  onToggle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  depth?: number;
  chevron?: "open" | "closed" | "leaf";
  onToggle?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center rounded-md text-sm transition-colors",
        active
          ? "bg-white/15 text-white"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
      style={{ paddingLeft: `${depth * 14}px` }}
    >
      {chevron !== undefined && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.();
          }}
          className={cn(
            "flex h-6 w-5 shrink-0 items-center justify-center text-zinc-500 hover:text-zinc-300",
            chevron === "leaf" && "pointer-events-none opacity-0",
          )}
          tabIndex={-1}
        >
          {chevron === "open" ? (
            <ChevronDown size={13} />
          ) : (
            <ChevronRight size={13} />
          )}
        </button>
      )}
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
      >
        <span className="shrink-0 opacity-80">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && (
          <span className="text-xs tabular-nums text-zinc-500">{count}</span>
        )}
      </button>
    </div>
  );
}

function TypeTreeRows({
  nodes,
  depth,
  filter,
  expanded,
  onFilterChange,
  onToggle,
}: {
  nodes: TypeNode[];
  depth: number;
  filter: NoteFilter;
  expanded: Set<string>;
  onFilterChange: (filter: NoteFilter) => void;
  onToggle: (key: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const key = typeKey(node.path);
        const isOpen = expanded.has(key);
        const active =
          filter.kind === "type" && typeKey(filter.path) === key;
        return (
          <div key={key}>
            <SidebarRow
              active={active}
              onClick={() => onFilterChange({ kind: "type", path: node.path })}
              icon={
                isOpen && node.children.length ? (
                  <FolderOpen size={15} />
                ) : (
                  <Folder size={15} />
                )
              }
              label={node.name}
              count={node.count}
              depth={depth}
              chevron={
                node.children.length ? (isOpen ? "open" : "closed") : "leaf"
              }
              onToggle={() => onToggle(key)}
            />
            {isOpen && node.children.length > 0 && (
              <TypeTreeRows
                nodes={node.children}
                depth={depth + 1}
                filter={filter}
                expanded={expanded}
                onFilterChange={onFilterChange}
                onToggle={onToggle}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export function Sidebar({
  notes,
  filter,
  isDesktop,
  vaultLocation,
  onFilterChange,
}: SidebarProps) {
  const tree = buildTypeTree(notes);
  const activeCount = notes.filter((note) => !isTrashed(note)).length;
  const trashCount = notes.filter((note) => isTrashed(note)).length;

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // expanded = everything not explicitly collapsed (small trees read better open)
  const expanded = new Set<string>();
  const walk = (nodes: TypeNode[]) => {
    for (const node of nodes) {
      const key = typeKey(node.path);
      if (!collapsed.has(key)) expanded.add(key);
      walk(node.children);
    }
  };
  walk(tree);

  const toggle = (key: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const vaultName = vaultLocation?.split("/").filter(Boolean).pop();

  return (
    <div className="flex h-full flex-col bg-[hsl(240_6%_13%)] pt-4">
      <div className="flex items-center justify-between px-4 pb-3">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-300">
          📖 Grimoire
        </h1>
        <button
          onClick={() => void reloadVault()}
          title="Reload vault from disk"
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <RefreshCw size={13} />
        </button>
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
          Types
        </div>
        <TypeTreeRows
          nodes={tree}
          depth={0}
          filter={filter}
          expanded={expanded}
          onFilterChange={onFilterChange}
          onToggle={toggle}
        />
      </nav>
      <div className="space-y-0.5 border-t border-white/10 p-2">
        <SidebarRow
          active={filter.kind === "trash"}
          onClick={() => onFilterChange({ kind: "trash" })}
          icon={<Trash2 size={15} />}
          label="Trash"
          count={trashCount}
        />
        {isDesktop && (
          <button
            onClick={() => void chooseVaultFolder()}
            title={vaultLocation ?? undefined}
            className="w-full truncate rounded-md px-3 py-1 text-left text-[11px] text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
          >
            Vault: {vaultName ?? "choose folder…"}
          </button>
        )}
      </div>
    </div>
  );
}

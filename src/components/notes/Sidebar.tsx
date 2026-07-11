import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Notebook,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Note,
  type TypeNode,
  buildTypeTree,
  isTrashed,
  parseTypePath,
  typeKey,
} from "@/lib/note-utils";
import type { NoteFilter } from "@/lib/filters";
import {
  chooseVaultFolder,
  createType,
  deleteType,
  reloadVault,
} from "@/store/notes-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface SidebarProps {
  notes: Note[];
  /** Types that exist without notes (empty folders) — shown with count 0. */
  extraTypes: string[][];
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
  onDeleteType,
}: {
  nodes: TypeNode[];
  depth: number;
  filter: NoteFilter;
  expanded: Set<string>;
  onFilterChange: (filter: NoteFilter) => void;
  onToggle: (key: string) => void;
  onDeleteType: (node: TypeNode) => void;
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
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div>
                  <SidebarRow
                    active={active}
                    onClick={() =>
                      onFilterChange({ kind: "type", path: node.path })
                    }
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
                      node.children.length
                        ? isOpen
                          ? "open"
                          : "closed"
                        : "leaf"
                    }
                    onToggle={() => onToggle(key)}
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  className="text-destructive"
                  onClick={() => onDeleteType(node)}
                >
                  <Trash2 size={14} className="mr-2" /> Delete type
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {isOpen && node.children.length > 0 && (
              <TypeTreeRows
                nodes={node.children}
                depth={depth + 1}
                filter={filter}
                expanded={expanded}
                onFilterChange={onFilterChange}
                onToggle={onToggle}
                onDeleteType={onDeleteType}
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
  extraTypes,
  filter,
  isDesktop,
  vaultLocation,
  onFilterChange,
}: SidebarProps) {
  const tree = buildTypeTree(notes, extraTypes);
  const activeCount = notes.filter((note) => !isTrashed(note)).length;
  const trashCount = notes.filter((note) => isTrashed(note)).length;

  // null = not creating a type; otherwise the draft text in the inline input
  const [typeDraft, setTypeDraft] = useState<string | null>(null);

  const submitNewType = async () => {
    const path = parseTypePath(typeDraft ?? "");
    setTypeDraft(null);
    if (!path.length) return;
    const created = await createType(path);
    if (created) onFilterChange({ kind: "type", path });
  };

  // Type pending a delete confirmation, or null when no dialog is open
  const [deleteTarget, setDeleteTarget] = useState<TypeNode | null>(null);

  const confirmDeleteType = async () => {
    if (!deleteTarget) return;
    const key = typeKey(deleteTarget.path);
    setDeleteTarget(null);
    const deleted = await deleteType(deleteTarget.path);
    if (!deleted) return;
    const activeKey = filter.kind === "type" ? typeKey(filter.path) : null;
    if (activeKey && (activeKey === key || activeKey.startsWith(`${key}/`))) {
      onFilterChange({ kind: "all" });
    }
  };

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
        <div className="flex items-center justify-between pb-1 pl-3 pr-2 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
            Types
          </span>
          <button
            onClick={() => setTypeDraft("")}
            title="New type — it can stay empty until you add notes"
            className="text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <Plus size={13} />
          </button>
        </div>
        {typeDraft !== null && (
          <form
            className="px-1 pb-1"
            onSubmit={(event) => {
              event.preventDefault();
              void submitNewType();
            }}
          >
            <input
              autoFocus
              value={typeDraft}
              onChange={(event) => setTypeDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setTypeDraft(null);
              }}
              onBlur={() => setTypeDraft(null)}
              placeholder="new type (e.g. work/projects)"
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/25"
            />
          </form>
        )}
        <TypeTreeRows
          nodes={tree}
          depth={0}
          filter={filter}
          expanded={expanded}
          onFilterChange={onFilterChange}
          onToggle={toggle}
          onDeleteType={setDeleteTarget}
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
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete type "{deleteTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.count > 0
                ? `${deleteTarget.count} note${deleteTarget.count === 1 ? "" : "s"} in this type will be moved to Trash.`
                : "This type has no notes."}
              {deleteTarget && deleteTarget.children.length > 0 && (
                <> Its sub-types will be deleted too.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => void confirmDeleteType()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Files,
  Notebook,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Smile,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Note,
  type TypeNode,
  buildTypeTree,
  isExternalNote,
  isTrashed,
  parseTypePath,
  typeKey,
} from "@/lib/note-utils";
import type { NoteFilter } from "@/lib/filters";
import type { TypeIcons } from "@/lib/type-icons";
import {
  chooseVaultFolder,
  createType,
  deleteType,
  reloadVault,
  renameType,
  setTypeIcon,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeSettingsDialog } from "./ThemeSettingsDialog";
import { TypeIcon } from "./TypeIcon";
import { EmojiPickerDialog } from "./EmojiPickerDialog";

interface SidebarProps {
  notes: Note[];
  /** Types that exist without notes (empty folders) — shown with count 0. */
  extraTypes: string[][];
  /** Custom icon per type key — types without one get the folder glyph. */
  typeIcons: TypeIcons;
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
          ? "bg-grim-sidebar-fg/15 text-grim-sidebar-fg"
          : "text-grim-sidebar-fg/70 hover:bg-grim-sidebar-fg/5 hover:text-grim-sidebar-fg/90",
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
            "flex h-6 w-5 shrink-0 items-center justify-center text-grim-sidebar-fg/50 hover:text-grim-sidebar-fg/90",
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
          <span className="text-xs tabular-nums text-grim-sidebar-fg/50">
            {count}
          </span>
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
  typeIcons,
  onFilterChange,
  onToggle,
  onRenameType,
  onDeleteType,
  onChangeIcon,
}: {
  nodes: TypeNode[];
  depth: number;
  filter: NoteFilter;
  expanded: Set<string>;
  typeIcons: TypeIcons;
  onFilterChange: (filter: NoteFilter) => void;
  onToggle: (key: string) => void;
  onRenameType: (node: TypeNode) => void;
  onDeleteType: (node: TypeNode) => void;
  onChangeIcon: (node: TypeNode) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const key = typeKey(node.path);
        const isOpen = expanded.has(key);
        const active = filter.kind === "type" && typeKey(filter.path) === key;
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
                      <TypeIcon
                        icon={typeIcons[key]}
                        open={isOpen && node.children.length > 0}
                        size={15}
                      />
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
                <ContextMenuItem onClick={() => onChangeIcon(node)}>
                  <Smile size={14} className="mr-2" /> Change icon
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onRenameType(node)}>
                  <Pencil size={14} className="mr-2" /> Rename type
                </ContextMenuItem>
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
                typeIcons={typeIcons}
                onFilterChange={onFilterChange}
                onToggle={onToggle}
                onRenameType={onRenameType}
                onDeleteType={onDeleteType}
                onChangeIcon={onChangeIcon}
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
  typeIcons,
  filter,
  isDesktop,
  vaultLocation,
  onFilterChange,
}: SidebarProps) {
  const tree = buildTypeTree(notes, extraTypes);
  const activeCount = notes.filter(
    (note) => !isExternalNote(note) && !isTrashed(note),
  ).length;
  const externalCount = notes.filter(isExternalNote).length;
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

  // Type pending a rename, or null when no dialog is open
  const [renameTarget, setRenameTarget] = useState<TypeNode | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const startRename = (node: TypeNode) => {
    setRenameTarget(node);
    setRenameDraft(typeKey(node.path));
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const oldPath = renameTarget.path;
    const newPath = parseTypePath(renameDraft);
    if (!newPath.length || typeKey(newPath) === typeKey(oldPath)) {
      setRenameTarget(null);
      return;
    }
    const renamed = await renameType(oldPath, newPath);
    if (!renamed) return;
    setRenameTarget(null);
    const oldKey = typeKey(oldPath);
    if (filter.kind === "type") {
      const activeKey = typeKey(filter.path);
      if (activeKey === oldKey || activeKey.startsWith(`${oldKey}/`)) {
        onFilterChange({
          kind: "type",
          path: [...newPath, ...filter.path.slice(oldPath.length)],
        });
      }
    }
  };

  // Type whose icon is being edited, or null when the picker is closed
  const [iconTarget, setIconTarget] = useState<TypeNode | null>(null);

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

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-grim-sidebar pt-4">
      <div className="flex items-center justify-between px-4 pb-3">
        <h1 className="text-sm font-semibold tracking-wide text-grim-sidebar-fg/90">
          📖 Grimoire
        </h1>
        <button
          onClick={() => void reloadVault()}
          title="Reload vault from disk"
          className="text-grim-sidebar-fg/50 transition-colors hover:text-grim-sidebar-fg/90"
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
        {isDesktop && (
          <SidebarRow
            active={filter.kind === "external"}
            onClick={() => onFilterChange({ kind: "external" })}
            icon={<Files size={15} />}
            label="External Notes"
            count={externalCount}
          />
        )}
        <div className="flex items-center justify-between pb-1 pl-3 pr-2 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-grim-sidebar-fg/40">
            Types
          </span>
          <button
            onClick={() => setTypeDraft("")}
            title="New type — it can stay empty until you add notes"
            className="text-grim-sidebar-fg/40 transition-colors hover:text-grim-sidebar-fg/90"
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
              className="w-full rounded-md border border-grim-sidebar-fg/10 bg-grim-sidebar-fg/5 px-2 py-1 text-sm text-grim-sidebar-fg placeholder:text-grim-sidebar-fg/40 focus:outline-none focus:ring-1 focus:ring-grim-sidebar-fg/25"
            />
          </form>
        )}
        <TypeTreeRows
          nodes={tree}
          depth={0}
          filter={filter}
          expanded={expanded}
          typeIcons={typeIcons}
          onFilterChange={onFilterChange}
          onToggle={toggle}
          onRenameType={startRename}
          onDeleteType={setDeleteTarget}
          onChangeIcon={setIconTarget}
        />
      </nav>
      <div className="space-y-0.5 border-t border-grim-sidebar-fg/10 p-2">
        <SidebarRow
          active={settingsOpen}
          onClick={() => setSettingsOpen(true)}
          icon={<Settings size={15} />}
          label="Settings"
        />
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
            className="w-full truncate rounded-md px-3 py-1 text-left text-[11px] text-grim-sidebar-fg/40 transition-colors hover:bg-grim-sidebar-fg/5 hover:text-grim-sidebar-fg/70"
          >
            Vault: {vaultName ?? "choose folder…"}
          </button>
        )}
      </div>
      <ThemeSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <EmojiPickerDialog
        open={iconTarget !== null}
        typeName={iconTarget?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setIconTarget(null);
        }}
        onPick={(icon) => {
          if (iconTarget) setTypeIcon(iconTarget.path, icon);
        }}
      />
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename type "{renameTarget?.name}"</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitRename();
            }}
          >
            <Input
              autoFocus
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              placeholder="type (e.g. work/projects)"
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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

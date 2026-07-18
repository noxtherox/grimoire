import { useEffect, useState } from "react";
import {
  FolderCog,
  FolderOpen,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_THEME,
  type GrimoireTheme,
  THEME_PRESETS,
  THEME_TOKENS,
  applyTheme,
  isValidHex,
  loadTheme,
  saveTheme,
} from "@/lib/theme";
import { DEFAULT_TYPE, noteTitle, typeKey } from "@/lib/note-utils";
import {
  DEFAULT_NOTE_ALIGNMENT,
  DEFAULT_NOTE_WIDTH,
  loadNoteAlignment,
  loadNoteWidth,
  NOTE_ALIGNMENT_OPTIONS,
  NOTE_WIDTH_OPTIONS,
  saveNoteAlignment,
  saveNoteWidth,
  type NoteAlignment,
  type NoteWidth,
} from "@/lib/note-preferences";
import {
  addFileLocation,
  fileLocationUsages,
  getFileLocationMappings,
  mapFileLocation,
  removeFileLocation,
  renameFileLocation,
  useVault,
} from "@/store/notes-store";

/** Hex text field that tolerates partial input while typing. */
function HexInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Follow external changes (color picker, presets, reset)
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (isValidHex(next)) onCommit(next.trim());
      }}
      onBlur={() => setDraft(value)}
      spellCheck={false}
      className="w-20 rounded-md border border-border bg-transparent px-2 py-1 font-mono text-xs uppercase focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

interface ThemeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultNoteType: string[];
  hideSubtypeNotes: boolean;
  existingTypePaths: string[][];
  onDefaultNoteTypeChange: (typePath: string[]) => void;
  onHideSubtypeNotesChange: (hidden: boolean) => void;
}

export function ThemeSettingsDialog({
  open,
  onOpenChange,
  defaultNoteType,
  hideSubtypeNotes,
  existingTypePaths,
  onDefaultNoteTypeChange,
  onHideSubtypeNotesChange,
}: ThemeSettingsDialogProps) {
  const [theme, setTheme] = useState<GrimoireTheme>(loadTheme);
  const [noteWidth, setNoteWidth] = useState<NoteWidth>(loadNoteWidth);
  const [noteAlignment, setNoteAlignment] =
    useState<NoteAlignment>(loadNoteAlignment);
  const [locationDraft, setLocationDraft] = useState("");
  const { fileLocations, isDesktop } = useVault();
  const locationMappings = getFileLocationMappings();

  useEffect(() => {
    if (open) {
      setTheme(loadTheme());
      setNoteWidth(loadNoteWidth());
      setNoteAlignment(loadNoteAlignment());
    }
  }, [open]);

  // Changes apply immediately so you can preview them behind the dialog
  const update = (patch: Partial<GrimoireTheme>) => {
    setTheme((previous) => {
      const next = { ...previous, ...patch };
      applyTheme(next);
      saveTheme(next);
      return next;
    });
  };

  const defaultTypeKey = typeKey(defaultNoteType);
  const typeOptions = [
    DEFAULT_TYPE,
    ...existingTypePaths,
    defaultNoteType,
  ].filter(
    (path, index, paths) =>
      paths.findIndex((candidate) => typeKey(candidate) === typeKey(path)) ===
      index,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Choose how notes are displayed, created, and connected to files.
            File-location names sync with the vault; local folder mappings do not.
          </DialogDescription>
        </DialogHeader>
        <div>
          {isDesktop && (
            <>
              <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                File locations
              </p>
              <div className="mb-5 space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Names sync with the vault. Each device maps the name to its
                  own local cloud-folder root.
                </p>
                {fileLocations.map((location) => {
                  const usages = fileLocationUsages(location.id);
                  const mapped = locationMappings[location.id];
                  return (
                    <div key={location.id} className="rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <FolderCog size={14} className="shrink-0 text-muted-foreground" />
                        <Input
                          defaultValue={location.name}
                          className="h-7 min-w-0 flex-1 text-xs"
                          aria-label="File location name"
                          onBlur={(event) =>
                            renameFileLocation(location.id, event.target.value)
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => void mapFileLocation(location.id)}
                        >
                          <MapPin size={12} /> {mapped ? "Remap" : "Map"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={usages.length > 0}
                          title={
                            usages.length
                              ? `Used by: ${usages.map(noteTitle).join(", ")}`
                              : "Remove location"
                          }
                          onClick={() => removeFileLocation(location.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                      <p className="mt-1 truncate pl-6 text-[11px] text-muted-foreground">
                        {mapped ?? "Not configured on this device"}
                        {usages.length > 0 && ` · ${usages.length} hub${usages.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <Input
                    value={locationDraft}
                    onChange={(event) => setLocationDraft(event.target.value)}
                    placeholder="Company OneDrive"
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1 text-xs"
                    disabled={!locationDraft.trim()}
                    aria-label="Browse for the file location folder"
                    title="Browse for the local folder on this computer"
                    onClick={async () => {
                      if (await addFileLocation(locationDraft)) setLocationDraft("");
                    }}
                  >
                    <FolderOpen size={13} /> Browse folder
                  </Button>
                </div>
              </div>
            </>
          )}
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Note list
          </p>
          <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <label
                htmlFor="hide-subtype-notes"
                className="text-sm font-medium"
              >
                Hide sub-type notes
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                When a type is selected, show only notes directly inside that
                folder.
              </p>
            </div>
            <Switch
              id="hide-subtype-notes"
              checked={hideSubtypeNotes}
              onCheckedChange={onHideSubtypeNotesChange}
            />
          </div>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New notes
          </p>
          <div className="mb-5 rounded-lg border border-border p-3">
            <label
              htmlFor="default-note-type"
              className="block text-sm font-medium"
            >
              Default type
            </label>
            <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
              Used when you create a note from All Notes. If you do not choose
              one, Inbox is used.
            </p>
            <Select
              value={defaultTypeKey}
              onValueChange={(key) => {
                const next = typeOptions.find((path) => typeKey(path) === key);
                if (next) onDefaultNoteTypeChange(next);
              }}
            >
              <SelectTrigger id="default-note-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((path) => {
                  const key = typeKey(path);
                  return (
                    <SelectItem key={key} value={key}>
                      {key === typeKey(DEFAULT_TYPE)
                        ? "Inbox (default)"
                        : path.join(" / ")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <p className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance
          </p>
          <div className="mb-5 rounded-lg border border-border p-3">
            <label htmlFor="note-width" className="block text-sm font-medium">
              Note width
            </label>
            <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
              Sets the width of the writing area within the editor.
            </p>
            <Select
              value={String(noteWidth)}
              onValueChange={(value) => {
                const width = Number(value) as NoteWidth;
                setNoteWidth(width);
                saveNoteWidth(width);
              }}
            >
              <SelectTrigger id="note-width">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_WIDTH_OPTIONS.map((width) => (
                  <SelectItem key={width} value={String(width)}>
                    {width}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label
              htmlFor="note-alignment"
              className="mt-4 block text-sm font-medium"
            >
              Alignment
            </label>
            <Select
              value={noteAlignment}
              onValueChange={(value: NoteAlignment) => {
                setNoteAlignment(value);
                saveNoteAlignment(value);
              }}
            >
              <SelectTrigger id="note-alignment" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_ALIGNMENT_OPTIONS.map((alignment) => (
                  <SelectItem key={alignment} value={alignment}>
                    {alignment === "center" ? "Center" : "Left"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 pb-4">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => update(preset.theme)}
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
              >
                <span className="flex overflow-hidden rounded-full border border-black/10">
                  {[
                    preset.theme.sidebarBg,
                    preset.theme.surface,
                    preset.theme.accent,
                  ].map((color) => (
                    <span
                      key={color}
                      className="h-3 w-3"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                {preset.name}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            {THEME_TOKENS.map((token) => (
              <div
                key={token.key}
                className="flex items-center gap-3 rounded-md px-1 py-1.5"
              >
                <label
                  htmlFor={`theme-${token.key}`}
                  className="min-w-0 flex-1"
                >
                  <span className="block text-sm">{token.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {token.hint}
                  </span>
                </label>
                <HexInput
                  value={theme[token.key]}
                  onCommit={(hex) => update({ [token.key]: hex })}
                />
                <input
                  id={`theme-${token.key}`}
                  type="color"
                  value={theme[token.key]}
                  onChange={(event) =>
                    update({ [token.key]: event.target.value })
                  }
                  className="h-7 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                update(DEFAULT_THEME);
                setNoteWidth(DEFAULT_NOTE_WIDTH);
                saveNoteWidth(DEFAULT_NOTE_WIDTH);
                setNoteAlignment(DEFAULT_NOTE_ALIGNMENT);
                saveNoteAlignment(DEFAULT_NOTE_ALIGNMENT);
                onHideSubtypeNotesChange(false);
              }}
            >
              <RotateCcw size={13} /> Reset to defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

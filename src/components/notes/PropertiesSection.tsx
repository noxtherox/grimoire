import { useState } from "react";
import {
  Calendar,
  CheckSquare,
  Hash,
  List,
  Plus,
  SlidersHorizontal,
  Type as TypeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type PropertyValue, getNoteProperties } from "@/lib/frontmatter";
import {
  PROPERTY_TYPES,
  type PropertyDef,
  type PropertyType,
  effectiveProperties,
  inferPropertyType,
  sanitizePropertyName,
} from "@/lib/properties";
import { type Note, noteTypePath, typeKey } from "@/lib/note-utils";
import {
  addTypeProperty,
  removeTypeProperty,
  setNoteProperty,
  updateTypeProperty,
  useVault,
} from "@/store/notes-store";

const TYPE_ICONS: Record<PropertyType, typeof TypeIcon> = {
  text: TypeIcon,
  number: Hash,
  date: Calendar,
  checkbox: CheckSquare,
  list: List,
};

// ---- value editors -----------------------------------------------------------

interface ValueEditorProps {
  type: PropertyType;
  value: PropertyValue | undefined;
  onCommit: (value: PropertyValue | null) => void;
}

const inputClass =
  "h-6 rounded border-transparent bg-transparent px-1.5 text-xs shadow-none hover:bg-muted/60 focus-visible:bg-white focus-visible:ring-1";

const wrapEditorClass =
  "w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded px-1.5 py-1 text-xs leading-4";

interface WrapTextareaProps {
  value: string;
  placeholder?: string;
  onChange: (text: string) => void;
  onBlur?: () => void;
}

// Single-line look, but grows and wraps when the value is long. The invisible
// replica sizes the grid cell; the textarea stretches to match it.
function WrapTextarea({ value, placeholder, onChange, onBlur }: WrapTextareaProps) {
  return (
    <div className="grid">
      <span aria-hidden className={`${wrapEditorClass} invisible [grid-area:1/1]`}>
        {value || placeholder}{" "}
      </span>
      <textarea
        rows={1}
        value={value}
        placeholder={placeholder}
        className={`${wrapEditorClass} [grid-area:1/1] bg-transparent outline-none placeholder:text-muted-foreground hover:bg-muted/60 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-ring`}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={onBlur}
      />
    </div>
  );
}

function ListValueEditor({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (value: PropertyValue | null) => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <WrapTextarea
      value={text}
      placeholder="a, b, c"
      onChange={setText}
      onBlur={() => {
        const items = text
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        onCommit(items.length ? items : null);
      }}
    />
  );
}

function ValueEditor({ type, value, onCommit }: ValueEditorProps) {
  if (type === "checkbox") {
    return (
      <Checkbox
        className="ml-1.5 mt-1"
        checked={value === true}
        onCheckedChange={(checked) => onCommit(checked === true)}
      />
    );
  }
  if (type === "date") {
    return (
      <Input
        type="date"
        className={inputClass}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onCommit(e.target.value || null)}
      />
    );
  }
  if (type === "number") {
    const text = typeof value === "number" ? String(value) : "";
    return (
      <Input
        type="number"
        key={text}
        defaultValue={text}
        placeholder="Empty"
        className={inputClass}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        onBlur={(e) => {
          const parsed = parseFloat(e.target.value);
          onCommit(Number.isFinite(parsed) ? parsed : null);
        }}
      />
    );
  }
  if (type === "list") {
    const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return <ListValueEditor key={text} initial={text} onCommit={onCommit} />;
  }
  return (
    <WrapTextarea
      placeholder="Empty"
      value={value === undefined ? "" : String(value)}
      onChange={(text) => onCommit(text || null)}
    />
  );
}

// ---- add / edit definition form ------------------------------------------------

interface DefFormProps {
  initial?: PropertyDef;
  submitLabel: string;
  onSubmit: (def: PropertyDef) => void;
  onDelete?: () => void;
}

function DefForm({ initial, submitLabel, onSubmit, onDelete }: DefFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<PropertyType>(initial?.type ?? "text");
  const clean = sanitizePropertyName(name);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onSubmit({ name: clean, type });
      }}
    >
      <Input
        autoFocus
        value={name}
        placeholder="Property name"
        className="h-7 text-xs"
        onChange={(e) => setName(e.target.value)}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as PropertyType)}
        className="h-7 w-full rounded-md border border-input bg-white px-2 text-xs"
      >
        {PROPERTY_TYPES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={!clean}>
          {submitLabel}
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}

// ---- the section ----------------------------------------------------------------

interface PropertiesSectionProps {
  note: Note;
}

export function PropertiesSection({ note }: PropertiesSectionProps) {
  const { schemas } = useVault();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const typePath = noteTypePath(note);
  const ownKey = typeKey(typePath);
  const effective = effectiveProperties(typePath, schemas);
  const values = getNoteProperties(note.content);

  // frontmatter keys not covered by the type's definitions (ad-hoc properties)
  const covered = new Set(effective.map(({ def }) => def.name.toLowerCase()));
  const extras = Object.entries(values).filter(
    ([key]) => !covered.has(key.toLowerCase()),
  );

  const valueFor = (name: string): PropertyValue | undefined => {
    const match = Object.keys(values).find(
      (key) => key.toLowerCase() === name.toLowerCase(),
    );
    return match === undefined ? undefined : values[match];
  };

  return (
    <div className="border-b border-border/60">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <SlidersHorizontal size={13} />
        Properties
        <span className="normal-case font-normal tracking-normal">
          · {ownKey || "unfiled"}
        </span>
      </div>
      <div className="space-y-0.5 px-3 py-2.5">
        {effective.length === 0 && extras.length === 0 && (
          <p className="px-1 pb-1 text-xs text-muted-foreground">
            Properties added here apply to every{" "}
            <span className="font-medium">{ownKey || "unfiled"}</span> note.
          </p>
        )}
        {effective.map(({ def, ownerKey }) => {
          const Icon = TYPE_ICONS[def.type];
          const inherited = ownerKey !== ownKey;
          return (
            <div key={`${ownerKey}:${def.name}`} className="flex items-start gap-1">
              <Popover
                open={editing === `${ownerKey}:${def.name}`}
                onOpenChange={(open) =>
                  setEditing(open ? `${ownerKey}:${def.name}` : null)
                }
              >
                <PopoverTrigger asChild>
                  <button
                    className="flex w-28 shrink-0 items-center gap-1.5 rounded px-1 py-1 text-left text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    title={
                      inherited
                        ? `Defined on "${ownerKey}" — applies to all its sub-types`
                        : `Applies to every "${ownerKey || "unfiled"}" note`
                    }
                  >
                    <Icon size={12} className="shrink-0 opacity-70" />
                    <span className="truncate">{def.name}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Edits apply to all <span className="font-medium">{ownerKey}</span>{" "}
                    notes.
                  </p>
                  <DefForm
                    initial={def}
                    submitLabel="Save"
                    onSubmit={(next) => {
                      updateTypeProperty(ownerKey, def.name, next);
                      setEditing(null);
                    }}
                    onDelete={() => {
                      removeTypeProperty(ownerKey, def.name);
                      setEditing(null);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <div className="min-w-0 flex-1">
                <ValueEditor
                  type={def.type}
                  value={valueFor(def.name)}
                  onCommit={(value) => setNoteProperty(note.id, def.name, value)}
                />
              </div>
            </div>
          );
        })}
        {extras.map(([key, value]) => {
          const inferredType = inferPropertyType(value);
          const Icon = TYPE_ICONS[inferredType];
          return (
            <div key={key} className="flex items-start gap-1">
              <Popover
                open={editing === `extra:${key}`}
                onOpenChange={(open) => setEditing(open ? `extra:${key}` : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    className="flex w-28 shrink-0 items-center gap-1.5 rounded px-1 py-1 text-left text-xs italic text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    title="Only on this note — not part of the type"
                  >
                    <Icon size={12} className="shrink-0 opacity-70" />
                    <span className="truncate">{key}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 space-y-1.5 p-3" align="start">
                  <p className="text-xs text-muted-foreground">
                    Only on this note.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full justify-start text-xs"
                    onClick={() => {
                      const name = sanitizePropertyName(key);
                      if (name)
                        addTypeProperty(ownKey, { name, type: inferredType });
                      setEditing(null);
                    }}
                  >
                    <Plus size={12} className="mr-1.5" />
                    Add to “{ownKey || "unfiled"}”
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-full justify-start text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      setNoteProperty(note.id, key, null);
                      setEditing(null);
                    }}
                  >
                    Remove from note
                  </Button>
                </PopoverContent>
              </Popover>
              <div className="min-w-0 flex-1">
                <ValueEditor
                  type={inferredType}
                  value={value}
                  onCommit={(next) => setNoteProperty(note.id, key, next)}
                />
              </div>
            </div>
          );
        })}
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus size={12} />
              Add property
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <p className="mb-2 text-xs text-muted-foreground">
              Added to every <span className="font-medium">{ownKey || "unfiled"}</span>{" "}
              note.
            </p>
            <DefForm
              submitLabel="Add"
              onSubmit={(def) => {
                addTypeProperty(ownKey, def);
                setAddOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

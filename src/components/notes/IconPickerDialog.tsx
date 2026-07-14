import { useMemo, useState } from "react";
import { Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getIconComponent, iconSearchText, searchIcons } from "@/lib/type-icons";

/** Grid stays snappy without virtualization by capping visible matches. */
const MAX_VISIBLE = 120;

interface IconPickerDialogProps {
  open: boolean;
  /** Name of the type being edited — shown in the title. */
  typeName: string;
  /** Currently stored icon name, if the type has a custom one. */
  value?: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen icon name, or null to reset to the default folder. */
  onPick: (icon: string | null) => void;
}

export function IconPickerDialog({
  open,
  typeName,
  value,
  onOpenChange,
  onPick,
}: IconPickerDialogProps) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => searchIcons(query), [query]);
  const visible = matches.slice(0, MAX_VISIBLE);

  const pick = (icon: string | null) => {
    onPick(icon);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Icon for "{typeName}"</DialogTitle>
          <DialogDescription>
            Pick any icon from the Lucide set, or reset to the default folder.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons… (e.g. book, rocket, heart)"
        />
        <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto pr-1">
          {visible.map((name) => {
            const Icon = getIconComponent(name);
            if (!Icon) return null;
            return (
              <button
                key={name}
                title={iconSearchText(name)}
                onClick={() => pick(name)}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md text-foreground/75 transition-colors hover:bg-muted hover:text-foreground",
                  name === value &&
                    "bg-grim-accent/15 text-grim-accent hover:bg-grim-accent/20 hover:text-grim-accent",
                )}
              >
                <Icon size={17} />
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="col-span-8 py-6 text-center text-sm text-muted-foreground">
              No icons match "{query}".
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {matches.length > MAX_VISIBLE
              ? `Showing ${MAX_VISIBLE} of ${matches.length} — refine your search`
              : `${matches.length} icon${matches.length === 1 ? "" : "s"}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => pick(null)}
          >
            <Folder size={13} /> Reset to default
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

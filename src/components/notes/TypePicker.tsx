import { useState } from "react";
import { Check, ChevronDown, Folder, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseTypePath, typeKey } from "@/lib/note-utils";

interface TypePickerProps {
  value: string[];
  existingTypePaths: string[][];
  onChange: (typePath: string[]) => void;
}

export function TypePicker({
  value,
  existingTypePaths,
  onChange,
}: TypePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const parsed = parseTypePath(query);
  const parsedKey = typeKey(parsed);
  const canCreate =
    parsed.length > 0 &&
    !existingTypePaths.some((path) => typeKey(path) === parsedKey);

  const pick = (typePath: string[]) => {
    onChange(typePath);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 rounded-full border-[hsl(4_66%_55%/0.35)] bg-[hsl(4_66%_55%/0.06)] px-2.5 text-xs font-medium text-[hsl(4_50%_40%)] hover:bg-[hsl(4_66%_55%/0.12)] hover:text-[hsl(4_50%_35%)]"
          title="Type — the folder this note lives in (type / sub-type / sub-sub-type)"
        >
          <Folder size={12} />
          {value.length ? value.join(" / ") : "unfiled"}
          <ChevronDown size={12} className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Set type… (e.g. work/projects/polaris)"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No matching types.</CommandEmpty>
            <CommandGroup>
              {existingTypePaths.map((path) => {
                const key = typeKey(path);
                return (
                  <CommandItem key={key} value={key} onSelect={() => pick(path)}>
                    <Folder
                      size={13}
                      className="mr-2 shrink-0 opacity-60"
                      style={{ marginLeft: `${(path.length - 1) * 12}px` }}
                    />
                    {path[path.length - 1]}
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {path.length > 1 ? key : ""}
                    </span>
                    <Check
                      size={14}
                      className={cn(
                        "ml-auto shrink-0",
                        key === typeKey(value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
              {canCreate && (
                <CommandItem
                  value={`create-${parsedKey}`}
                  onSelect={() => pick(parsed)}
                >
                  <Plus size={13} className="mr-2 shrink-0" />
                  Create “{parsed.join(" / ")}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

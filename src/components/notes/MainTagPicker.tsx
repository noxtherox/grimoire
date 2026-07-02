import { useState } from "react";
import { Check, ChevronDown, Hash, Plus } from "lucide-react";
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

interface MainTagPickerProps {
  value: string;
  existingTags: string[];
  onChange: (tag: string) => void;
}

export function MainTagPicker({
  value,
  existingTags,
  onChange,
}: MainTagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, "-");
  const canCreate =
    normalizedQuery.length > 0 && !existingTags.includes(normalizedQuery);

  const pick = (tag: string) => {
    onChange(tag);
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
          title="Main tag — groups this note and its backlinks"
        >
          <Hash size={12} />
          {value}
          <ChevronDown size={12} className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Set main tag…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No matching tags.</CommandEmpty>
            <CommandGroup>
              {existingTags.map((tag) => (
                <CommandItem key={tag} value={tag} onSelect={() => pick(tag)}>
                  <Hash size={13} className="mr-2 opacity-60" />
                  {tag}
                  <Check
                    size={14}
                    className={cn(
                      "ml-auto",
                      tag === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem
                  value={`create-${normalizedQuery}`}
                  onSelect={() => pick(normalizedQuery)}
                >
                  <Plus size={13} className="mr-2" />
                  Create “{normalizedQuery}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

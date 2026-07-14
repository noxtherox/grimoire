import Picker from "@emoji-mart/react";
import { Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { emojiData } from "@/lib/type-icons";

interface EmojiPickerDialogProps {
  open: boolean;
  /** Name of the type being edited — shown in the title. */
  typeName: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen emoji, or null to reset to the default folder. */
  onPick: (icon: string | null) => void;
}

export function EmojiPickerDialog({
  open,
  typeName,
  onOpenChange,
  onPick,
}: EmojiPickerDialogProps) {
  const pick = (icon: string | null) => {
    onPick(icon);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-none">
        <DialogHeader>
          <DialogTitle>Icon for "{typeName}"</DialogTitle>
        </DialogHeader>
        <Picker
          data={emojiData}
          autoFocus
          theme="auto"
          previewPosition="none"
          onEmojiSelect={(emoji: { native?: string }) => {
            if (emoji.native) pick(emoji.native);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => pick(null)}
        >
          <Folder size={13} /> Reset to default folder
        </Button>
      </DialogContent>
    </Dialog>
  );
}

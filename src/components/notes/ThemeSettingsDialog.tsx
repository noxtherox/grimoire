import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
}

export function ThemeSettingsDialog({
  open,
  onOpenChange,
}: ThemeSettingsDialogProps) {
  const [theme, setTheme] = useState<GrimoireTheme>(loadTheme);

  useEffect(() => {
    if (open) setTheme(loadTheme());
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Theme</DialogTitle>
          <DialogDescription>
            Customize Grimoire's colors. Changes apply immediately and are
            saved on this device.
          </DialogDescription>
        </DialogHeader>
        <div>
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
              onClick={() => update(DEFAULT_THEME)}
            >
              <RotateCcw size={13} /> Reset to defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * App-wide color theme. Every distinctive Grimoire color lives behind a
 * `--grim-*` CSS variable (an "R G B" triplet so Tailwind opacity modifiers
 * like `bg-grim-accent/10` keep working). This module owns loading, saving
 * and applying those variables; defaults live in globals.css.
 */

export interface GrimoireTheme {
  /** Highlight color: pins, selection tint, tags, cursor, type chip. */
  accent: string;
  /** Wikilinks, URLs and relation chips. */
  link: string;
  /** Main reading text in the editor and note list. */
  text: string;
  /** Editor background (also note cards and inputs on the list). */
  editorBg: string;
  /** Note list & backlinks panel background. */
  surface: string;
  /** Sidebar background. */
  sidebarBg: string;
  /** Sidebar text (dimmer shades are derived from it). */
  sidebarFg: string;
}

export const DEFAULT_THEME: GrimoireTheme = {
  accent: "#d84b40",
  link: "#0b6acd",
  text: "#020817",
  editorBg: "#ffffff",
  surface: "#f9f8f6",
  sidebarBg: "#1f1f23",
  sidebarFg: "#e4e4e7",
};

export const THEME_TOKENS: {
  key: keyof GrimoireTheme;
  label: string;
  hint: string;
}[] = [
  { key: "accent", label: "Accent", hint: "Pins, tags, selection, cursor" },
  { key: "link", label: "Links", hint: "Wikilinks and relations" },
  { key: "text", label: "Text", hint: "Main editor & list text" },
  { key: "editorBg", label: "Editor background", hint: "Editor and cards" },
  { key: "surface", label: "List background", hint: "Note list & panels" },
  { key: "sidebarBg", label: "Sidebar background", hint: "Left navigation" },
  { key: "sidebarFg", label: "Sidebar text", hint: "Navigation labels" },
];

export const THEME_PRESETS: { name: string; theme: GrimoireTheme }[] = [
  { name: "Grimoire", theme: DEFAULT_THEME },
  {
    name: "Ember",
    theme: {
      accent: "#c2410c",
      link: "#b45309",
      text: "#292018",
      editorBg: "#fffcf7",
      surface: "#f8f1e7",
      sidebarBg: "#2c1c12",
      sidebarFg: "#f0e4d7",
    },
  },
  {
    name: "Forest",
    theme: {
      accent: "#2f9e63",
      link: "#0f766e",
      text: "#122117",
      editorBg: "#fdfffc",
      surface: "#f1f6f0",
      sidebarBg: "#14231a",
      sidebarFg: "#d7e8dc",
    },
  },
  {
    name: "Ocean",
    theme: {
      accent: "#0284c7",
      link: "#2563eb",
      text: "#0c1a26",
      editorBg: "#fdfeff",
      surface: "#eff4f8",
      sidebarBg: "#0f1c2e",
      sidebarFg: "#d5e2f0",
    },
  },
  {
    name: "Midnight",
    theme: {
      accent: "#e5484d",
      link: "#6ea8fe",
      text: "#dee3ea",
      editorBg: "#14171d",
      surface: "#191d24",
      sidebarBg: "#0e1116",
      sidebarFg: "#cfd6df",
    },
  },
  {
    name: "Nightshade",
    theme: {
      accent: "#a78bfa",
      link: "#8ab4f8",
      text: "#e2ddf0",
      editorBg: "#171522",
      surface: "#1c1930",
      sidebarBg: "#100e1a",
      sidebarFg: "#d5cfe8",
    },
  },
  {
    name: "Cocoa",
    theme: {
      accent: "#e0a458",
      link: "#d08770",
      text: "#ece1d3",
      editorBg: "#1f1a15",
      surface: "#262019",
      sidebarBg: "#171310",
      sidebarFg: "#e6dccc",
    },
  },
];

const STORAGE_KEY = "grimoire-theme";

const CSS_VARS: Record<keyof GrimoireTheme, string> = {
  accent: "--grim-accent",
  link: "--grim-link",
  text: "--grim-text",
  editorBg: "--grim-editor-bg",
  surface: "--grim-surface",
  sidebarBg: "--grim-sidebar-bg",
  sidebarFg: "--grim-sidebar-fg",
};

export function isValidHex(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb | null {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = [...value].map((char) => char + char).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** `color` blended over `base` at `weight` (0..1). */
function mix(color: Rgb, base: Rgb, weight: number): Rgb {
  return [0, 1, 2].map((i) =>
    Math.round(color[i] * weight + base[i] * (1 - weight)),
  ) as Rgb;
}

/** → "h s% l%" for the shadcn hsl(var(--…)) variables. */
function rgbToHslTriplet([r, g, b]: Rgb): string {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyTheme(theme: GrimoireTheme): void {
  const root = document.documentElement;
  for (const key of Object.keys(CSS_VARS) as (keyof GrimoireTheme)[]) {
    const rgb = hexToRgb(theme[key]);
    if (rgb) root.style.setProperty(CSS_VARS[key], rgb.join(" "));
  }

  // Derive the shadcn neutrals (borders, muted text, dialog/badge surfaces,
  // hover grays) from text-over-editor mixes so dark themes hold together
  // without extra settings.
  const text = hexToRgb(theme.text);
  const editor = hexToRgb(theme.editorBg);
  if (!text || !editor) return;
  const setHsl = (name: string, rgb: Rgb) =>
    root.style.setProperty(name, rgbToHslTriplet(rgb));
  setHsl("--background", editor);
  setHsl("--foreground", text);
  setHsl("--card", editor);
  setHsl("--card-foreground", text);
  setHsl("--popover", editor);
  setHsl("--popover-foreground", text);
  setHsl("--primary", text);
  setHsl("--primary-foreground", editor);
  setHsl("--secondary", mix(text, editor, 0.08));
  setHsl("--secondary-foreground", text);
  setHsl("--muted", mix(text, editor, 0.08));
  setHsl("--muted-foreground", mix(text, editor, 0.62));
  setHsl("--accent", mix(text, editor, 0.07));
  setHsl("--accent-foreground", text);
  setHsl("--border", mix(text, editor, 0.12));
  setHsl("--input", mix(text, editor, 0.12));
  setHsl("--ring", mix(text, editor, 0.6));
}

export function loadTheme(): GrimoireTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    const parsed = JSON.parse(raw) as Partial<GrimoireTheme>;
    const theme = { ...DEFAULT_THEME };
    for (const key of Object.keys(CSS_VARS) as (keyof GrimoireTheme)[]) {
      const value = parsed[key];
      if (typeof value === "string" && isValidHex(value)) theme[key] = value;
    }
    return theme;
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function saveTheme(theme: GrimoireTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // Persistence is best-effort; the theme still applies for this session.
  }
}

/** Apply whatever theme is saved (call once on startup). */
export function initTheme(): void {
  applyTheme(loadTheme());
}

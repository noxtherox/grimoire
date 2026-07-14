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

/** "#d84b40" (or "#fff") → "216 75 64"; null when malformed. */
function hexToTriplet(hex: string): string | null {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = [...value].map((char) => char + char).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function applyTheme(theme: GrimoireTheme): void {
  const root = document.documentElement;
  for (const key of Object.keys(CSS_VARS) as (keyof GrimoireTheme)[]) {
    const triplet = hexToTriplet(theme[key]);
    if (triplet) root.style.setProperty(CSS_VARS[key], triplet);
  }
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

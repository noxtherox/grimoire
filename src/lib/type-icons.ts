import { icons, type LucideIcon } from "lucide-react";

/** Custom icons per type, keyed by full type key ("work/projects") — the
 *  value is a lucide icon name ("Briefcase"). Types without an entry fall
 *  back to the folder glyph. Persisted per vault in `.grimoire/type-icons.json`. */
export type TypeIcons = Record<string, string>;

export const ALL_ICON_NAMES = Object.keys(icons);

export function getIconComponent(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  return (icons as Record<string, LucideIcon>)[name] ?? null;
}

/** "AlarmClockCheck" → "alarm clock check", for searching and matching. */
export function iconSearchText(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
}

const searchTextByName = new Map<string, string>(
  ALL_ICON_NAMES.map((name) => [name, iconSearchText(name)]),
);

/** Icons whose words contain every query word as a substring. */
export function searchIcons(query: string): string[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return ALL_ICON_NAMES;
  return ALL_ICON_NAMES.filter((name) => {
    const text = searchTextByName.get(name) ?? "";
    return words.every((word) => text.includes(word));
  });
}

// ---- icon suggestion ---------------------------------------------------------

/** Concept → icon, checked word-by-word against a new type's name. Ordered
 *  maps beat literal icon names ("work" should give a briefcase, not "Worm"). */
const KEYWORD_ICONS: Record<string, string> = {
  work: "Briefcase",
  job: "Briefcase",
  career: "Briefcase",
  office: "Briefcase",
  project: "FolderKanban",
  task: "ListChecks",
  todo: "ListChecks",
  checklist: "ListChecks",
  goal: "Target",
  habit: "Repeat",
  journal: "NotebookPen",
  diary: "NotebookPen",
  daily: "CalendarDays",
  weekly: "CalendarDays",
  note: "StickyNote",
  idea: "Lightbulb",
  brainstorm: "Lightbulb",
  inbox: "Inbox",
  archive: "Archive",
  draft: "FileText",
  template: "LayoutTemplate",
  meeting: "Users",
  people: "Users",
  person: "User",
  contact: "Users",
  team: "Users",
  friend: "Users",
  family: "Users",
  kid: "Baby",
  child: "Baby",
  book: "BookOpen",
  reading: "BookOpen",
  library: "LibraryBig",
  writing: "PenLine",
  blog: "Rss",
  article: "Newspaper",
  news: "Newspaper",
  quote: "Quote",
  poem: "Feather",
  poetry: "Feather",
  story: "BookOpenText",
  recipe: "ChefHat",
  cooking: "ChefHat",
  baking: "ChefHat",
  food: "UtensilsCrossed",
  meal: "UtensilsCrossed",
  restaurant: "UtensilsCrossed",
  coffee: "Coffee",
  wine: "Wine",
  beer: "Beer",
  travel: "Plane",
  trip: "Plane",
  vacation: "TreePalm",
  holiday: "TreePalm",
  hiking: "Mountain",
  camping: "Tent",
  finance: "Wallet",
  money: "Wallet",
  budget: "Wallet",
  bank: "Landmark",
  invest: "TrendingUp",
  investment: "TrendingUp",
  stock: "TrendingUp",
  crypto: "Bitcoin",
  tax: "Receipt",
  invoice: "Receipt",
  receipt: "Receipt",
  subscription: "CreditCard",
  shopping: "ShoppingCart",
  grocery: "ShoppingBasket",
  wishlist: "Gift",
  gift: "Gift",
  health: "HeartPulse",
  medical: "Stethoscope",
  doctor: "Stethoscope",
  medicine: "Pill",
  fitness: "Dumbbell",
  workout: "Dumbbell",
  gym: "Dumbbell",
  running: "Footprints",
  yoga: "Flower2",
  sleep: "Moon",
  dream: "Moon",
  meditation: "Sparkles",
  code: "Code",
  coding: "Code",
  programming: "Code",
  dev: "Code",
  software: "Code",
  snippet: "Code",
  bug: "Bug",
  server: "Server",
  database: "Database",
  api: "Braces",
  terminal: "Terminal",
  git: "GitBranch",
  design: "Palette",
  art: "Palette",
  drawing: "Brush",
  photo: "Image",
  photography: "Camera",
  video: "Video",
  music: "Music",
  song: "Music",
  podcast: "Podcast",
  movie: "Film",
  film: "Film",
  tv: "Tv",
  show: "Tv",
  anime: "Tv",
  game: "Gamepad2",
  gaming: "Gamepad2",
  chess: "Puzzle",
  hobby: "Puzzle",
  school: "GraduationCap",
  study: "GraduationCap",
  course: "GraduationCap",
  class: "GraduationCap",
  learning: "GraduationCap",
  education: "GraduationCap",
  research: "FlaskConical",
  science: "FlaskConical",
  math: "Sigma",
  language: "Languages",
  history: "Scroll",
  philosophy: "Scroll",
  religion: "Church",
  garden: "Sprout",
  plant: "Sprout",
  nature: "Trees",
  weather: "CloudSun",
  pet: "PawPrint",
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  fish: "Fish",
  car: "Car",
  auto: "Car",
  bike: "Bike",
  motorcycle: "Bike",
  boat: "Sailboat",
  home: "House",
  house: "House",
  apartment: "Building2",
  renovation: "Hammer",
  diy: "Hammer",
  repair: "Wrench",
  tool: "Wrench",
  cleaning: "Sparkles",
  event: "Calendar",
  calendar: "Calendar",
  birthday: "Cake",
  wedding: "Gem",
  party: "PartyPopper",
  christmas: "Gift",
  email: "Mail",
  letter: "Mail",
  phone: "Phone",
  call: "Phone",
  chat: "MessageCircle",
  password: "KeyRound",
  secret: "KeyRound",
  security: "Shield",
  legal: "Scale",
  law: "Scale",
  contract: "Signature",
  insurance: "ShieldCheck",
  favorite: "Star",
  important: "Star",
  urgent: "CircleAlert",
  random: "Shuffle",
  misc: "Shapes",
  personal: "User",
  private: "Lock",
  client: "Handshake",
  customer: "Handshake",
  sales: "TrendingUp",
  marketing: "Megaphone",
  product: "Package",
  startup: "Rocket",
  business: "Briefcase",
  company: "Building2",
  hr: "Users",
  interview: "MessagesSquare",
  weld: "Flame",
  welding: "Flame",
};

/** Singular candidates — "categories" → ["category", "categorie"], "boxes" → ["boxe", "box"]. */
function singulars(word: string): string[] {
  if (word.length > 3 && word.endsWith("ies"))
    return [`${word.slice(0, -3)}y`, word.slice(0, -1)];
  if (word.length > 3 && word.endsWith("es"))
    return [word.slice(0, -1), word.slice(0, -2)];
  if (word.length > 2 && word.endsWith("s")) return [word.slice(0, -1)];
  return [];
}

/**
 * Picks a fitting icon for a type from its name (e.g. "Recipes" → ChefHat),
 * or null when nothing matches — callers then keep the default folder glyph.
 */
export function suggestIconForType(typeName: string): string | null {
  const raw = typeName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const words = [...new Set(raw.flatMap((word) => [word, ...singulars(word)]))];

  for (const word of words) {
    const mapped = KEYWORD_ICONS[word];
    if (mapped) return mapped;
  }

  // the whole name spells out an icon ("alarm clock" → AlarmClock)
  const fullNames = new Set([
    raw.join(" "),
    raw.map((word) => singulars(word)[0] ?? word).join(" "),
  ]);
  for (const [name, text] of searchTextByName) {
    if (fullNames.has(text)) return name;
  }

  // a word matches an icon name outright ("calendar" → Calendar)
  for (const word of words) {
    for (const [name, text] of searchTextByName) {
      if (text === word) return name;
    }
  }

  return null;
}

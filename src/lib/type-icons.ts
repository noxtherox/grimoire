import data from "@emoji-mart/data";
import { SearchIndex, init } from "emoji-mart";

/** Custom emoji per type, keyed by full type key ("work/projects") — the
 *  value is a native emoji ("🍳"). Types without an entry fall back to the
 *  folder glyph. Persisted per vault in `.grimoire/type-icons.json`. */
export type TypeIcons = Record<string, string>;

let emojiDataReady: Promise<unknown> | null = null;

/** Initializes emoji-mart's shared data once — the picker and search use it. */
export function ensureEmojiData(): Promise<unknown> {
  emojiDataReady ??= init({ data });
  return emojiDataReady;
}

export { data as emojiData };

/** True for values that render as an emoji (filters out legacy icon names). */
export function isEmojiValue(value: unknown): value is string {
  return typeof value === "string" && /\P{ASCII}/u.test(value);
}

// ---- icon suggestion ---------------------------------------------------------

/** Concept → emoji, checked word-by-word against a new type's name. Curated
 *  because emoji search misses concept words ("recipe", "meeting", "finance"). */
const KEYWORD_EMOJI: Record<string, string> = {
  work: "💼",
  job: "💼",
  career: "💼",
  business: "💼",
  office: "🏢",
  company: "🏢",
  apartment: "🏢",
  project: "📂",
  task: "✅",
  todo: "✅",
  checklist: "✅",
  goal: "🎯",
  habit: "🔁",
  journal: "📓",
  diary: "📔",
  daily: "📅",
  weekly: "📅",
  event: "📅",
  calendar: "📅",
  note: "📝",
  draft: "📝",
  idea: "💡",
  brainstorm: "💡",
  inbox: "📥",
  archive: "🗃️",
  template: "📐",
  meeting: "👥",
  people: "👥",
  team: "👥",
  friend: "👥",
  hr: "👥",
  person: "👤",
  personal: "👤",
  contact: "📇",
  family: "👨‍👩‍👧",
  kid: "👶",
  child: "👶",
  baby: "👶",
  book: "📚",
  library: "📚",
  reading: "📖",
  story: "📖",
  study: "📖",
  writing: "✍️",
  contract: "✍️",
  blog: "📰",
  article: "📰",
  news: "📰",
  quote: "💬",
  chat: "💬",
  interview: "💬",
  poem: "🪶",
  poetry: "🪶",
  recipe: "🍳",
  cooking: "🍳",
  baking: "🧁",
  food: "🍽️",
  meal: "🍽️",
  restaurant: "🍽️",
  coffee: "☕",
  wine: "🍷",
  beer: "🍺",
  travel: "✈️",
  trip: "✈️",
  flight: "✈️",
  vacation: "🏝️",
  holiday: "🏝️",
  hiking: "🥾",
  camping: "⛺",
  finance: "💰",
  money: "💰",
  budget: "💰",
  bank: "🏦",
  invest: "📈",
  investment: "📈",
  stock: "📈",
  sales: "📈",
  crypto: "🪙",
  tax: "🧾",
  invoice: "🧾",
  receipt: "🧾",
  subscription: "💳",
  shopping: "🛒",
  grocery: "🛒",
  wishlist: "🎁",
  gift: "🎁",
  christmas: "🎄",
  health: "🩺",
  medical: "🩺",
  doctor: "🩺",
  medicine: "💊",
  fitness: "🏋️",
  workout: "🏋️",
  gym: "🏋️",
  running: "🏃",
  yoga: "🧘",
  meditation: "🧘",
  sleep: "😴",
  dream: "🌙",
  code: "💻",
  coding: "💻",
  programming: "💻",
  dev: "💻",
  software: "💻",
  snippet: "💻",
  bug: "🐛",
  server: "🖥️",
  terminal: "🖥️",
  database: "🗄️",
  api: "🔌",
  design: "🎨",
  art: "🎨",
  drawing: "✏️",
  photo: "📷",
  photography: "📷",
  video: "🎥",
  music: "🎵",
  song: "🎵",
  podcast: "🎙️",
  movie: "🎬",
  film: "🎬",
  tv: "📺",
  show: "📺",
  anime: "📺",
  game: "🎮",
  gaming: "🎮",
  chess: "♟️",
  hobby: "🧩",
  school: "🎓",
  course: "🎓",
  class: "🎓",
  learning: "🎓",
  education: "🎓",
  research: "🔬",
  science: "🔬",
  math: "➗",
  language: "🗣️",
  history: "📜",
  philosophy: "🏛️",
  religion: "⛪",
  garden: "🌱",
  plant: "🪴",
  nature: "🌳",
  weather: "⛅",
  pet: "🐾",
  dog: "🐶",
  cat: "🐱",
  bird: "🐦",
  fish: "🐟",
  car: "🚗",
  auto: "🚗",
  bike: "🚲",
  motorcycle: "🏍️",
  boat: "⛵",
  home: "🏠",
  house: "🏠",
  renovation: "🔨",
  diy: "🔨",
  repair: "🔧",
  tool: "🔧",
  cleaning: "🧹",
  birthday: "🎂",
  wedding: "💍",
  party: "🎉",
  email: "✉️",
  letter: "✉️",
  phone: "📞",
  call: "📞",
  password: "🔑",
  secret: "🔑",
  security: "🛡️",
  insurance: "🛡️",
  legal: "⚖️",
  law: "⚖️",
  favorite: "⭐",
  important: "⭐",
  urgent: "🚨",
  random: "🎲",
  misc: "🗂️",
  private: "🔒",
  client: "🤝",
  customer: "🤝",
  marketing: "📣",
  product: "📦",
  startup: "🚀",
  weld: "🔥",
  welding: "🔥",
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

interface SearchedEmoji {
  skins?: { native?: string }[];
}

async function searchEmoji(query: string): Promise<string | null> {
  try {
    await ensureEmojiData();
    const results = (await SearchIndex.search(query)) as
      | SearchedEmoji[]
      | undefined;
    return results?.[0]?.skins?.[0]?.native ?? null;
  } catch {
    return null;
  }
}

/**
 * Picks a fitting emoji for a type from its name (e.g. "Recipes" → 🍳),
 * or null when nothing matches — callers then keep the default folder glyph.
 * Tries the curated concept map first, then emoji-mart's search index.
 */
export async function suggestIconForType(
  typeName: string,
): Promise<string | null> {
  const raw = typeName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const words = [...new Set(raw.flatMap((word) => [word, ...singulars(word)]))];

  for (const word of words) {
    const mapped = KEYWORD_EMOJI[word];
    if (mapped) return mapped;
  }

  // the whole name may match better than single words ("polar bear" → 🐻‍❄️)
  if (raw.length > 1) {
    const full = await searchEmoji(raw.join(" "));
    if (full) return full;
  }

  for (const word of words) {
    const found = await searchEmoji(word);
    if (found) return found;
  }

  return null;
}

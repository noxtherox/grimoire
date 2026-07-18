import type { PropertyValue } from "@/lib/frontmatter";

/**
 * Property definitions live on a note's top-level type (top-level folder) and
 * cascade to every sub-type below it — sub-folders organize notes but never
 * carry their own property sets. Values are stored per note as YAML
 * frontmatter; definitions are stored per vault in `.grimoire/properties.json`.
 */

export type PropertyType =
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "list"
  | "relation";

export interface PropertyDef {
  name: string;
  type: PropertyType;
  /** list only: the choices available when editing a note. */
  listOptions?: string[];
  /** list only: allow selecting more than one choice. */
  listMultiple?: boolean;
  /** relation only: restrict linkable notes to this type (and its sub-types). Unset = any type. */
  relationTypeKey?: string;
  /** relation only: allow linking more than one note. */
  relationMultiple?: boolean;
}

/** Top-level type key ("work") -> property definitions for that type tree. */
export type PropertySchemas = Record<string, PropertyDef[]>;

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "list", label: "List" },
  { value: "relation", label: "Relation" },
];

/** The schema key for a type path: its top-level type ("" for unfiled notes). */
export function schemaKeyFor(typePath: string[]): string {
  return typePath[0] ?? "";
}

/**
 * Properties that apply to a note of the given type: the definitions on its
 * top-level type, which cascade to every sub-type below it.
 */
export function effectiveProperties(
  typePath: string[],
  schemas: PropertySchemas,
): PropertyDef[] {
  return schemas[schemaKeyFor(typePath)] ?? [];
}

/**
 * Migrates schemas written before definitions moved to the top-level type:
 * definitions stored on sub-type keys ("work/projects") are hoisted onto
 * their top-level key ("work"), shallower definitions winning on name
 * clashes. Returns null when nothing needed hoisting.
 */
export function hoistSchemasToTopLevel(
  schemas: PropertySchemas,
): PropertySchemas | null {
  if (!Object.keys(schemas).some((key) => key.includes("/"))) return null;
  const hoisted: PropertySchemas = {};
  const keys = Object.keys(schemas).sort(
    (a, b) => a.split("/").length - b.split("/").length,
  );
  for (const key of keys) {
    const topKey = key.split("/")[0];
    const defs = hoisted[topKey] ?? [];
    const seen = new Set(defs.map((def) => def.name.toLowerCase()));
    for (const def of schemas[key] ?? []) {
      const norm = def.name.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      defs.push(def);
    }
    if (defs.length) hoisted[topKey] = defs;
  }
  return hoisted;
}

/** A frontmatter-safe property name (must survive `name: value` parsing). */
export function sanitizePropertyName(input: string): string {
  const name = input
    .replace(/[^A-Za-z0-9_ .-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[ .-]+/, "")
    .slice(0, 60)
    .trim();
  return name;
}

/** Trims list choices and removes blank or case-insensitive duplicates. */
export function normalizeListOptions(options: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const option of options) {
    const trimmed = option.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
}

/** Reads either legacy scalar values or YAML arrays as list selections. */
export function listSelections(
  value: PropertyValue | undefined,
): string[] {
  if (Array.isArray(value)) return normalizeListOptions(value);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

/** Serializes selected list choices according to the definition's mode. */
export function listPropertyValue(
  selections: string[],
  multiple: boolean,
): PropertyValue | null {
  const normalized = normalizeListOptions(selections);
  if (!normalized.length) return null;
  return multiple ? normalized : normalized[0];
}

/** Best-guess property type for an existing frontmatter value. */
export function inferPropertyType(value: PropertyValue): PropertyType {
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
  return "text";
}

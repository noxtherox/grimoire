import type { PropertyValue } from "@/lib/frontmatter";
import { typeKey } from "@/lib/note-utils";

/**
 * Property definitions live on a note type (folder). Every note of that type
 * — including notes in its sub-types — shows the type's properties. Values
 * are stored per note as YAML frontmatter; definitions are stored per vault
 * in `.grimoire/properties.json`.
 */

export type PropertyType = "text" | "number" | "date" | "checkbox" | "list";

export interface PropertyDef {
  name: string;
  type: PropertyType;
}

/** typeKey ("work/projects") -> property definitions for that type. */
export type PropertySchemas = Record<string, PropertyDef[]>;

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "list", label: "List" },
];

/** A property visible on a note, plus the type (schema key) that defines it. */
export interface EffectiveProperty {
  def: PropertyDef;
  ownerKey: string;
}

/**
 * Properties that apply to a note of the given type: definitions from the
 * type itself and every ancestor type, ancestors first. Nearest-ancestor
 * definition wins on name clashes.
 */
export function effectiveProperties(
  typePath: string[],
  schemas: PropertySchemas,
): EffectiveProperty[] {
  const out: EffectiveProperty[] = [];
  const seen = new Set<string>();
  for (let depth = 1; depth <= typePath.length; depth++) {
    const key = typeKey(typePath.slice(0, depth));
    for (const def of schemas[key] ?? []) {
      const norm = def.name.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push({ def, ownerKey: key });
    }
  }
  return out;
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

/** Best-guess property type for an existing frontmatter value. */
export function inferPropertyType(value: PropertyValue): PropertyType {
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
  return "text";
}

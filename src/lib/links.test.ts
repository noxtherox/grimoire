import { describe, expect, it } from "vitest";
import { getBacklinksGroupedByType } from "./links";
import type { Note } from "./note-utils";

function note(
  id: string,
  path: string,
  content: string,
  archived = false,
): Note {
  return {
    id,
    path,
    content,
    pinned: false,
    archived,
    updatedAt: "2026-07-17T12:00:00.000Z",
  };
}

describe("backlinks", () => {
  it("excludes archived linking notes unless explicitly included", () => {
    const target = note("target", "work/target.md", "# Target");
    const active = note("active", "work/active.md", "# Active\n\n[[Target]]");
    const archived = note(
      "archived",
      "personal/archived.md",
      "# Archived\n\n[[Target]]",
      true,
    );

    const hidden = getBacklinksGroupedByType(
      target,
      [target, active, archived],
      {},
    );
    expect([...hidden.values()].flat().map((item) => item.id)).toEqual([
      "active",
    ]);

    const shown = getBacklinksGroupedByType(
      target,
      [target, active, archived],
      {},
      true,
    );
    expect([...shown.values()].flat().map((item) => item.id)).toEqual([
      "archived",
      "active",
    ]);
  });

  it("hides reciprocal relation backlinks across different properties", () => {
    const company = note(
      "company",
      "companies/acme.md",
      "---\nPeople: [Sara Holm]\n---\n# Acme",
    );
    const person = note(
      "person",
      "people/sara.md",
      "---\nCompanies: Acme\n---\n# Sara Holm",
    );
    const schemas = {
      companies: [{ name: "People", type: "relation" as const }],
      people: [{ name: "Companies", type: "relation" as const }],
    };

    const groups = getBacklinksGroupedByType(company, [company, person], schemas);
    expect([...groups.values()].flat()).toEqual([]);
  });

  it("keeps one-way relation backlinks", () => {
    const company = note("company", "companies/acme.md", "# Acme");
    const person = note(
      "person",
      "people/sara.md",
      "---\nCompanies: Acme\n---\n# Sara Holm",
    );
    const schemas = {
      people: [{ name: "Companies", type: "relation" as const }],
    };

    const groups = getBacklinksGroupedByType(company, [company, person], schemas);
    expect([...groups.values()].flat().map((item) => item.id)).toEqual([
      "person",
    ]);
  });

  it("keeps a body backlink even when the notes also have reciprocal relations", () => {
    const company = note(
      "company",
      "companies/acme.md",
      "---\nPeople: Sara Holm\n---\n# Acme",
    );
    const person = note(
      "person",
      "people/sara.md",
      "---\nCompanies: Acme\n---\n# Sara Holm\n\nDiscussed at [[Acme]].",
    );
    const schemas = {
      companies: [{ name: "People", type: "relation" as const }],
      people: [{ name: "Companies", type: "relation" as const }],
    };

    const groups = getBacklinksGroupedByType(company, [company, person], schemas);
    expect([...groups.values()].flat().map((item) => item.id)).toEqual([
      "person",
    ]);
  });
});

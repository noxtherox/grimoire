import type { VaultBackend, VaultFile } from "./backend";

const STORAGE_KEY = "grimoire.browserVault.v1";

interface StoredFile {
  content: string;
  updatedAt: string;
}

function seedFiles(): Record<string, StoredFile> {
  const now = Date.now();
  const at = (offsetMinutes: number) =>
    new Date(now - offsetMinutes * 60_000).toISOString();
  return {
    "inbox/Welcome to Grimoire.md": {
      updatedAt: at(60),
      content: `# Welcome to Grimoire

Grimoire is a Bear-style notes app where your notes are plain markdown files in folders, and the folders are your **types**: every note has a type, and optionally a sub-type and sub-sub-type.

## The basics

- The sidebar shows your type tree — it mirrors the folder structure of your vault.
- The first line of a note is its title; the filename follows it.
- Change a note's type from the selector at the top of the editor: it moves the file.

## Linking

Type \`[[\` to link to another note — try it! For example: [[Project Polaris]].

Cmd/Ctrl+Click a link to follow it. Open [[Project Polaris]] and look at the **Backlinks** section at the bottom: notes that link to it are grouped by their type, so you can see *where* a note is referenced from at a glance.

> In the desktop app you point Grimoire at any folder of .md files and they show up here with their types.`,
    },
    "work/projects/Project Polaris.md": {
      updatedAt: at(50),
      content: `# Project Polaris

The star project. This note is linked from several places — check the Backlinks section below to see them grouped by type.

## Goals

- Ship the northern-lights dashboard
- Keep scope small`,
    },
    "work/meetings/Meeting notes — kickoff.md": {
      updatedAt: at(40),
      content: `# Meeting notes — kickoff

Kickoff for [[Project Polaris]] with the platform team.

- Timeline: 6 weeks
- Next step: draft the spec`,
    },
    "personal/reading/Reading list.md": {
      updatedAt: at(30),
      content: `# Reading list

Things to read on the weekend, some relevant to [[Project Polaris]].

- Designing Data-Intensive Applications
- The Bear app design retrospective`,
    },
  };
}

/**
 * Virtual vault for running in a plain browser (Dyad preview) where there is
 * no filesystem access. Same path semantics as the desktop vault, persisted
 * in localStorage.
 */
export class BrowserVault implements VaultBackend {
  readonly kind = "browser" as const;
  readonly location = "Browser storage";

  private files: Record<string, StoredFile>;

  constructor() {
    let stored: Record<string, StoredFile> | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as Record<string, StoredFile>;
    } catch {
      stored = null;
    }
    this.files = stored ?? seedFiles();
    if (!stored) this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.files));
    } catch {
      // storage full or unavailable — keep working in memory
    }
  }

  async loadAll(): Promise<VaultFile[]> {
    return Object.entries(this.files).map(([path, file]) => ({
      path,
      content: file.content,
      updatedAt: file.updatedAt,
    }));
  }

  async write(path: string, content: string): Promise<void> {
    this.files[path] = { content, updatedAt: new Date().toISOString() };
    this.persist();
  }

  async move(from: string, to: string): Promise<void> {
    const file = this.files[from];
    if (!file) return;
    delete this.files[from];
    this.files[to] = file;
    this.persist();
  }

  async removeFile(path: string): Promise<void> {
    delete this.files[path];
    this.persist();
  }

  async exists(path: string): Promise<boolean> {
    return path in this.files;
  }
}

import { useSyncExternalStore } from "react";
import { DEFAULT_MAIN_TAG, type Note } from "@/lib/note-utils";

const STORAGE_KEY = "ursa.notes.v1";

function makeSeedNotes(): Note[] {
  const now = Date.now();
  const at = (offsetMinutes: number) =>
    new Date(now - offsetMinutes * 60_000).toISOString();
  return [
    {
      id: crypto.randomUUID(),
      content: `# Welcome to Ursa

Ursa is a Bear-style notes app with one twist: every note has a **main tag**, and links between notes are first-class.

## The basics

- Your notes live in the list on the left; tags live in the sidebar.
- The first line of a note is its title.
- Every note belongs to exactly one main tag — pick it from the selector at the top of the editor.

## Linking

Type \`[[\` to link to another note — try it! For example: [[Project Polaris]].

Cmd/Ctrl+Click a link to follow it. Open [[Project Polaris]] and look at the **Backlinks** section at the bottom: notes that link to it are grouped by their main tag, so you can see *where* a note is referenced from at a glance.`,
      mainTag: "inbox",
      pinned: true,
      trashed: false,
      createdAt: at(60),
      updatedAt: at(60),
    },
    {
      id: crypto.randomUUID(),
      content: `# Project Polaris

The star project. This note is linked from several places — check the Backlinks section below to see them grouped by main tag.

## Goals

- Ship the northern-lights dashboard
- Keep scope small`,
      mainTag: "work",
      pinned: false,
      trashed: false,
      createdAt: at(50),
      updatedAt: at(50),
    },
    {
      id: crypto.randomUUID(),
      content: `# Meeting notes — kickoff

Kickoff for [[Project Polaris]] with the platform team.

- Timeline: 6 weeks
- Next step: draft the spec`,
      mainTag: "work",
      pinned: false,
      trashed: false,
      createdAt: at(40),
      updatedAt: at(40),
    },
    {
      id: crypto.randomUUID(),
      content: `# Reading list

Things to read on the weekend, some relevant to [[Project Polaris]].

- Designing Data-Intensive Applications
- The Bear app design retrospective`,
      mainTag: "personal",
      pinned: false,
      trashed: false,
      createdAt: at(30),
      updatedAt: at(30),
    },
  ];
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Note[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted storage — fall through to seed
  }
  return makeSeedNotes();
}

let notes: Note[] = loadNotes();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // storage full or unavailable — keep working in memory
  }
}

function setNotes(next: Note[]) {
  notes = next;
  persist();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotes(): Note[] {
  return useSyncExternalStore(subscribe, () => notes);
}

export function getNotes(): Note[] {
  return notes;
}

export function createNote(mainTag: string = DEFAULT_MAIN_TAG, content = ""): Note {
  const nowIso = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    content,
    mainTag,
    pinned: false,
    trashed: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  setNotes([note, ...notes]);
  return note;
}

export function updateNoteContent(id: string, content: string) {
  setNotes(
    notes.map((note) =>
      note.id === id
        ? { ...note, content, updatedAt: new Date().toISOString() }
        : note,
    ),
  );
}

export function setNoteMainTag(id: string, mainTag: string) {
  const clean = mainTag.trim().toLowerCase().replace(/\s+/g, "-");
  if (!clean) return;
  setNotes(
    notes.map((note) =>
      note.id === id
        ? { ...note, mainTag: clean, updatedAt: new Date().toISOString() }
        : note,
    ),
  );
}

export function toggleNotePinned(id: string) {
  setNotes(
    notes.map((note) =>
      note.id === id ? { ...note, pinned: !note.pinned } : note,
    ),
  );
}

export function trashNote(id: string) {
  setNotes(
    notes.map((note) =>
      note.id === id ? { ...note, trashed: true, pinned: false } : note,
    ),
  );
}

export function restoreNote(id: string) {
  setNotes(
    notes.map((note) => (note.id === id ? { ...note, trashed: false } : note)),
  );
}

export function deleteNoteForever(id: string) {
  setNotes(notes.filter((note) => note.id !== id));
}

export function emptyTrash() {
  setNotes(notes.filter((note) => !note.trashed));
}

# Ursa 🐻

A Bear-style notes app with one twist: **every note has a main tag**, and notes link to each other with `[[wikilinks]]`. The backlinks section of a note groups the notes that link to it by *their* main tag, so you can see at a glance where a note is referenced from.

## Features

- Three-pane Bear-style layout: tag sidebar, note list, markdown editor
- CodeMirror markdown editor with live syntax styling and inline `#tag` highlighting
- `[[` autocompletes note titles; ⌘/Ctrl+Click a link to follow it (links to missing notes create them)
- One required **main tag** per note, picked/created from the editor toolbar
- Backlinks panel grouped by the linking notes' main tags
- Pin, trash/restore, search, ⌘N for a new note
- Notes persist locally (localStorage)

## Run

```sh
pnpm install

# Web (Dyad preview)
pnpm dev

# Desktop (Tauri v2 — requires Rust)
pnpm desktop:dev     # dev window
pnpm desktop:build   # installable bundles for the current OS
```

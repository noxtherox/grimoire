# Grimoire 📖

A Bear-style notes app where your notes are **plain markdown files in folders**, and the folders are your **types**: every note has a type, and optionally a sub-type and sub-sub-type (up to 3 levels). Notes link to each other with `[[wikilinks]]`, and the backlinks section of a note groups the notes that link to it by *their* type — so you can see at a glance where a note is referenced from.

Because the vault is just a folder of `.md` files, you can point Grimoire at any existing folder and the notes show up with their types derived from the folder structure. Your notes stay portable and yours.

## Features

- **Vault = folder**: pick any folder; `type/sub-type/sub-sub-type/Note.md` maps to the type tree in the sidebar
- Three-pane Bear-style layout: type tree sidebar, note list, markdown editor
- CodeMirror markdown editor with live syntax styling and inline `#tag` highlighting
- `[[` autocompletes note titles; ⌘/Ctrl+Click a link to follow it (links to missing notes create them)
- Backlinks panel grouped by the linking notes' types
- Renaming a note's first line renames its file; changing its type moves the file
- Trash is a `.trash/` folder inside the vault — restore puts files back where they were
- Pin, search, ⌘N for a new note, reload-from-disk button in the sidebar
- Runs in the browser too (Dyad preview) with a virtual vault in localStorage

## Run

```sh
pnpm install

# Web (Dyad preview — virtual vault)
pnpm dev

# Desktop (Tauri v2 — requires Rust; real .md files)
pnpm desktop:dev     # dev window
pnpm desktop:build   # installable bundles for the current OS
```

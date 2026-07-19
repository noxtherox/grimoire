# Grimoire CLI

The `grimoire` command automates local Grimoire vaults while keeping Markdown
as the primary document format. Install it and the optional AI-agent skills
from **Settings → CLI** in the desktop app.

## Vaults and output

Register vaults with `grimoire vault add NAME PATH`, inspect them with
`grimoire vault list`, and set a default with `grimoire vault default NAME`.
Automation should pass `--vault NAME_OR_PATH --json` explicitly. Use `--jsonl`
for streams and `--no-input` to guarantee that a script never prompts.

## Notes

- Read: `note list`, `note get`, `search`, `links`, `type list`
- Write: `note create`, `note set-body`, `note append`, `note prepend`
- Organize: `note pin`, `note archive`, `type move`
- Properties: `note property list|set|unset`, `schema list|add|remove`
- Lifecycle: `note trash`, `note restore`, `history`, `undo`
- Transfer: `import`, `export`
- Bulk: `bulk property-set`, `bulk archive`

Selectors accept an exact relative path, a unique note-ID prefix, or an exact
title. Ambiguous interactive selections display title, path, and ID; scripts
receive an `ambiguous_selector` error instead. Content mutations accept
`--if-revision sha256:…` for optimistic concurrency.

## Hidden metadata and migration

Grimoire reserves `grimoire-*` frontmatter. The current metadata is
`grimoire-id`, `grimoire-pinned`, and `grimoire-archived`; these fields never
appear in the normal Properties UI. False pin/archive values are omitted, and
archiving always unpins a note.

Run `grimoire migrate preview` before `grimoire migrate apply --yes`. Duplicate
IDs or malformed reserved metadata block migration for review. Once ready, the
vault manifest records that IDs are required on every device.

## Safety

Writes use atomic replacement and revision checks. Bulk and data-loss actions
require a preview and explicit `--yes`. There is no permanent-delete command:
notes can only be trashed and restored. Mutation snapshots are retained for 30
days up to 500 MB and can be inspected with `history` or reversed with `undo`.
Removing a schema preserves note values unless `--purge-values --yes` is used.

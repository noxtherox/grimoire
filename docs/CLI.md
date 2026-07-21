# Grimoire CLI

The `grimoire` command automates local Grimoire vaults while keeping Markdown
as the primary document format. Install it and the optional AI-agent skills
from **Settings → CLI** in the desktop app.

## Vaults and output

Register vaults with `grimoire vault add NAME PATH`, inspect them with
`grimoire vault list`, and set a default with `grimoire vault default NAME`.
The desktop app automatically registers each successfully opened vault and
makes it the CLI default, including updating the path when a vault is moved.
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

## Property schemas

Property definitions can be scoped to any type path and are inherited by its
sub-types. For example, a definition on `Development` applies to Initiatives,
Epics, and User Stories, while one on `Development/Initiatives` applies only to
Initiatives and any types nested below it.

```sh
grimoire --vault VAULT schema add Development/Initiatives Epics relation \
  --relation-type Development/Epics --multiple
grimoire --vault VAULT schema add Development/Epics Initiative relation \
  --relation-type Development/Initiatives
grimoire --vault VAULT schema add "Development/User Stories" Status list \
  --options Planned,Active,Done --multiple
```

`--relation-type` restricts selectable notes to that type and its sub-types.
`--multiple` enables multiple values on relation or list properties. `--options`
defines the allowed values for list properties. `schema list TYPE_PATH` returns
the effective inherited definitions for that type; `schema list` without a path
returns definitions grouped by their exact owner path.

Removing a definition affects only the exact owner path. Values remain in note
frontmatter unless `--purge-values --yes` is supplied; a purge is limited to
the selected type and its sub-types.

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

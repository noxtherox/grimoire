import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  keymap,
} from "@codemirror/view";
import {
  type EditorState,
  type Extension,
  type Range,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { WIKILINK_REGEX } from "@/lib/note-utils";

const ACCENT = "rgb(var(--grim-accent))";

const toggleEffect = StateEffect.define<boolean>();

/** Whether syntax-hiding is active. Toggled with Mod-E (source mode). */
export const livePreviewEnabled = StateField.define<boolean>({
  create: () => true,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleEffect)) value = effect.value;
    }
    return value;
  },
});

export function toggleLivePreview(view: EditorView): boolean {
  view.dispatch({
    effects: toggleEffect.of(!view.state.field(livePreviewEnabled)),
  });
  return true;
}

/** True when any selection range touches [from, to], including boundaries. */
function touches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some(
    (range) => range.from <= to && range.to >= from,
  );
}

class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.textContent = "•";
    return span;
  }
}

class HrWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-rendered-hr";
    return span;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }
  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }
  override toDOM(view: EditorView): HTMLElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "cm-task-checkbox";
    input.checked = this.checked;
    input.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const pos = view.posAtDOM(input);
      const marker = view.state.sliceDoc(pos, pos + 3);
      if (!/^\[[ xX]\]$/.test(marker)) return;
      view.dispatch({
        changes: { from: pos + 1, to: pos + 2, insert: this.checked ? " " : "x" },
      });
    });
    return input;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  if (!view.state.field(livePreviewEnabled)) return Decoration.none;
  const { state } = view;
  const decos: Range<Decoration>[] = [];

  const hide = (from: number, to: number) => {
    if (from < to) decos.push(Decoration.replace({}).range(from, to));
  };
  /** Hides [from, to] plus one trailing space, if present. */
  const hideWithSpace = (from: number, to: number) => {
    hide(from, to + (state.sliceDoc(to, to + 1) === " " ? 1 : 0));
  };

  for (const { from, to } of view.visibleRanges) {
    // [[wikilinks]]: hide the brackets, keep the title (styled elsewhere).
    const regex = new RegExp(WIKILINK_REGEX.source, "g");
    for (const match of state.sliceDoc(from, to).matchAll(regex)) {
      const start = from + (match.index ?? 0);
      const end = start + match[0].length;
      if (touches(state, start, end)) continue;
      hide(start, start + 2);
      hide(end - 2, end);
    }

    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;

        if (/^ATXHeading[1-6]$/.test(name)) {
          // Reveal on the whole line: `#` governs the whole heading.
          if (touches(state, node.from, node.to)) return;
          const mark = node.node.getChild("HeaderMark");
          if (mark) hideWithSpace(mark.from, mark.to);
          return;
        }

        switch (name) {
          case "Emphasis":
          case "StrongEmphasis": {
            if (touches(state, node.from, node.to)) return;
            for (const mark of node.node.getChildren("EmphasisMark")) {
              hide(mark.from, mark.to);
            }
            return;
          }
          case "InlineCode": {
            if (touches(state, node.from, node.to)) return;
            for (const mark of node.node.getChildren("CodeMark")) {
              hide(mark.from, mark.to);
            }
            return;
          }
          case "Strikethrough": {
            if (touches(state, node.from, node.to)) return;
            for (const mark of node.node.getChildren("StrikethroughMark")) {
              hide(mark.from, mark.to);
            }
            return;
          }
          case "Link": {
            // Only true `[text](url)` links; bare `[ref]` (e.g. inside
            // wikilinks) has no URL child and is left alone.
            const url = node.node.getChild("URL");
            if (!url) return;
            if (touches(state, node.from, node.to)) return false;
            const marks = node.node.getChildren("LinkMark");
            if (marks.length < 2) return false;
            hide(marks[0].from, marks[0].to);
            hide(marks[1].from, node.to);
            return false;
          }
          case "Image": {
            // The preview widget below the line does the showing; hide the
            // markdown itself unless the cursor is on its line.
            const line = state.doc.lineAt(node.from);
            if (touches(state, line.from, line.to)) return false;
            hide(node.from, node.to);
            return false;
          }
          case "Blockquote": {
            for (let pos = node.from; pos <= node.to; ) {
              const line = state.doc.lineAt(pos);
              decos.push(
                Decoration.line({ class: "cm-blockquote-line" }).range(
                  line.from,
                ),
              );
              pos = line.to + 1;
            }
            return;
          }
          case "QuoteMark": {
            const line = state.doc.lineAt(node.from);
            if (touches(state, line.from, line.to)) return;
            hideWithSpace(node.from, node.to);
            return;
          }
          case "ListMark": {
            if (node.node.nextSibling?.name === "Task") {
              // Task items get a checkbox; drop the bullet entirely.
              if (touches(state, node.from, node.to)) return;
              hideWithSpace(node.from, node.to);
              return;
            }
            const text = state.sliceDoc(node.from, node.to);
            if (!/^[-*+]$/.test(text)) return;
            if (touches(state, node.from, node.to)) return;
            decos.push(
              Decoration.replace({ widget: new BulletWidget() }).range(
                node.from,
                node.to,
              ),
            );
            return;
          }
          case "TaskMarker": {
            if (touches(state, node.from, node.to)) return;
            const checked = /x/i.test(state.sliceDoc(node.from, node.to));
            decos.push(
              Decoration.replace({ widget: new CheckboxWidget(checked) }).range(
                node.from,
                node.to,
              ),
            );
            return;
          }
          case "HorizontalRule": {
            const line = state.doc.lineAt(node.from);
            if (touches(state, line.from, line.to)) return;
            decos.push(
              Decoration.replace({ widget: new HrWidget() }).range(
                node.from,
                node.to,
              ),
            );
            return;
          }
          case "FencedCode": {
            for (let pos = node.from; pos <= node.to; ) {
              const line = state.doc.lineAt(pos);
              decos.push(
                Decoration.line({ class: "cm-codeblock-line" }).range(
                  line.from,
                ),
              );
              pos = line.to + 1;
            }
            if (touches(state, node.from, node.to)) return;
            const marks = node.node.getChildren("CodeMark");
            if (marks.length) {
              const info = node.node.getChild("CodeInfo");
              hide(marks[0].from, info ? info.to : marks[0].to);
              if (marks.length > 1) {
                const last = marks[marks.length - 1];
                hide(last.from, last.to);
              }
            }
            return;
          }
        }
      },
    });
  }

  return Decoration.set(decos, true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.startState.field(livePreviewEnabled) !==
          update.state.field(livePreviewEnabled)
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (instance) => instance.decorations },
);

const livePreviewTheme = EditorView.theme({
  ".cm-blockquote-line": {
    borderLeft: "3px solid rgb(var(--grim-text) / 0.22)",
    paddingLeft: "12px",
  },
  ".cm-codeblock-line": {
    backgroundColor: "rgb(var(--grim-text) / 0.05)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.9em",
    padding: "0 10px",
  },
  ".cm-list-bullet": {
    color: ACCENT,
    fontWeight: "700",
  },
  ".cm-rendered-hr": {
    display: "inline-block",
    width: "100%",
    verticalAlign: "middle",
    borderTop: "1px solid rgb(var(--grim-text) / 0.2)",
  },
  ".cm-task-checkbox": {
    accentColor: ACCENT,
    width: "15px",
    height: "15px",
    verticalAlign: "middle",
    margin: "0 2px 2px 0",
    cursor: "pointer",
  },
});

/**
 * Bear/Obsidian-style live preview: the document stays plain markdown, but
 * syntax marks are hidden until the cursor enters the construct they belong
 * to. Mod-E toggles raw source mode.
 */
export function livePreviewExtension(): Extension {
  return [
    livePreviewEnabled,
    livePreviewPlugin,
    livePreviewTheme,
    keymap.of([{ key: "Mod-e", run: toggleLivePreview }]),
  ];
}

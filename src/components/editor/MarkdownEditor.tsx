import { useEffect, useRef } from "react";
import { EditorView, placeholder, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { Clipboard, Copy, Scissors, Table } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  editorTheme,
  markdownHighlighting,
  wikilinkExtension,
  inlineTagExtension,
  wikilinkCompletionSource,
} from "./markdown-extensions";
import { imagePasteExtension, imagePreviewExtension } from "./image-extension";
import { livePreviewExtension } from "./live-preview";
import { insertTable, tableExtension } from "./table-extension";
import { slashCommandSource } from "./slash-commands";
import { getImageUrl, savePastedImage } from "@/store/notes-store";

const TABLE_MENU_SIZES: Array<{ columns: number; rows: number }> = [
  { columns: 2, rows: 2 },
  { columns: 3, rows: 3 },
  { columns: 4, rows: 3 },
  { columns: 5, rows: 3 },
];

interface MarkdownEditorProps {
  noteId: string;
  initialContent: string;
  getLinkableTitles: () => string[];
  isTitleResolved: (title: string) => boolean;
  onChange: (content: string) => void;
  onFollowLink: (title: string) => void;
  readOnly?: boolean;
}

export function MarkdownEditor({
  noteId,
  initialContent,
  getLinkableTitles,
  isTitleResolved,
  onChange,
  onFollowLink,
  readOnly = false,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartmentRef = useRef(new Compartment());

  // Keep latest callbacks without recreating the editor
  const callbacksRef = useRef({
    getLinkableTitles,
    isTitleResolved,
    onChange,
    onFollowLink,
  });
  callbacksRef.current = {
    getLinkableTitles,
    isTitleResolved,
    onChange,
    onFollowLink,
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        markdownHighlighting,
        livePreviewExtension(),
        tableExtension(),
        editorTheme,
        EditorView.lineWrapping,
        readOnlyCompartmentRef.current.of([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
        placeholder("Start writing… the first line becomes the title."),
        inlineTagExtension,
        wikilinkExtension({
          isResolved: (title) => callbacksRef.current.isTitleResolved(title),
          onFollow: (title) => callbacksRef.current.onFollowLink(title),
        }),
        autocompletion({
          override: [
            wikilinkCompletionSource(() =>
              callbacksRef.current.getLinkableTitles(),
            ),
            slashCommandSource,
          ],
          icons: false,
        }),
        imagePreviewExtension(getImageUrl),
        imagePasteExtension(savePastedImage),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            callbacksRef.current.onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate the editor only when switching notes; content edits flow
    // outward through the update listener, never back in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  // Before the context menu opens, move the cursor to the click point unless
  // the click landed inside the current selection.
  const handleContextMenu = (event: React.MouseEvent) => {
    const view = viewRef.current;
    if (!view) return;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos == null) return;
    const { main } = view.state.selection;
    if (pos < main.from || pos > main.to) {
      view.dispatch({ selection: { anchor: pos } });
    }
  };

  const handleInsertTable = (columns: number, rows: number) => {
    const view = viewRef.current;
    if (view) insertTable(view, columns, rows);
  };

  const handleCopy = async (cut: boolean) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    if (from === to) return;
    await navigator.clipboard.writeText(view.state.sliceDoc(from, to));
    if (cut && !readOnly) view.dispatch({ changes: { from, to } });
    view.focus();
  };

  const handlePaste = async () => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const text = await navigator.clipboard.readText().catch(() => "");
    if (text) view.dispatch(view.state.replaceSelection(text));
    view.focus();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          className="h-full overflow-y-auto"
          onContextMenu={handleContextMenu}
        />
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={readOnly}>
            <Table size={14} className="mr-2" />
            Insert table
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {TABLE_MENU_SIZES.map(({ columns, rows }) => (
              <ContextMenuItem
                key={columns}
                onClick={() => handleInsertTable(columns, rows)}
              >
                {columns} × {rows}
                <span className="ml-2 text-xs opacity-60">
                  {columns} columns
                </span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={readOnly} onClick={() => handleCopy(true)}>
          <Scissors size={14} className="mr-2" />
          Cut
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleCopy(false)}>
          <Copy size={14} className="mr-2" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem disabled={readOnly} onClick={handlePaste}>
          <Clipboard size={14} className="mr-2" />
          Paste
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

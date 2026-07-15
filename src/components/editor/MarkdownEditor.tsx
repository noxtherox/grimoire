import { useEffect, useRef } from "react";
import { EditorView, placeholder, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { completionKeymap } from "@codemirror/autocomplete";
import {
  editorTheme,
  markdownHighlighting,
  wikilinkExtension,
  inlineTagExtension,
  wikilinkAutocomplete,
} from "./markdown-extensions";
import { imagePasteExtension, imagePreviewExtension } from "./image-extension";
import { livePreviewExtension } from "./live-preview";
import { getImageUrl, savePastedImage } from "@/store/notes-store";

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
        wikilinkAutocomplete(() => callbacksRef.current.getLinkableTitles()),
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

  return <div ref={containerRef} className="h-full overflow-y-auto" />;
}

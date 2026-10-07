import { type Text } from "@codemirror/state";
import { type EditorView } from "@codemirror/view";
import {
  type App,
  MarkdownView,
  type MarkdownSectionInformation,
  type WorkspaceLeaf,
} from "obsidian";
import { getCalloutBodyLines } from "./getCalloutBodyText";

const CALLOUT_HEADER_WITH_INDENT_CAPTURE_REGEX = /^((?:> )+)\[!.+\]/;

/**
 * Helpers for locating a rendered callout's underlying source text in the editor. These power the
 * "Select (in editor)" callout button.
 */

type CalloutLineRange = {
  /** 0-indexed editor line numbers of the callout header line and last callout line, inclusive */
  headerLine: number;
  lastLine: number;
};

function findMarkdownViewContaining(app: App, el: HTMLElement): MarkdownView | null {
  let foundView: MarkdownView | null = null;
  app.workspace.iterateAllLeaves((leaf) => {
    if (foundView !== null) {
      return;
    }
    const view = leaf.view;
    if (view instanceof MarkdownView && view.containerEl.contains(el)) {
      foundView = view;
    }
  });
  return foundView;
}

function getCMEditorView(view: MarkdownView): EditorView | null {
  // `editor.cm` is the underlying CodeMirror 6 EditorView; not part of the official typings, but
  // stable across Obsidian versions and commonly used by plugins
  const cmEditorView = (view.editor as unknown as { cm?: EditorView }).cm;
  return cmEditorView ?? null;
}

function findCalloutHeaderLineNear(
  doc: Text,
  position: number
): { lineNumber: number; indent: string } | null {
  const startLineNumber = doc.lineAt(position).number;
  const minLineNumber = Math.max(1, startLineNumber - 2);
  const maxLineNumber = Math.min(doc.lines, startLineNumber + 2);
  for (let lineNumber = minLineNumber; lineNumber <= maxLineNumber; lineNumber++) {
    const indent = CALLOUT_HEADER_WITH_INDENT_CAPTURE_REGEX.exec(doc.line(lineNumber).text)?.[1];
    if (indent !== undefined) {
      return { lineNumber, indent };
    }
  }
  return null;
}

function getCalloutLineRangeViaCM(view: MarkdownView, calloutNode: HTMLElement): CalloutLineRange | null {
  const cmEditorView = getCMEditorView(view);
  if (cmEditorView === null) {
    return null;
  }
  const calloutDOMRoot = calloutNode.closest<HTMLElement>(".cm-callout") ?? calloutNode;
  let position: number;
  try {
    position = cmEditorView.posAtDOM(calloutDOMRoot);
  } catch {
    return null;
  }
  if (position < 0) {
    return null;
  }
  const doc = cmEditorView.state.doc;
  const header = findCalloutHeaderLineNear(doc, position);
  if (header === null) {
    return null;
  }
  const calloutBodyLines = getCalloutBodyLines({
    doc,
    calloutIndent: header.indent,
    bodyStartLine: header.lineNumber + 1,
  });
  return {
    headerLine: header.lineNumber - 1,
    lastLine: header.lineNumber + calloutBodyLines.length - 1,
  };
}

/**
 * Selects the whole callout block in the editor using the given markdown post processor section
 * info. Switches the view from Reading Mode to the editor (Live Preview) if needed, since the
 * selection is only visible in the editor. Returns whether the selection succeeded.
 */
export async function selectCalloutInEditorViaSectionInfo(
  app: App,
  calloutNode: HTMLElement,
  calloutSectionInfo: MarkdownSectionInformation
): Promise<boolean> {
  const view = findMarkdownViewContaining(app, calloutNode);
  if (view === null) {
    return false;
  }
  return await selectCalloutInEditor(view, calloutSectionInfo.lineStart, calloutSectionInfo.lineEnd);
}

/**
 * Selects the whole callout block in the editor by locating the callout's position in the document
 * via the CodeMirror view. Returns whether the selection succeeded.
 */
export async function selectCalloutInEditorViaCM(app: App, calloutNode: HTMLElement): Promise<boolean> {
  const view = findMarkdownViewContaining(app, calloutNode);
  if (view === null) {
    return false;
  }
  const calloutLineRange = getCalloutLineRangeViaCM(view, calloutNode);
  if (calloutLineRange === null) {
    return false;
  }
  return await selectCalloutInEditor(view, calloutLineRange.headerLine, calloutLineRange.lastLine);
}

async function selectCalloutInEditor(
  view: MarkdownView,
  headerLine: number,
  lastLine: number
): Promise<boolean> {
  const editorView = await switchToEditorIfNeeded(view);
  const editor = editorView.editor;
  const lastLineText = editor.getLine(lastLine);
  editor.setSelection({ line: headerLine, ch: 0 }, { line: lastLine, ch: lastLineText.length });
  editor.scrollIntoView({ from: { line: headerLine, ch: 0 }, to: { line: lastLine, ch: 0 } }, true);
  editor.focus();
  return true;
}

/**
 * If the view is in Reading Mode, switches the leaf to the editor (Live Preview), since the
 * selection is only visible in the editor. Returns the (possibly re-created) MarkdownView.
 */
async function switchToEditorIfNeeded(view: MarkdownView): Promise<MarkdownView> {
  if (view.getMode() !== "preview") {
    return view;
  }
  const leaf: WorkspaceLeaf = view.leaf;
  const viewState = leaf.getViewState();
  const state = viewState.state ?? {};
  if (state.mode !== "preview") {
    return view;
  }
  await leaf.setViewState({
    ...viewState,
    state: { ...state, mode: "source", source: false },
  });
  const newView = leaf.view;
  return newView instanceof MarkdownView ? newView : view;
}

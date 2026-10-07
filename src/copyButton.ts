import classNames from "classnames";
import { Notice, setIcon } from "obsidian";
import { addClassNames } from "./utils/addClassNames";

const SELECT_BUTTON_ICON = "text-cursor-input";

export function createCopyButton({
  getCalloutBodyText,
  onSelect,
  tooltipText,
  className,
}: {
  getCalloutBodyText: () => string | null;
  /** If provided, clicking the button selects the callout in the editor instead of copying */
  onSelect?: (() => Promise<boolean>) | undefined;
  tooltipText: string;
  className?: string;
}): HTMLDivElement {
  const copyButton = document.createElement("div");

  addClassNames({ el: copyButton, classNames: classNames("callout-copy-button", className) });
  copyButton.setAttribute("aria-label", tooltipText);
  setIcon(copyButton, onSelect !== undefined ? SELECT_BUTTON_ICON : "copy");

  // Using `mousedown` lets us prevent the default behavior of the `click` event (e.g. taking focus
  // which changes cursor/selection position in the editor)
  copyButton.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (copyButton.hasAttribute("disabled")) return;
    void onCopyButtonClick({ getCalloutBodyText, onSelect, copyButton });
  });

  // For some reason still need this to prevent the default behavior of clicking the callout block
  // (i.e. moving the cursor into the block to edit the callout)
  copyButton.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  return copyButton;
}

async function onCopyButtonClick({
  getCalloutBodyText,
  onSelect,
  copyButton,
}: {
  getCalloutBodyText: () => string | null;
  onSelect?: (() => Promise<boolean>) | undefined;
  copyButton: HTMLDivElement;
}): Promise<void> {
  if (copyButton.hasAttribute("disabled")) return;

  if (onSelect !== undefined) {
    const selectionSucceeded = await onSelect();
    if (selectionSucceeded) {
      flashButton(copyButton, SELECT_BUTTON_ICON);
    } else {
      new Notice("Callout Copy Buttons: Could not locate the callout in the editor");
    }
    return;
  }

  const calloutBodyText = getCalloutBodyText();

  if (calloutBodyText === null) {
    new Notice("Error: Could not copy callout text");
    return;
  }

  if (calloutBodyText === "") {
    new Notice("Callout Copy Buttons: Nothing to copy");
    return;
  }

  await navigator.clipboard.writeText(calloutBodyText);

  // console.log(`Copied: ${JSON.stringify(calloutBodyText)}`);
  flashButton(copyButton, "copy");
}

function flashButton(copyButton: HTMLDivElement, iconToRestore: string): void {
  setIcon(copyButton, "check");
  copyButton.classList.add("just-copied");
  copyButton.setAttribute("disabled", "true");

  setTimeout(() => {
    setIcon(copyButton, iconToRestore);
    copyButton.classList.remove("just-copied");
    copyButton.removeAttribute("disabled");
  }, 3000);
}

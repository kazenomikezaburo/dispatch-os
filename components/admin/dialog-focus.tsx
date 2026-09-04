import type { KeyboardEvent } from "react";

const selector = 'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]:not([data-focus-guard])';
function focusableControls(dialog: HTMLDialogElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter((element) => element.getClientRects().length > 0 && !element.closest("[inert]"));
}

// Focus guards also cover assistive tools that move focus without a keydown event.
export function DialogFocusGuard({ edge }: { edge: "start" | "end" }) {
  return <span data-focus-guard tabIndex={0} className="fixed size-px overflow-hidden opacity-0" onFocus={(event) => {
    const dialog = event.currentTarget.closest("dialog");
    if (!dialog) return;
    const controls = focusableControls(dialog);
    (edge === "start" ? controls.at(-1) : controls[0])?.focus();
  }} />;
}

// Keep Tab inside the dialog instead of allowing focus to leave for browser chrome.
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key.toLowerCase() !== "tab" && event.code !== "Tab") return;
  const dialog = event.currentTarget;
  const controls = focusableControls(dialog);
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) { event.preventDefault(); return; }
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
}

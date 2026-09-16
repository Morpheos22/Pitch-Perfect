// src/hooks/use-unsaved-changes-warning.ts
//
// Warns the user when they try to navigate away or close the tab with unsaved changes.
// Extracted from 3+ session detail pages that had identical beforeunload patterns.

import { useEffect } from "react";

/**
 * Register a beforeunload warning when the user has unsaved changes.
 *
 * @param hasUnsavedChanges - Whether there are unsaved changes to warn about.
 *   When true, attempting to close the tab or navigate to a different site
 *   will trigger the browser's native "Leave site?" dialog.
 *   In-app navigation (Next.js router) is NOT intercepted by this hook —
 *   that must be handled separately in the component.
 *
 * @example
 * ```tsx
 * const [notes, setNotes] = useState(initialNotes);
 * const hasChanges = notes !== initialNotes;
 * useUnsavedChangesWarning(hasChanges);
 * ```
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers ignore custom messages and show a generic prompt.
      // We still need to call preventDefault() to trigger the dialog.
      e.preventDefault();
      // Legacy support: some browsers display the return value
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}

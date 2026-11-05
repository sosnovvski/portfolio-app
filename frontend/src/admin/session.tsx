"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { AdminApi } from "./api";

export interface AdminSession {
  api: AdminApi;
  /** Goes up at each login, so screens whose data failed to load can load it again. */
  generation: number;
  /** Each form reports here under its own id, so leaving the page or logging out can warn about any of them. */
  setFormDirty(id: string, dirty: boolean): void;
}

export const SessionContext = createContext<AdminSession | null>(null);

function warnBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
}

export function useDirtyForms() {
  const dirtyForms = useRef(new Set<string>());

  const setFormDirty = useCallback((id: string, dirty: boolean) => {
    if (dirty) {
      dirtyForms.current.add(id);
    } else {
      dirtyForms.current.delete(id);
    }
    // Attached only while there is something to lose. Adding the same handler twice has no effect.
    if (dirtyForms.current.size > 0) {
      window.addEventListener("beforeunload", warnBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    }
  }, []);

  const hasDirtyForms = useCallback(() => dirtyForms.current.size > 0, []);

  useEffect(() => () => window.removeEventListener("beforeunload", warnBeforeUnload), []);

  return { setFormDirty, hasDirtyForms };
}

export function useAdminSession(): AdminSession {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useAdminSession must be used inside AdminApp");
  }
  return session;
}

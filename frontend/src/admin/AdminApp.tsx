"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createAdminApi, fetchSession, logout } from "./api";
import { LoginForm } from "./LoginForm";
import { CredentialsScreen } from "./screens/CredentialsScreen";
import { ExperiencesScreen } from "./screens/ExperiencesScreen";
import { MessagesScreen } from "./screens/MessagesScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { SkillGroupsScreen } from "./screens/SkillGroupsScreen";
import { SessionContext, useDirtyForms } from "./session";

const SCREENS = [
  { id: "profile", title: "Profile", Component: ProfileScreen },
  { id: "experiences", title: "Experiences", Component: ExperiencesScreen },
  { id: "skills", title: "Skill groups", Component: SkillGroupsScreen },
  { id: "credentials", title: "Credentials", Component: CredentialsScreen },
  { id: "projects", title: "Projects", Component: ProjectsScreen },
  { id: "messages", title: "Messages", Component: MessagesScreen },
] as const;

type ScreenId = (typeof SCREENS)[number]["id"];
const DEFAULT_SCREEN: ScreenId = "profile";
const SCREEN_WITHOUT_DRAFTS: ScreenId = "messages";
const WRITE_LOST_TEXT = "Your last change was not saved because your session ended. Your text is kept. Try again.";

function screenFromHash(hash: string): ScreenId {
  const wanted = hash.replace(/^#/, "");
  return SCREENS.find((screen) => screen.id === wanted)?.id ?? DEFAULT_SCREEN;
}

function subscribeToHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

function useActiveScreen(): ScreenId {
  return useSyncExternalStore(
    subscribeToHash,
    () => screenFromHash(window.location.hash),
    () => DEFAULT_SCREEN,
  );
}

/** What to put right after a new login: where focus was, and whether a write was lost. */
class SessionExpiry {
  private focused: Element | null = null;
  private lastFocused: Element | null = null;
  private writeLost = false;
  private restorePending = false;

  noteFocus(element: Element) {
    if (element.closest(".admin-wrap")) {
      this.lastFocused = element;
    }
  }

  record(wasWrite: boolean) {
    // A Save button is disabled while saving, which puts activeElement on the body in a real browser,
    // so the last element to have focus is the one that counts. Several calls can get a 401 together,
    // and the first one wins, because by the later ones focus is already on the login form.
    this.focused ??= this.lastFocused;
    this.writeLost ||= wasWrite;
  }

  loggedIn() {
    this.restorePending = true;
  }

  /** Answers once per login, with the element that had focus, if any. */
  takeRestore(): { focused: Element | null; writeLost: boolean } | null {
    if (!this.restorePending) {
      return null;
    }
    const result = { focused: this.focused, writeLost: this.writeLost };
    this.restorePending = false;
    this.focused = null;
    this.lastFocused = null;
    this.writeLost = false;
    return result;
  }
}

type AuthState =
  | { status: "checking" }
  | { status: "unreachable" }
  | { status: "anonymous" }
  | { status: "authenticated" }
  /** The session ended mid-work. Screens stay mounted and hidden, so nothing typed is lost. */
  | { status: "expired" };

function Screens({ hidden }: { hidden: boolean }) {
  const active = useActiveScreen();
  const [visited, setVisited] = useState<ReadonlySet<ScreenId>>(() => new Set([active]));
  const mainRef = useRef<HTMLElement>(null);
  const previous = useRef(active);

  if (!visited.has(active)) {
    setVisited(new Set(visited).add(active));
  }

  useEffect(() => {
    const title = SCREENS.find((screen) => screen.id === active)?.title;
    document.title = `${title}: admin`;
    if (previous.current !== active) {
      previous.current = active;
      mainRef.current?.querySelector<HTMLElement>(`[data-screen="${active}"] h1`)?.focus();
    }
  }, [active]);

  return (
    <main ref={mainRef} id="admin-main" hidden={hidden}>
      {/* Screens already opened stay mounted, so moving between them keeps unsaved text. */}
      {SCREENS.filter((screen) => visited.has(screen.id)).map(({ id, title, Component }) => (
        <div key={id} data-screen={id} hidden={id !== active}>
          <h1 tabIndex={-1}>{title}</h1>
          {/* Visitors' names and messages should not stay in the page of an idle tab. It reloads on login. */}
          {hidden && id === SCREEN_WITHOUT_DRAFTS ? null : <Component />}
        </div>
      ))}
    </main>
  );
}

function Header({ onLogout, error }: { onLogout: () => void; error: string | null }) {
  const active = useActiveScreen();

  function skipToContent() {
    document.querySelector<HTMLElement>(`[data-screen="${active}"] h1`)?.focus();
  }

  return (
    <header className="admin-top">
      <button type="button" className="skip" onClick={skipToContent}>
        Skip to content
      </button>
      <a className="view-site" href="/en" target="_blank" rel="noopener noreferrer">
        View site<span className="visually-hidden"> (opens in a new tab)</span>
      </a>
      <nav aria-label="Admin sections">
        {SCREENS.map((screen) => (
          <a key={screen.id} href={`#${screen.id}`} {...(screen.id === active ? { "aria-current": "page" as const } : {})}>
            {screen.title}
          </a>
        ))}
      </nav>
      <button type="button" onClick={onLogout}>
        Log out
      </button>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}

export function AdminApp() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [generation, setGeneration] = useState(0);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const { setFormDirty, hasDirtyForms } = useDirtyForms();
  const [expiry] = useState(() => new SessionExpiry());

  const applySession = useCallback((session: Awaited<ReturnType<typeof fetchSession>>) => {
    if (!session.ok) {
      setAuth({ status: "unreachable" });
      return;
    }
    setAuth({ status: session.data.authenticated ? "authenticated" : "anonymous" });
  }, []);

  // Once per load. Polling would keep the session alive, and an open tab must reach the idle timeout.
  useEffect(() => {
    void fetchSession().then(applySession);
  }, [applySession]);

  const api = useMemo(
    () =>
      createAdminApi(({ wasWrite }) => {
        expiry.record(wasWrite);
        setAuth({ status: "expired" });
      }),
    [expiry],
  );
  const session = useMemo(() => ({ api, generation, setFormDirty }), [api, generation, setFormDirty]);

  useEffect(() => {
    const noteFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) {
        expiry.noteFocus(event.target);
      }
    };
    document.addEventListener("focusin", noteFocus);
    return () => document.removeEventListener("focusin", noteFocus);
  }, [expiry]);

  // Before paint, so focus never falls to the body after the login form goes away.
  useLayoutEffect(() => {
    if (auth.status !== "authenticated") {
      return;
    }
    const restore = expiry.takeRestore();
    if (!restore) {
      return;
    }
    if (restore.focused instanceof HTMLElement && restore.focused.isConnected) {
      restore.focused.focus();
    }
    if (!restore.focused || document.activeElement !== restore.focused) {
      document.querySelector<HTMLElement>("[data-screen]:not([hidden]) h1")?.focus();
    }
    if (restore.writeLost) {
      // After this commit, once the screens are visible again, or the change may not be announced.
      setTimeout(() => setLiveMessage(WRITE_LOST_TEXT), 0);
    }
  }, [auth.status, expiry]);

  function handleLoggedIn() {
    expiry.loggedIn();
    setLiveMessage("");
    setGeneration((current) => current + 1);
    setAuth({ status: "authenticated" });
  }

  async function handleLogout() {
    if (hasDirtyForms() && !window.confirm("You have unsaved changes. Log out and discard them?")) {
      return;
    }
    setLogoutError(null);
    const result = await logout();
    if (!result.ok && result.failure.kind !== "unauthorized") {
      setLogoutError("You are still logged in, because the server could not be reached. Try again.");
      return;
    }
    // Screens unmount here, so messages and drafts leave memory. This also fetches the rotated cookie.
    applySession(await fetchSession());
  }

  switch (auth.status) {
    case "checking":
      return (
        <main className="login">
          <h1>Admin</h1>
          <p>Loading</p>
          <noscript>
            <p className="err">The admin panel needs JavaScript.</p>
          </noscript>
        </main>
      );
    case "unreachable":
      return (
        <main className="login">
          <h1>Admin</h1>
          <p className="err" role="alert">
            Could not reach the server.
          </p>
          <button type="button" onClick={() => void fetchSession().then(applySession)}>
            Try again
          </button>
        </main>
      );
    case "anonymous":
      return <LoginForm notice={null} onLoggedIn={handleLoggedIn} />;
    default:
  }

  const expired = auth.status === "expired";
  return (
    <SessionContext.Provider value={session}>
      {expired && (
        <LoginForm
          notice="Your session ended. Log in again. Anything you typed is still here."
          onLoggedIn={handleLoggedIn}
        />
      )}
      {/* Always mounted: text set in a hidden container is not announced. */}
      <p className="visually-hidden" role="status">
        {liveMessage}
      </p>
      <div className="admin-wrap" hidden={expired}>
        <Header onLogout={() => void handleLogout()} error={logoutError} />
        <Screens hidden={expired} />
      </div>
    </SessionContext.Provider>
  );
}

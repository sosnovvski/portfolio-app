"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { waitInUnits } from "@/lib/contact";
import { fetchSession, login } from "./api";

function waitText(seconds: number | null): string {
  if (seconds === null) {
    return "Too many login attempts. Try again later.";
  }
  const { unit, count } = waitInUnits(seconds);
  return `Too many login attempts. Try again in ${count} ${count === 1 ? unit.slice(0, -1) : unit}.`;
}

export function LoginForm({ notice, onLoggedIn }: { notice: string | null; onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) {
      return;
    }
    setSending(true);
    setError(null);

    const result = await login(username, password);
    if (result.ok) {
      // The token rotated at login, and this fetches the new cookie.
      const session = await fetchSession();
      if (session.ok && session.data.authenticated) {
        onLoggedIn();
        return;
      }
      setSending(false);
      setError("You logged in, but the session could not be confirmed. Reload the page.");
      return;
    }

    setSending(false);
    setPassword("");
    passwordRef.current?.focus();
    switch (result.failure.kind) {
      case "unauthorized":
        setError("Wrong username or password.");
        break;
      case "rateLimited":
        setError(waitText(result.failure.retryAfterSeconds));
        break;
      case "forbidden":
        setError("The login could not be verified. Reload the page and try again.");
        break;
      case "network":
        setError("Could not reach the server. Check your connection and try again.");
        break;
      default:
        setError("The server had a problem. Try again in a few minutes.");
    }
  }

  return (
    <main className="login">
      <h1>Log in</h1>
      {notice && (
        <p className="notice" id="login-notice">
          {notice}
        </p>
      )}
      <form onSubmit={handleSubmit} className="stack">
        <div className="field">
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            ref={usernameRef}
            name="username"
            autoComplete="username"
            required
            {...(notice ? { "aria-describedby": "login-notice" } : {})}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            ref={passwordRef}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="submit" className="primary" disabled={sending}>
          {sending ? "Logging in" : "Log in"}
        </button>
        <p className="err" role="alert">
          {error}
        </p>
      </form>
    </main>
  );
}

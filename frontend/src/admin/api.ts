import type { ApiProblem, SessionView } from "@/api/types";
import { parseRetryAfter } from "@/lib/contact";

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";
const SESSION_PATH = "/api/auth/session";
const TIMEOUT_MS = 15000;

/** Class-level validity checks come back under their own names, which no input has. */
const FIELD_ALIASES: Record<string, string> = { endValid: "end", endYearValid: "endYear" };

export type FieldErrors = Record<string, string>;

export type ApiFailure =
  | { kind: "unauthorized" }
  | { kind: "forbidden"; detail: string | null }
  | { kind: "notFound"; detail: string | null }
  | { kind: "conflict"; detail: string | null }
  | { kind: "invalid"; fields: FieldErrors; detail: string | null }
  | { kind: "rateLimited"; retryAfterSeconds: number | null }
  | { kind: "server"; detail: string | null }
  | { kind: "network" };

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; failure: ApiFailure };

/** Always read at the moment of use: the cookie rotates at login and must never be kept. */
export function readCsrfToken(cookies: string = document.cookie): string | null {
  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (part.slice(0, separator).trim() === CSRF_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

export function mapFieldErrors(errors: ApiProblem["errors"]): FieldErrors {
  const fields: FieldErrors = {};
  for (const { field, message } of errors ?? []) {
    const name = FIELD_ALIASES[field] ?? field;
    fields[name] = fields[name] ? `${fields[name]}; ${message}` : message;
  }
  return fields;
}

async function toFailure(response: Response): Promise<ApiFailure> {
  const problem = (await response.json().catch(() => ({}))) as Partial<ApiProblem>;
  const detail = problem.detail ?? null;
  switch (response.status) {
    case 400:
      return { kind: "invalid", fields: mapFieldErrors(problem.errors), detail };
    case 401:
      return { kind: "unauthorized" };
    case 403:
      return { kind: "forbidden", detail };
    case 404:
      return { kind: "notFound", detail };
    case 409:
      return { kind: "conflict", detail };
    case 429:
      return {
        kind: "rateLimited",
        retryAfterSeconds: parseRetryAfter(response.headers.get("Retry-After"), Date.now()),
      };
    default:
      return { kind: "server", detail };
  }
}

async function toResult<T>(send: () => Promise<Response>): Promise<ApiResult<T>> {
  // The body read is inside too: a dropped connection or the timeout can strike there, and an
  // unhandled rejection would leave the button stuck on "Saving".
  try {
    const response = await send();
    if (!response.ok) {
      return { ok: false, failure: await toFailure(response) };
    }
    const text = await response.text();
    return { ok: true, status: response.status, data: (text ? JSON.parse(text) : undefined) as T };
  } catch {
    return { ok: false, failure: { kind: "network" } };
  }
}

function send(method: string, path: string, headers: Record<string, string>, body?: BodyInit): Promise<Response> {
  return fetch(path, {
    method,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...(body === undefined ? {} : { body }),
  });
}

/** Also makes sure the CSRF cookie exists. Called on load and after login and logout, and never on a timer. */
export function fetchSession(): Promise<ApiResult<SessionView>> {
  return toResult(() => send("GET", SESSION_PATH, { Accept: "application/json" }));
}

/**
 * A write that gets 403 has a stale or missing token, so it fetches a new cookie and tries once more.
 * The headers are built inside the loop: each attempt reads the cookie again.
 */
async function write<T>(method: string, path: string, contentType: string | null, body?: BodyInit): Promise<ApiResult<T>> {
  const attempt = () =>
    toResult<T>(() =>
      send(
        method,
        path,
        {
          Accept: "application/json",
          ...(contentType ? { "Content-Type": contentType } : {}),
          [CSRF_HEADER]: readCsrfToken() ?? "",
        },
        body,
      ),
    );

  const first = await attempt();
  if (first.ok || first.failure.kind !== "forbidden") {
    return first;
  }
  const session = await fetchSession();
  return session.ok ? attempt() : first;
}

export function login(username: string, password: string): Promise<ApiResult<void>> {
  const body = new URLSearchParams({ username, password }).toString();
  return write("POST", "/api/auth/login", "application/x-www-form-urlencoded", body);
}

export function logout(): Promise<ApiResult<void>> {
  return write("POST", "/api/auth/logout", null);
}

export interface AdminApi {
  get<T>(path: string): Promise<ApiResult<T>>;
  post<T>(path: string, body: unknown): Promise<ApiResult<T>>;
  put<T>(path: string, body: unknown): Promise<ApiResult<T>>;
  patch<T>(path: string, body: unknown): Promise<ApiResult<T>>;
  delete(path: string): Promise<ApiResult<void>>;
}

/** Every admin call goes through here, so any 401 reaches the one handler that shows the login form. */
export function createAdminApi(onUnauthorized: (info: { wasWrite: boolean }) => void): AdminApi {
  async function watch<T>(request: Promise<ApiResult<T>>, wasWrite = true): Promise<ApiResult<T>> {
    const result = await request;
    if (!result.ok && result.failure.kind === "unauthorized") {
      onUnauthorized({ wasWrite });
    }
    return result;
  }
  const json = "application/json";

  return {
    get: (path) => watch(toResult(() => send("GET", path, { Accept: json })), false),
    post: (path, body) => watch(write("POST", path, json, JSON.stringify(body))),
    put: (path, body) => watch(write("PUT", path, json, JSON.stringify(body))),
    patch: (path, body) => watch(write("PATCH", path, json, JSON.stringify(body))),
    delete: (path) => watch(write("DELETE", path, null)),
  };
}

/** What to tell the owner, for failures that are not handled by a more specific message. */
export function failureText(failure: ApiFailure): string {
  switch (failure.kind) {
    case "unauthorized":
      return "Your session ended. Log in again. Anything you typed is still here.";
    case "forbidden":
      return "This request was refused. Your text is kept. Copy it somewhere safe before reloading the page.";
    case "notFound":
      return failure.detail ?? "This item no longer exists.";
    case "conflict":
      return failure.detail ?? "This change conflicts with existing data.";
    case "invalid":
      return failure.detail ?? "The server did not accept this. Check the values and try again.";
    case "rateLimited":
      return "Too many requests. Wait a little and try again.";
    case "server":
      return "The server had a problem. Try again in a few minutes.";
    case "network":
      return "Could not reach the server. Check your connection and try again.";
  }
}

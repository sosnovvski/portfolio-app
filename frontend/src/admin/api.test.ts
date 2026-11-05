import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminApi, failureText, fetchSession, login, logout, mapFieldErrors, readCsrfToken } from "./api";
import { json, noContent, problem, setCookie, stubServer } from "./testServer";

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("readCsrfToken", () => {
  it("finds and decodes the cookie among others", () => {
    expect(readCsrfToken("a=1; XSRF-TOKEN=ab%2Fc; b=2")).toBe("ab/c");
    expect(readCsrfToken("a=1")).toBeNull();
    expect(readCsrfToken("")).toBeNull();
  });
});

describe("mapFieldErrors", () => {
  it("moves class-level checks to their inputs", () => {
    expect(
      mapFieldErrors([
        { field: "endValid", message: "must not be before the start month" },
        { field: "endYearValid", message: "must not be before the start year" },
        { field: "skills[2]", message: "must not be blank" },
      ]),
    ).toEqual({
      end: "must not be before the start month",
      endYear: "must not be before the start year",
      "skills[2]": "must not be blank",
    });
  });

  it("keeps every message for a field", () => {
    expect(mapFieldErrors([{ field: "a", message: "one" }, { field: "a", message: "two" }])).toEqual({ a: "one; two" });
  });
});

describe("login", () => {
  it("posts a form-encoded body with the CSRF header", async () => {
    setCookie("token-1");
    const { calls } = stubServer({ "POST /api/auth/login": () => noContent() });

    const result = await login("kamil", "p&ss word");

    expect(result.ok).toBe(true);
    expect(calls[0]?.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(calls[0]?.headers["X-XSRF-TOKEN"]).toBe("token-1");
    expect(calls[0]?.body).toBe("username=kamil&password=p%26ss+word");
  });

  it("reports wrong credentials, and the wait on 429", async () => {
    stubServer({ "POST /api/auth/login": () => problem(401) });
    expect(await login("a", "b")).toEqual({ ok: false, failure: { kind: "unauthorized" } });

    stubServer({ "POST /api/auth/login": () => problem(429, {}, { "Retry-After": "120" }) });
    expect(await login("a", "b")).toEqual({ ok: false, failure: { kind: "rateLimited", retryAfterSeconds: 120 } });
  });

  it("on 403 fetches a new token and retries once with it", async () => {
    setCookie("stale");
    let logins = 0;
    const { calls } = stubServer({
      "GET /api/auth/session": () => {
        setCookie("fresh");
        return json({ authenticated: false });
      },
      "POST /api/auth/login": () => (++logins === 1 ? problem(403) : noContent()),
    });

    const result = await login("a", "b");

    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.method)).toEqual(["POST", "GET", "POST"]);
    expect(calls[0]?.headers["X-XSRF-TOKEN"]).toBe("stale");
    expect(calls[2]?.headers["X-XSRF-TOKEN"]).toBe("fresh");
  });

  it("gives up after one retry", async () => {
    const { calls } = stubServer({
      "GET /api/auth/session": () => json({ authenticated: false }),
      "POST /api/auth/login": () => problem(403, { detail: "Not allowed" }),
    });

    expect(await login("a", "b")).toEqual({ ok: false, failure: { kind: "forbidden", detail: "Not allowed" } });
    expect(calls).toHaveLength(3);
  });
});

describe("the CSRF token is never kept", () => {
  it("reads the cookie again for each write", async () => {
    const { calls } = stubServer({ "PUT /x": () => json({}), "POST /api/auth/logout": () => noContent() });
    const api = createAdminApi(() => {});

    setCookie("before-login");
    await api.put("/x", {});
    setCookie("after-login");
    await api.put("/x", {});
    setCookie("rotated-again");
    await logout();

    expect(calls.map((call) => call.headers["X-XSRF-TOKEN"])).toEqual(["before-login", "after-login", "rotated-again"]);
  });

  it("sends no token on a read", async () => {
    setCookie("t");
    const { calls } = stubServer({ "GET /x": () => json([]) });
    await createAdminApi(() => {}).get("/x");
    expect(calls[0]?.headers["X-XSRF-TOKEN"]).toBeUndefined();
  });
});

describe("createAdminApi", () => {
  it("reports any 401 to the one handler", async () => {
    stubServer({ "GET /a": () => problem(401), "PUT /b": () => problem(401), "DELETE /c": () => problem(401) });
    const onUnauthorized = vi.fn();
    const api = createAdminApi(onUnauthorized);

    await api.get("/a");
    await api.put("/b", {});
    await api.delete("/c");

    expect(onUnauthorized).toHaveBeenCalledTimes(3);
  });

  it("does not report other failures as a lost session", async () => {
    stubServer({ "GET /a": () => problem(500) });
    const onUnauthorized = vi.fn();
    await createAdminApi(onUnauthorized).get("/a");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("maps statuses", async () => {
    const api = createAdminApi(() => {});
    stubServer({ "PUT /a": () => problem(409, { detail: "Changed" }) });
    expect(await api.put("/a", {})).toEqual({ ok: false, failure: { kind: "conflict", detail: "Changed" } });

    stubServer({ "PUT /a": () => problem(404) });
    expect(await api.put("/a", {})).toEqual({ ok: false, failure: { kind: "notFound", detail: null } });

    stubServer({ "PUT /a": () => problem(400, { errors: [{ field: "endValid", message: "bad" }] }) });
    expect(await api.put("/a", {})).toEqual({
      ok: false,
      failure: { kind: "invalid", fields: { end: "bad" }, detail: null },
    });

    stubServer({ "PUT /a": () => new TypeError("offline") });
    expect(await api.put("/a", {})).toEqual({ ok: false, failure: { kind: "network" } });
  });

  it("returns data, and nothing for an empty 204", async () => {
    const api = createAdminApi(() => {});
    stubServer({ "POST /a": () => json({ id: 7 }, 201), "DELETE /a": () => noContent() });
    expect(await api.post("/a", {})).toEqual({ ok: true, status: 201, data: { id: 7 } });
    expect(await api.delete("/a")).toEqual({ ok: true, status: 204, data: undefined });
  });
});

describe("a failure while reading the body", () => {
  function brokenBody() {
    return { ok: true, status: 200, text: () => Promise.reject(new DOMException("aborted", "TimeoutError")) } as unknown as Response;
  }

  it("is a network failure, not a rejected promise", async () => {
    stubServer({ "PUT /a": () => brokenBody(), "GET /a": () => brokenBody() });
    const api = createAdminApi(() => {});
    await expect(api.put("/a", {})).resolves.toEqual({ ok: false, failure: { kind: "network" } });
    await expect(api.get("/a")).resolves.toEqual({ ok: false, failure: { kind: "network" } });
  });

  it("treats a cut-off JSON body the same way", async () => {
    stubServer({ "GET /a": () => new Response('{"id":') });
    await expect(createAdminApi(() => {}).get("/a")).resolves.toEqual({ ok: false, failure: { kind: "network" } });
  });
});

describe("the 401 callback", () => {
  it("says whether a write was lost", async () => {
    stubServer({ "GET /a": () => problem(401), "PUT /a": () => problem(401) });
    const onUnauthorized = vi.fn();
    const api = createAdminApi(onUnauthorized);
    await api.get("/a");
    expect(onUnauthorized).toHaveBeenLastCalledWith({ wasWrite: false });
    await api.put("/a", {});
    expect(onUnauthorized).toHaveBeenLastCalledWith({ wasWrite: true });
  });
});

describe("fetchSession", () => {
  it("reads the state and treats a network failure as a failure", async () => {
    stubServer({ "GET /api/auth/session": () => json({ authenticated: true }) });
    expect(await fetchSession()).toEqual({ ok: true, status: 200, data: { authenticated: true } });

    stubServer({ "GET /api/auth/session": () => new TypeError("offline") });
    expect((await fetchSession()).ok).toBe(false);
  });
});

describe("failureText", () => {
  it("tells the owner to save their text on a 403, and never just to reload", () => {
    expect(failureText({ kind: "forbidden", detail: "Reload the page and try again." })).toBe(
      "This request was refused. Your text is kept. Copy it somewhere safe before reloading the page.",
    );
  });

  it("prefers what the server said", () => {
    expect(failureText({ kind: "conflict", detail: "Slug in use" })).toBe("Slug in use");
    expect(failureText({ kind: "network" })).toContain("Could not reach the server");
  });
});

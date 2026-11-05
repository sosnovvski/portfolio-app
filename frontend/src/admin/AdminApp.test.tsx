import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApp } from "./AdminApp";
import { json, noContent, problem, setCookie, stubServer } from "./testServer";

const PROFILE = {
  version: 3,
  fullName: "Kamil",
  headlineEn: "Headline",
  headlinePl: "Nagłówek",
  summaryEn: "Summary",
  summaryPl: "Podsumowanie",
  locationEn: "Gdańsk, Poland",
  locationPl: "Gdańsk",
  linkedinUrl: "https://example.com/in",
};

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.location.hash = "";
});

async function logIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Username"), "kamil");
  await user.type(screen.getByLabelText("Password"), "secret");
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("loading", () => {
  it("asks for the session once and shows the login form when anonymous", async () => {
    const { calls } = stubServer({ "GET /api/auth/session": () => json({ authenticated: false }) });
    render(<AdminApp />);

    expect(await screen.findByLabelText("Username")).toHaveFocus();
    expect(calls).toHaveLength(1);
  });

  it("never polls the session, so an open tab can reach the idle timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { calls } = stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
    });
    render(<AdminApp />);
    await screen.findByLabelText("Full name (required)");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    });

    expect(calls.filter((call) => call.url === "/api/auth/session")).toHaveLength(1);
  });

  it("offers a retry when the server cannot be reached", async () => {
    const user = userEvent.setup();
    let reachable = false;
    stubServer({
      "GET /api/auth/session": () => (reachable ? json({ authenticated: false }) : new TypeError("offline")),
    });
    render(<AdminApp />);

    await screen.findByText("Could not reach the server.");
    reachable = true;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Username")).toBeInTheDocument();
  });
});

describe("login", () => {
  it("logs in, fetches the session again, then opens the panel", async () => {
    const user = userEvent.setup();
    setCookie("t1");
    let authenticated = false;
    const { calls } = stubServer({
      "GET /api/auth/session": () => json({ authenticated }),
      "POST /api/auth/login": () => {
        authenticated = true;
        setCookie("t2");
        return noContent();
      },
      "GET /api/admin/profile": () => json(PROFILE),
    });
    render(<AdminApp />);
    await logIn(user);

    expect(await screen.findByRole("heading", { level: 1, name: "Profile" })).toBeInTheDocument();
    expect(calls.map((call) => `${call.method} ${call.url}`).slice(0, 3)).toEqual([
      "GET /api/auth/session",
      "POST /api/auth/login",
      "GET /api/auth/session",
    ]);
  });

  it("says when the credentials are wrong, clears the password and focuses it", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: false }),
      "POST /api/auth/login": () => problem(401),
    });
    render(<AdminApp />);
    await logIn(user);

    expect(await screen.findByText("Wrong username or password.")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveFocus();
    expect(screen.getByLabelText("Username")).toHaveValue("kamil");
  });

  it("tells the wait on 429", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: false }),
      "POST /api/auth/login": () => problem(429, {}, { "Retry-After": "900" }),
    });
    render(<AdminApp />);
    await logIn(user);

    expect(await screen.findByText("Too many login attempts. Try again in 15 minutes.")).toBeInTheDocument();
  });
});

describe("a session that ends mid-work", () => {
  it("returns to login on a 401, keeps the typed text, and lets the save finish after login", async () => {
    const user = userEvent.setup();
    let puts = 0;
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
      "PUT /api/admin/profile": (call) => {
        puts += 1;
        return puts === 1 ? problem(401) : json({ ...JSON.parse(call.body ?? "{}"), version: 4 });
      },
      "POST /api/auth/login": () => noContent(),
    });
    render(<AdminApp />);

    const name = await screen.findByLabelText("Full name (required)");
    await user.clear(name);
    await user.type(name, "Typed before the session ended");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText(/Your session ended/)).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(name).not.toBeVisible();

    await logIn(user);

    await waitFor(() => expect(name).toBeVisible());
    expect(name).toHaveValue("Typed before the session ended");

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText("Saved. The public site shows this now.");
    expect(puts).toBe(2);
  });
});

describe("after login", () => {
  it("moves focus to the screen's heading, not the body", async () => {
    const user = userEvent.setup();
    let authenticated = false;
    stubServer({
      "GET /api/auth/session": () => json({ authenticated }),
      "POST /api/auth/login": () => {
        authenticated = true;
        return noContent();
      },
      "GET /api/admin/profile": () => json(PROFILE),
    });
    render(<AdminApp />);
    await logIn(user);

    expect(await screen.findByRole("heading", { level: 1, name: "Profile" })).toHaveFocus();
  });

  it("leaves focus alone on a page load with a session already open", async () => {
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
    });
    render(<AdminApp />);
    await screen.findByLabelText("Full name (required)");
    expect(document.body).toHaveFocus();
  });
});

describe("expiry and focus", () => {
  function expiringServer() {
    let puts = 0;
    return stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
      "PUT /api/admin/profile": () => (++puts === 1 ? problem(401) : json({ ...PROFILE, version: 9 })),
      "POST /api/auth/login": () => noContent(),
    });
  }

  it("ties the notice to the username field, so it is read", async () => {
    const user = userEvent.setup();
    expiringServer();
    render(<AdminApp />);
    await screen.findByLabelText("Full name (required)");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    const username = await screen.findByLabelText("Username");
    expect(username).toHaveFocus();
    expect(document.getElementById(username.getAttribute("aria-describedby") ?? "")).toHaveTextContent("Your session ended");
  });

  it("returns focus to where it was, and only then announces the lost change", async () => {
    const user = userEvent.setup();
    expiringServer();
    render(<AdminApp />);
    await screen.findByLabelText("Full name (required)");
    const save = screen.getByRole("button", { name: "Save profile" });
    await user.click(save);
    await screen.findByLabelText("Username");
    expect(screen.queryByText(/Your last change was not saved/)).toBeNull();

    await logIn(user);

    await waitFor(() => expect(save).toHaveFocus());
    expect(await screen.findByText(/Your last change was not saved/)).toHaveAttribute("role", "status");
    expect(screen.getByText(/Your last change was not saved/).closest("[hidden]")).toBeNull();
  });

  it("still finds the Save button when disabling it dropped focus to the body, as browsers do", async () => {
    const user = userEvent.setup();
    let puts = 0;
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
      "PUT /api/admin/profile": () => {
        (document.activeElement as HTMLElement | null)?.blur();
        puts += 1;
        return problem(401);
      },
      "POST /api/auth/login": () => noContent(),
    });
    render(<AdminApp />);
    await screen.findByLabelText("Full name (required)");
    const save = screen.getByRole("button", { name: "Save profile" });
    await user.click(save);
    await screen.findByLabelText("Username");
    expect(puts).toBe(1);

    await logIn(user);

    await waitFor(() => expect(save).toHaveFocus());
  });

  it("drops messages from the page while logged out, and reloads them on login", async () => {
    const user = userEvent.setup();
    window.location.hash = "#messages";
    let reads = 0;
    const message = { id: 1, name: "Ada", email: "a@example.com", locale: "en", message: "Private text", createdAt: "2026-11-05T10:00:00Z" };
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/messages": () => json({ items: [message], page: 0, size: 20, total: 1 }),
      "PATCH /api/admin/messages/1": () => {
        reads += 1;
        return problem(401);
      },
      "POST /api/auth/login": () => noContent(),
    });
    render(<AdminApp />);

    await screen.findByText("Private text");
    await user.click(screen.getByRole("button", { name: "Mark as read: message from Ada" }));
    await screen.findByLabelText("Username");
    expect(reads).toBe(1);
    expect(document.body.textContent).not.toContain("Private text");

    await logIn(user);
    expect(await screen.findByText("Private text")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Messages" })).toHaveFocus();
  });
});

describe("unsaved drafts", () => {
  function unloadBlocked(): boolean {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  function server() {
    return stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
      "PUT /api/admin/profile": (call) => json({ ...JSON.parse(call.body ?? "{}"), version: 4 }),
      "POST /api/auth/logout": () => noContent(),
    });
  }

  it("warn before leaving only while something is unsaved, on the profile screen too", async () => {
    const user = userEvent.setup();
    server();
    render(<AdminApp />);
    const name = await screen.findByLabelText("Full name (required)");
    expect(unloadBlocked()).toBe(false);

    await user.type(name, "x");
    expect(unloadBlocked()).toBe(true);

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText("Saved. The public site shows this now.");
    expect(unloadBlocked()).toBe(false);
  });

  it("ask before logging out, and declining keeps the session and the text", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { calls } = server();
    render(<AdminApp />);
    const name = await screen.findByLabelText("Full name (required)");
    await user.type(name, "x");

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Log out and discard them?");
    expect(calls.some((call) => call.url === "/api/auth/logout")).toBe(false);
    expect(name).toHaveValue("Kamilx");
  });

  it("do not trigger the question when everything is saved", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const { calls } = server();
    render(<AdminApp />);
    await screen.findByLabelText("Full name (required)");

    await user.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(calls.some((call) => call.url === "/api/auth/logout")).toBe(true));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("stop warning once logout has discarded them", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    let authenticated = true;
    stubServer({
      "GET /api/auth/session": () => json({ authenticated }),
      "GET /api/admin/profile": () => json(PROFILE),
      "POST /api/auth/logout": () => {
        authenticated = false;
        return noContent();
      },
    });
    render(<AdminApp />);
    await user.type(await screen.findByLabelText("Full name (required)"), "x");
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await screen.findByLabelText("Username");
    expect(unloadBlocked()).toBe(false);
  });
});

describe("View site", () => {
  it("opens in a new tab, so drafts survive", async () => {
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
    });
    render(<AdminApp />);
    const link = await screen.findByRole("link", { name: /^View site/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("href", "/en");
  });
});

describe("logout", () => {
  it("posts with the header, fetches the session again and drops the screens", async () => {
    const user = userEvent.setup();
    setCookie("t1");
    let authenticated = true;
    const { calls } = stubServer({
      "GET /api/auth/session": () => json({ authenticated }),
      "GET /api/admin/profile": () => json(PROFILE),
      "POST /api/auth/logout": () => {
        authenticated = false;
        return noContent();
      },
    });
    render(<AdminApp />);

    await screen.findByLabelText("Full name (required)");
    await user.click(screen.getByRole("button", { name: "Log out" }));

    await screen.findByLabelText("Username");
    expect(screen.queryByLabelText("Full name (required)")).toBeNull();
    const logoutCall = calls.findIndex((call) => call.url === "/api/auth/logout");
    expect(calls[logoutCall]?.headers["X-XSRF-TOKEN"]).toBe("t1");
    expect(calls[logoutCall + 1]?.url).toBe("/api/auth/session");
  });

  it("says so when logging out fails", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
      "POST /api/auth/logout": () => new TypeError("offline"),
    });
    render(<AdminApp />);

    await screen.findByLabelText("Full name (required)");
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText(/You are still logged in/)).toBeInTheDocument();
  });
});

describe("profile", () => {
  it("shows the empty form on 404, and the first save has no version", async () => {
    const user = userEvent.setup();
    const { calls } = stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => problem(404),
      "PUT /api/admin/profile": (call) => json({ ...JSON.parse(call.body ?? "{}"), version: 0 }),
    });
    render(<AdminApp />);

    expect(await screen.findByText(/No profile exists yet/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Full name (required)"), "Kamil");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await screen.findByText("Saved. The public site shows this now.");
    const put = calls.find((call) => call.method === "PUT");
    const body = JSON.parse(put?.body ?? "{}") as Record<string, unknown>;
    expect(body["version"] ?? null).toBeNull();
    expect(body["fullName"]).toBe("Kamil");
  });

  it("uses the returned version for the next save, and leaves out empty optional fields", async () => {
    const user = userEvent.setup();
    let version = 3;
    const { calls } = stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
      "PUT /api/admin/profile": (call) => json({ ...JSON.parse(call.body ?? "{}"), version: ++version }),
    });
    render(<AdminApp />);
    await screen.findByLabelText("Full name (required)");

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText("Saved. The public site shows this now.");
    await user.type(screen.getByLabelText("GitHub address"), "https://github.com/x");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(calls.filter((call) => call.method === "PUT")).toHaveLength(2));

    const [first, second] = calls
      .filter((call) => call.method === "PUT")
      .map((call) => JSON.parse(call.body ?? "{}") as Record<string, unknown>);
    expect(first?.["version"]).toBe(3);
    expect(first).not.toHaveProperty("githubUrl");
    expect(first).not.toHaveProperty("publicEmail");
    expect(second?.["version"]).toBe(4);
    expect(second?.["githubUrl"]).toBe("https://github.com/x");
  });

  it("has both languages side by side", async () => {
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
    });
    render(<AdminApp />);
    const english = await screen.findByLabelText("Headline, English (required)");
    expect(english.closest(".lang-pair")).toContainElement(screen.getByLabelText("Headline, Polish (required)"));
  });
});

describe("navigation", () => {
  it("keeps unsaved text when moving between screens", async () => {
    const user = userEvent.setup();
    stubServer({
      "GET /api/auth/session": () => json({ authenticated: true }),
      "GET /api/admin/profile": () => json(PROFILE),
      "GET /api/admin/messages": () => json({ items: [], page: 0, size: 20, total: 0 }),
    });
    render(<AdminApp />);

    const name = await screen.findByLabelText("Full name (required)");
    await user.clear(name);
    await user.type(name, "Unsaved");

    act(() => {
      window.location.hash = "#messages";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(await screen.findByText("No messages.")).toBeVisible();
    expect(name).not.toBeVisible();

    act(() => {
      window.location.hash = "#profile";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(name).toBeVisible());
    expect(name).toHaveValue("Unsaved");
  });
});
